"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { parseOpportunities, readOpportunitiesRaw, subscribeToOpportunities } from "@/lib/opportunities";
import type { AlignmentLevel, Analysis, ExperienceStatus, LocationStatus, Opportunity, Requirement } from "@/lib/types";

const serverSnapshot = () => undefined;

export const DISCLAIMER = "This compares your profile with the job description. It is not a prediction of hiring success.";

/** Loads the analysed job from this browser by its id. */
export function AnalysisView() {
  const { id } = useParams<{ id: string }>();
  const reused = useSearchParams().get("reused") === "1";
  const raw = useSyncExternalStore<string | null | undefined>(subscribeToOpportunities, readOpportunitiesRaw, serverSnapshot);
  if (raw === undefined) return <p className="mt-8 text-sm text-subtle" aria-busy="true">Loading your analysis…</p>;
  const opportunity = parseOpportunities(raw).find((o) => o.id === id);
  if (!opportunity) return <NotFound />;
  return <AnalysisResult opportunity={opportunity} reused={reused} />;
}

function NotFound() {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h1 className="text-xl font-semibold">We couldn&apos;t find this analysis on this device</h1>
      <p className="mt-2 text-muted">
        Analyses are saved only in the browser where they were created. It may have been made on another device or
        browser, or the browser&apos;s site data was cleared.
      </p>
      <Link
        href="/analyze"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
      >
        Analyse a job →
      </Link>
    </div>
  );
}

const LEVEL: Record<AlignmentLevel, { label: string; tone: string; dot: string }> = {
  strong: { label: "Strong alignment", tone: "border-brand/40 bg-brand-soft text-brand-strong", dot: "bg-brand" },
  partial: { label: "Partial alignment", tone: "border-accent/40 bg-accent-soft text-accent", dot: "bg-accent" },
  limited: { label: "Limited alignment", tone: "border-border bg-surface-muted text-muted", dot: "bg-subtle" },
};

const EXPERIENCE_LABEL: Record<ExperienceStatus, string> = {
  below: "Below the level asked",
  meets: "Meets the level asked",
  exceeds: "Above the level asked",
  not_specified: "Not specified in the job",
};

const LOCATION_LABEL: Record<LocationStatus, string> = {
  aligned: "Matches your preferences",
  partial: "Partly matches your preferences",
  not_aligned: "Doesn't match your preferences",
  unclear: "Not clear from the job description",
};

const WORK_MODE_LABEL: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };

const byImportance = (a: Requirement, b: Requirement) =>
  a.importance === b.importance ? 0 : a.importance === "must_have" ? -1 : 1;

function AnalysisResult({ opportunity, reused }: { opportunity: Opportunity; reused: boolean }) {
  const a = opportunity.analysis;
  const matched = a.requirements.filter((r) => r.status === "matched").sort(byImportance);
  const unproven = a.requirements.filter((r) => r.status === "unproven").sort(byImportance);
  const missing = a.requirements.filter((r) => r.status === "missing").sort(byImportance);
  const title = opportunity.jobTitle ?? a.job.title ?? "Untitled job";
  const company = opportunity.company ?? a.job.company;
  const meta = [company, opportunity.location ?? a.job.location, a.job.workMode ? WORK_MODE_LABEL[a.job.workMode] : null]
    .filter(Boolean)
    .join(" · ");
  const p = opportunity.profileSnapshot;

  return (
    <article className="mt-8 sm:mt-10">
      <header>
        <p className="text-sm font-medium text-brand">JobMatch Analysis</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {meta && <p className="mt-1.5 text-muted">{meta}</p>}
        <p className="mt-2 text-sm text-subtle">
          Analysed {formatDate(a.analysedAt)} · compared with your profile: {p.currentRole} → {p.targetRole},{" "}
          {p.yearsExperience} yrs, {p.skills.length} skills
        </p>
        {reused && (
          <p className="mt-3 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-muted">
            You&apos;ve already analysed this job with the same profile, so we&apos;re showing the saved result — no new
            analysis was needed.
          </p>
        )}
      </header>

      <SummaryCard analysis={a} />

      <div className="mt-6 grid gap-4">
        <Section
          title="Matching skills"
          icon="✓"
          count={matched.length}
          intro="Requirements your profile clearly shows, with the evidence from your profile."
          empty="None of the job's requirements are clearly shown in your profile yet."
        >
          {matched.map((r) => (
            <RequirementItem key={r.id} r={r} />
          ))}
        </Section>

        <Section
          title="Missing or unproven skills"
          icon="!"
          count={unproven.length + missing.length}
          intro="What the job asks for that your profile doesn't demonstrate."
          empty="Nothing missing — every listed requirement is shown in your profile."
        >
          {unproven.length > 0 && (
            <SubGroup title="Unproven" text="Your profile shows related experience, but not this exactly. If you do have it, add it to your profile and analyse again.">
              {unproven.map((r) => (
                <RequirementItem key={r.id} r={r} />
              ))}
            </SubGroup>
          )}
          {missing.length > 0 && (
            <SubGroup title="Missing" text="Nothing in your profile indicates these.">
              {missing.map((r) => (
                <RequirementItem key={r.id} r={r} />
              ))}
            </SubGroup>
          )}
        </Section>

        <Section title="Experience alignment" icon="↔">
          <StatusLine label={EXPERIENCE_LABEL[a.experienceAlignment.status]} />
          <p className="mt-2 text-sm text-muted">{a.experienceAlignment.explanation}</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:max-w-md">
            <div className="rounded-lg bg-surface-muted px-3 py-2">
              <dt className="text-subtle">Job asks for</dt>
              <dd className="font-medium">{yearsAsked(a)}</dd>
            </div>
            <div className="rounded-lg bg-surface-muted px-3 py-2">
              <dt className="text-subtle">Your profile</dt>
              <dd className="font-medium">{p.yearsExperience} years</dd>
            </div>
          </dl>
        </Section>

        <Section title="Location and work mode" icon="⌖">
          <StatusLine label={LOCATION_LABEL[a.locationAlignment.status]} />
          <p className="mt-2 text-sm text-muted">{a.locationAlignment.explanation}</p>
        </Section>

        <Section
          title="Requirements to clarify"
          icon="?"
          count={a.toClarify.length}
          intro="Vague or unusual asks worth checking with the recruiter before you apply."
          empty="Nothing stood out as unclear in this job description."
        >
          {a.toClarify.map((c) => (
            <li key={c.requirement} className="rounded-xl border border-border p-4">
              <p className="font-medium">{c.requirement}</p>
              <p className="mt-1 text-sm text-muted">{c.reason}</p>
              <p className="mt-2 rounded-lg bg-surface-muted px-3 py-2 text-sm">
                <span className="text-subtle">You could ask: </span>“{c.suggestedQuestion}”
              </p>
            </li>
          ))}
        </Section>

        <details className="group rounded-2xl border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-semibold sm:px-6">
            Original job description
            <span className="text-sm font-normal text-subtle group-open:hidden">Show</span>
            <span className="hidden text-sm font-normal text-subtle group-open:inline">Hide</span>
          </summary>
          <div className="max-h-[28rem] overflow-y-auto border-t border-border px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-muted sm:px-6">
            {opportunity.jobDescription}
          </div>
        </details>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-5 text-sm text-muted">
        <span className="font-medium text-foreground">Next: your application decision.</span> Saving this job, marking it as
        applied and opening the original listing arrive in the next update (M3).
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href="/profile"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          Edit profile
        </Link>
        <Link
          href="/analyze"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
        >
          Analyse another job →
        </Link>
      </div>
    </article>
  );
}

function SummaryCard({ analysis: a }: { analysis: Analysis }) {
  const level = LEVEL[a.alignmentLevel];
  const usesMust = a.mustHaveTotal > 0;
  const basisMatched = usesMust ? a.mustHaveMatched : a.requirements.filter((r) => r.status === "matched").length;
  const basisTotal = usesMust ? a.mustHaveTotal : a.requirements.length;
  const basisName = usesMust ? "must-have requirements" : "listed requirements";
  return (
    <section aria-labelledby="summary-heading" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 id="summary-heading" className="sr-only">
        Summary
      </h2>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${level.tone}`}>
          <span className={`h-2 w-2 rounded-full ${level.dot}`} aria-hidden="true" />
          {level.label}
        </span>
      </div>
      <p className="mt-4 text-base">
        Your profile shows{" "}
        <strong>
          {a.mustHaveMatched} of {a.mustHaveTotal}
        </strong>{" "}
        must-have requirements
        {a.niceToHaveTotal > 0 && (
          <>
            {" "}
            and{" "}
            <strong>
              {a.niceToHaveMatched} of {a.niceToHaveTotal}
            </strong>{" "}
            nice-to-haves
          </>
        )}
        .
      </p>
      <p className="mt-3 leading-relaxed text-muted">{a.summary}</p>

      <details className="mt-4 rounded-lg bg-surface-muted px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">How this was worked out</summary>
        <div className="mt-2 space-y-2 text-muted">
          <p>
            The alignment level is calculated by JobMatch&apos;s own rule, not by the AI: {basisMatched} of {basisTotal}{" "}
            {basisName} are shown in your profile, and your experience is{" "}
            {EXPERIENCE_LABEL[a.experienceAlignment.status].toLowerCase()}.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Strong</strong>: at least 3 in 4 {basisName} shown, and experience not below the level asked.
            </li>
            <li>
              <strong>Partial</strong>: at least 2 in 5 shown (or 3 in 4 with experience below the level asked).
            </li>
            <li>
              <strong>Limited</strong>: fewer than 2 in 5 shown.
            </li>
          </ul>
          <p>
            A requirement only counts as matching when it is backed by words from your profile; anything the AI couldn&apos;t
            back up is listed as unproven.
          </p>
        </div>
      </details>

      <p className="mt-4 flex gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm text-muted" role="note">
        <span aria-hidden="true">ⓘ</span>
        {DISCLAIMER}
      </p>
    </section>
  );
}

function Section({
  title,
  icon,
  count,
  intro,
  empty,
  children,
}: {
  title: string;
  icon: string;
  count?: number;
  intro?: string;
  empty?: string;
  children: ReactNode;
}) {
  const isList = count !== undefined;
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-sm text-brand" aria-hidden="true">
          {icon}
        </span>
        {title}
        {isList && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">{count}</span>}
      </h2>
      {intro && <p className="mt-1.5 text-sm text-subtle">{intro}</p>}
      <div className="mt-4">
        {isList ? count === 0 ? <p className="text-sm text-muted">{empty}</p> : <ul className="grid gap-3">{children}</ul> : children}
      </div>
    </section>
  );
}

function SubGroup({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <li className="list-none">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-subtle">{text}</p>
      <ul className="mt-3 grid gap-3">{children}</ul>
    </li>
  );
}

function RequirementItem({ r }: { r: Requirement }) {
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{r.requirement}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            r.importance === "must_have" ? "bg-foreground/10 text-foreground" : "bg-surface-muted text-subtle"
          }`}
        >
          {r.importance === "must_have" ? "Must-have" : "Nice-to-have"}
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        <span className="text-subtle">Job asks: </span>“{r.jdEvidence}”
      </p>
      {r.profileEvidence && (
        <p className="mt-1 text-sm">
          <span className="text-subtle">{r.status === "matched" ? "Your profile: " : "Related in your profile: "}</span>
          <span className={r.status === "matched" ? "font-medium text-brand-strong" : "text-muted"}>“{r.profileEvidence}”</span>
        </p>
      )}
      {r.status !== "matched" && r.note && <p className="mt-1 text-sm text-muted">{r.note}</p>}
    </li>
  );
}

function StatusLine({ label }: { label: string }) {
  return <p className="font-medium">{label}</p>;
}

function yearsAsked(a: Analysis): string {
  const { requiredYearsMin: min, requiredYearsMax: max } = a.job;
  if (min !== null && max !== null && max !== min) return `${min}–${max} years`;
  if (min !== null) return `${min}+ years`;
  if (max !== null) return `Up to ${max} years`;
  return "Not specified";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "recently" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
