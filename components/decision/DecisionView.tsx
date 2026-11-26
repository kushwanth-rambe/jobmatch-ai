"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { updateOpportunityStatus } from "@/lib/opportunities";
import type { Opportunity, OpportunityStatus, Requirement } from "@/lib/types";
import {
  DISCLAIMER,
  LevelBadge,
  LoadingLine,
  NotFound,
  StatusBadge,
  buttonClass,
  formatDate,
  jobMeta,
  jobTitle,
  useOpportunities,
  useResetWhenHidden,
} from "@/components/opportunities/shared";

/** Step 4 · Application Decision. Everything is read from this browser — no AI call. */
export function DecisionView() {
  const { id } = useParams<{ id: string }>();
  const list = useOpportunities();
  if (list === undefined) return <LoadingLine text="Loading…" />;
  const opportunity = list.find((o) => o.id === id);
  if (!opportunity) return <NotFound />;
  return <Decision opportunity={opportunity} />;
}

type Notice =
  | { tone: "success"; text: string; undo: { status: OpportunityStatus; appliedAt: string | null } }
  | { tone: "error"; text: string };

const byImportance = (a: Requirement, b: Requirement) =>
  a.importance === b.importance ? 0 : a.importance === "must_have" ? -1 : 1;

function Decision({ opportunity: o }: { opportunity: Opportunity }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  useResetWhenHidden(() => setNotice(null));

  const a = o.analysis;
  const matched = a.requirements.filter((r) => r.status === "matched").sort(byImportance);
  const gaps = a.requirements.filter((r) => r.status !== "matched").sort(byImportance);
  const meta = jobMeta(o);
  const analysisHref = `/opportunity/${o.id}`;

  function change(status: OpportunityStatus) {
    const before = { status: o.status, appliedAt: o.appliedAt };
    const result = updateOpportunityStatus(o.id, status);
    if (!result.ok) {
      setNotice({
        tone: "error",
        text:
          result.reason === "not_found"
            ? "This job is no longer saved on this device."
            : "Your browser didn't allow the change to be saved. Check that site data isn't blocked, or free up space by deleting jobs in My opportunities.",
      });
      return;
    }
    setNotice({
      tone: "success",
      text: status === "applied" ? `Marked as applied on ${formatDate(new Date().toISOString())}.` : "Saved to My opportunities.",
      undo: before,
    });
  }

  function undo(previous: { status: OpportunityStatus; appliedAt: string | null }) {
    const result = updateOpportunityStatus(o.id, previous.status, previous.appliedAt);
    setNotice(result.ok ? null : { tone: "error", text: "Your browser didn't allow the change to be undone. Please try again." });
  }

  return (
    <article className="mt-8 sm:mt-10">
      <header>
        <p className="text-sm font-medium text-brand">Application Decision</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{jobTitle(o)}</h1>
        {meta && <p className="mt-1.5 text-muted">{meta}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <StatusBadge status={o.status} />
          <span className="text-subtle">
            {o.status === "applied" ? `Applied on ${formatDate(o.appliedAt)}` : `Analysed ${formatDate(a.analysedAt)}`}
          </span>
        </div>
      </header>

      {/* Original job link (FR-4.2, AC-D1) */}
      <section aria-labelledby="link-heading" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 id="link-heading" className="text-lg font-semibold">
          Original job
        </h2>
        {o.sourceUrl ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 truncate text-sm text-subtle" title={o.sourceUrl}>
              {o.sourceUrl}
            </p>
            <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className={`${buttonClass.secondary} shrink-0`}>
              Open original job <span aria-hidden="true">&nbsp;↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            No link was added for this job. You can still read the{" "}
            <Link href={analysisHref} className="font-medium text-brand hover:underline">
              original job description
            </Link>{" "}
            on the analysis page.
          </p>
        )}
      </section>

      {/* Match summary */}
      <section aria-labelledby="match-heading" className="mt-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="match-heading" className="text-lg font-semibold">
            Match summary
          </h2>
          <LevelBadge level={a.alignmentLevel} />
        </div>
        <p className="mt-3">
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
        <p className="mt-2 leading-relaxed text-muted">{a.summary}</p>
        <p className="mt-4 flex gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm text-muted" role="note">
          <span aria-hidden="true">ⓘ</span>
          {DISCLAIMER}
        </p>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ShortList title="Matching skills" icon="✓" count={matched.length} empty="None of the job's requirements are clearly shown in your profile yet.">
          {matched.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2">
              <span>{r.requirement}</span>
              <Importance r={r} />
            </li>
          ))}
        </ShortList>
        <ShortList title="Missing or unproven skills" icon="!" count={gaps.length} empty="Nothing missing — every listed requirement is shown in your profile.">
          {gaps.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2">
              <span>
                {r.requirement}
                <span className="ml-2 text-xs font-medium text-subtle">{r.status === "missing" ? "Missing" : "Unproven"}</span>
              </span>
              <Importance r={r} />
            </li>
          ))}
        </ShortList>
      </div>

      <div className="mt-4">
        <ShortList title="Requirements to clarify" icon="?" count={a.toClarify.length} empty="Nothing stood out as unclear in this job description.">
          {a.toClarify.map((c) => (
            <li key={c.requirement} className="py-2.5">
              <p className="font-medium">{c.requirement}</p>
              <p className="mt-1 text-sm text-muted">
                <span className="text-subtle">You could ask: </span>“{c.suggestedQuestion}”
              </p>
            </li>
          ))}
        </ShortList>
      </div>

      <p className="mt-4 text-sm text-subtle">
        Full evidence for each requirement is on the{" "}
        <Link href={analysisHref} className="font-medium text-brand hover:underline">
          analysis page
        </Link>
        .
      </p>

      {/* Decision actions (FR-4.13–4.15, FR-4.18). On phones it stays at the bottom of the screen while scrolling. */}
      <section
        aria-labelledby="decide-heading"
        className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:rounded-2xl sm:border sm:bg-surface sm:px-6 sm:py-5 sm:backdrop-blur-none"
      >
        <h2 id="decide-heading" className="sr-only">
          Your decision
        </h2>
        <div aria-live="polite">
          {notice && (
            <div
              className={`mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                notice.tone === "success" ? "bg-brand-soft text-brand-strong" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              <span>{notice.text}</span>
              {notice.tone === "success" && (
                <>
                  <button type="button" onClick={() => undo(notice.undo)} className="underline underline-offset-2 hover:no-underline">
                    Undo
                  </button>
                  <Link href="/opportunities" className="underline underline-offset-2 hover:no-underline">
                    View My opportunities
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="hidden text-sm text-subtle sm:block">Saved on this device only.</p>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            {o.status === "applied" ? (
              <p className="col-span-2 flex h-11 items-center justify-center rounded-lg bg-brand-soft px-5 text-sm font-medium text-brand-strong">
                ✓ Applied on {formatDate(o.appliedAt)}
              </p>
            ) : (
              <>
                <button type="button" onClick={() => change("saved")} disabled={o.status === "saved"} className={buttonClass.secondary}>
                  {o.status === "saved" ? "✓ Saved" : "Save opportunity"}
                </button>
                <button type="button" onClick={() => change("applied")} className={buttonClass.primary}>
                  Mark as applied
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {o.status === "analysed" && (
        <p className="mt-3 text-sm text-subtle">
          Not saved yet. Saved and applied jobs stay in My opportunities; jobs you don&apos;t save may be removed later to make
          room for new analyses.
        </p>
      )}
      <p className="mt-3 text-sm text-subtle sm:hidden">Saved on this device only.</p>

      <nav aria-label="Next steps" className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link href={analysisHref} className={buttonClass.quiet}>
            ← Back to analysis
          </Link>
          <Link href="/profile" className={buttonClass.secondary}>
            Edit profile
          </Link>
        </div>
        <Link href="/analyze" className={buttonClass.primary}>
          Analyse another job →
        </Link>
      </nav>
    </article>
  );
}

function ShortList({ title, icon, count, empty, children }: { title: string; icon: string; count: number; empty: string; children: ReactNode }) {
  return (
    <section className="h-full rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-sm text-brand" aria-hidden="true">
          {icon}
        </span>
        {title}
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">{count}</span>
      </h2>
      {count === 0 ? <p className="mt-3 text-sm text-muted">{empty}</p> : <ul className="mt-2 divide-y divide-border">{children}</ul>}
    </section>
  );
}

function Importance({ r }: { r: Requirement }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        r.importance === "must_have" ? "bg-foreground/10 text-foreground" : "bg-surface-muted text-subtle"
      }`}
    >
      {r.importance === "must_have" ? "Must-have" : "Nice-to-have"}
    </span>
  );
}
