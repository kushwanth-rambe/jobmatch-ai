"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { PROMPT_VERSION } from "@/lib/analysis/prompt";
import {
  EMPTY_JOB_DRAFT,
  JOB_LIMITS,
  analysisCacheKey,
  analysisProfile,
  validateJobDraft,
  type JobDraft,
  type JobField,
} from "@/lib/job";
import {
  findByCacheKey,
  newOpportunityId,
  parseOpportunities,
  readJobDraft,
  readOpportunitiesRaw,
  storeOpportunity,
  writeJobDraft,
} from "@/lib/opportunities";
import { parseStoredProfile, readProfileRaw, subscribeToProfile } from "@/lib/profile";
import type { Analysis, Opportunity, Profile } from "@/lib/types";

const serverSnapshot = () => undefined;

const PROGRESS_STEPS = ["Reading the job requirements", "Comparing them with your profile", "Preparing your summary"];

/** Loads the saved profile from this browser, then shows the form (or asks for a profile first). */
export function AddJobScreen() {
  const raw = useSyncExternalStore<string | null | undefined>(subscribeToProfile, readProfileRaw, serverSnapshot);
  if (raw === undefined) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-surface p-6" aria-busy="true">
        <p className="text-sm text-subtle">Loading…</p>
      </div>
    );
  }
  const profile = parseStoredProfile(raw);
  if (!profile) return <NoProfile />;
  return <AddJobForm profile={profile} />;
}

function NoProfile() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="text-lg font-semibold">Create your profile first</h2>
      <p className="mt-2 text-muted">
        JobMatch compares each job with your Professional Profile. It takes about a minute and stays on this device.
      </p>
      <Link
        href="/profile"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
      >
        Create your profile →
      </Link>
    </div>
  );
}

type AnalyzeResponse = { analysis: Analysis } | { error: string; message: string };

function AddJobForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [draft, setDraft] = useState<JobDraft>(() => readJobDraft() ?? EMPTY_JOB_DRAFT);
  const [touched, setTouched] = useState<Set<JobField>>(() => new Set());
  const [analysing, setAnalysing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { errors, job } = validateJobDraft(draft);
  const length = draft.description.trim().length;
  const showError = (f: JobField) => (touched.has(f) ? errors[f] : undefined);

  // Next.js keeps visited pages alive (hidden) for quick back-navigation. When this
  // form is hidden, reset the one-off state so returning shows a fresh, usable form:
  // the pasted text comes back from this tab's draft (cleared after a successful analysis).
  useLayoutEffect(() => {
    return () => {
      setAnalysing(false);
      setStep(0);
      setError(null);
      setTouched(new Set());
      setDraft(readJobDraft() ?? EMPTY_JOB_DRAFT);
    };
  }, []);

  // Move the progress text along while waiting for the server.
  useEffect(() => {
    if (!analysing) return;
    const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1)), 3500);
    return () => window.clearInterval(timer);
  }, [analysing]);

  function update(field: JobField, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    writeJobDraft(next);
    setError(null);
  }

  function touch(field: JobField) {
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  }

  async function analyse() {
    if (!job || analysing) {
      setTouched(new Set<JobField>(["description", "title", "company", "link"]));
      return;
    }
    setAnalysing(true);
    setStep(0);
    setError(null);
    try {
      // 1. Same profile + same job description analysed before? Reuse it — no API call.
      const inputHash = await analysisCacheKey(profile, job.description, PROMPT_VERSION);
      const cached = findByCacheKey(parseOpportunities(readOpportunitiesRaw()), inputHash);
      if (cached) {
        writeJobDraft(null);
        router.push(`/opportunity/${cached.id}?reused=1`);
        return;
      }

      // 2. Ask the server (which calls Gemini). The API key never leaves the server.
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: analysisProfile(profile),
          job: { description: job.description, title: job.title ?? "", company: job.company ?? "", link: job.link ?? "" },
        }),
      });
      const data = (await res.json().catch(() => null)) as AnalyzeResponse | null;
      if (!res.ok || !data || !("analysis" in data)) {
        setError(
          data && "message" in data ? data.message : "We couldn't complete the analysis. Your inputs are kept — please try again.",
        );
        setAnalysing(false);
        return;
      }

      // 3. Keep the result (and the original job description) in this browser.
      const opportunity: Opportunity = {
        id: newOpportunityId(),
        jobTitle: job.title ?? data.analysis.job.title,
        company: job.company ?? data.analysis.job.company,
        location: data.analysis.job.location,
        sourceUrl: job.link,
        sourceType: "paste",
        status: "analysed",
        appliedAt: null,
        inputHash,
        jobDescription: job.description,
        profileSnapshot: analysisProfile(profile),
        analysis: data.analysis,
        createdAt: new Date().toISOString(),
      };
      if (!storeOpportunity(opportunity)) {
        setError("Your browser didn't allow the analysis to be saved, so it can't be shown. Check that site data isn't blocked and try again.");
        setAnalysing(false);
        return;
      }
      writeJobDraft(null);
      router.push(`/opportunity/${opportunity.id}`);
    } catch {
      setError("We couldn't reach the analysis service. Check your internet connection — your inputs are kept.");
      setAnalysing(false);
    }
  }

  const counterTone =
    length > JOB_LIMITS.descriptionMax ? "text-red-600 dark:text-red-400" : length >= JOB_LIMITS.descriptionMin ? "text-brand" : "text-subtle";

  return (
    <form
      noValidate
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void analyse();
      }}
    >
      {/* Profile being used (FR-3.6) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
        <p className="min-w-0">
          <span className="text-subtle">Analysing as: </span>
          <span className="font-medium">
            {profile.currentRole} → {profile.targetRole}
          </span>
          <span className="text-subtle">
            {" "}
            · {profile.yearsExperience} {profile.yearsExperience === 1 ? "yr" : "yrs"} · {profile.skills.length} skills
          </span>
        </p>
        <Link href="/profile" className="font-medium text-brand hover:underline">
          Edit profile
        </Link>
      </div>

      <fieldset disabled={analysing} className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <TextField
          label="Job description"
          required
          error={showError("description")}
          hint="Open the job listing on any site, copy the full description — responsibilities and requirements — and paste it here."
        >
          {(p) => (
            <>
              <textarea
                {...p}
                rows={12}
                placeholder="Paste the full job description here…"
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
                onBlur={() => touch("description")}
                className={`${inputClass(!!showError("description"))} min-h-64 py-3 leading-relaxed sm:min-h-80`}
              />
              <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-subtle">
                  {length < JOB_LIMITS.descriptionMin
                    ? `At least ${JOB_LIMITS.descriptionMin} characters needed`
                    : "Looks like a full listing length"}
                </span>
                <span className={counterTone} aria-live="polite">
                  {length.toLocaleString("en")} / {JOB_LIMITS.descriptionMax.toLocaleString("en")} characters
                </span>
              </div>
            </>
          )}
        </TextField>

        <div className="mt-6 border-t border-border pt-6">
          <p className="text-sm font-medium">
            Job details <span className="font-normal text-subtle">(optional)</span>
          </p>
          <p className="mt-1 text-sm text-subtle">Helps you recognise this job later. Leave blank and we&apos;ll use what the description says.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <TextField label="Job title" error={showError("title")}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  placeholder="e.g. Product Manager"
                  value={draft.title}
                  onChange={(e) => update("title", e.target.value)}
                  onBlur={() => touch("title")}
                  className={inputClass(!!showError("title"))}
                />
              )}
            </TextField>
            <TextField label="Company" error={showError("company")}>
              {(p) => (
                <input
                  {...p}
                  type="text"
                  placeholder="e.g. Acme"
                  value={draft.company}
                  onChange={(e) => update("company", e.target.value)}
                  onBlur={() => touch("company")}
                  className={inputClass(!!showError("company"))}
                />
              )}
            </TextField>
          </div>
          <div className="mt-5">
            <TextField label="Original job link" error={showError("link")} hint="So you can open the listing again later.">
              {(p) => (
                <input
                  {...p}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={draft.link}
                  onChange={(e) => update("link", e.target.value)}
                  onBlur={() => touch("link")}
                  className={inputClass(!!showError("link"))}
                />
              )}
            </TextField>
          </div>
        </div>

        <p className="mt-6 rounded-lg bg-surface-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          When you click <span className="font-medium">Analyse fit</span>, your profile (roles, years of experience,
          skills, locations and highlights) and this job description are sent to Google&apos;s Gemini AI to create the
          analysis. Nothing else is sent, and the result is saved only in this browser.
        </p>
      </fieldset>

      <div className="mt-6">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {analysing ? (
          <div role="status" className="mb-4 rounded-xl border border-brand/30 bg-brand-soft p-4">
            <p className="text-sm font-medium">Analysing your fit… this usually takes 5–15 seconds.</p>
            <ol className="mt-3 space-y-1.5 text-sm">
              {PROGRESS_STEPS.map((label, i) => (
                <li key={label} className={`flex items-center gap-2 ${i <= step ? "text-foreground" : "text-subtle"}`}>
                  <span
                    aria-hidden="true"
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                      i < step ? "bg-brand text-brand-foreground" : i === step ? "animate-pulse bg-brand/60" : "bg-border"
                    }`}
                  >
                    {i < step ? "✓" : ""}
                  </span>
                  {label}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          !job && (
            <p className="mb-4 text-sm text-muted">
              <span className="font-medium text-foreground">To continue:</span>{" "}
              {errors.description ? "paste a full job description (at least 300 characters)." : "fix the highlighted fields."}
            </p>
          )
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/profile"
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            ← Professional Profile
          </Link>
          <button
            type="submit"
            disabled={!job || analysing}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-6 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
          >
            {analysing ? "Analysing…" : "Analyse fit →"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ---------- Building blocks (same look as the profile form) ---------- */

function inputClass(invalid: boolean) {
  return `block h-11 w-full rounded-lg border bg-surface px-3.5 text-base text-foreground placeholder:text-subtle transition-colors focus:outline-2 focus:outline-offset-0 focus:outline-ring disabled:opacity-60 sm:text-sm ${
    invalid ? "border-red-500 dark:border-red-400" : "border-border"
  }`;
}

type ControlProps = { id: string; "aria-invalid": boolean; "aria-describedby"?: string; "aria-required"?: boolean };

function TextField({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}{" "}
        {required && (
          <span className="text-accent" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-subtle">
          {hint}
        </p>
      )}
      <div className="mt-2">{children({ id, "aria-invalid": !!error, "aria-describedby": describedBy, "aria-required": required || undefined })}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
