"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MAX_OPPORTUNITIES, NEAR_LIMIT, clearOpportunities, deleteOpportunity, isKept } from "@/lib/opportunities";
import { clearProfile } from "@/lib/profile";
import type { Opportunity } from "@/lib/types";
import {
  LevelBadge,
  LoadingLine,
  StatusBadge,
  buttonClass,
  formatDate,
  jobCompany,
  jobTitle,
  useOpportunities,
  useResetWhenHidden,
} from "./shared";

type Notice = { tone: "success" | "error"; text: string; cleared?: boolean };

/** My Opportunities: saved and applied jobs in this browser (spec §4 Screen 5). No AI calls. */
export function OpportunityList() {
  const list = useOpportunities();
  const [notice, setNotice] = useState<Notice | null>(null);
  useResetWhenHidden(() => setNotice(null));

  if (list === undefined) return <LoadingLine text="Loading your opportunities…" />;

  const kept = list.filter(isKept);
  const saved = kept.filter((o) => o.status === "saved").length;
  const applied = kept.length - saved;
  const notSaved = list.length - kept.length;

  function remove(o: Opportunity) {
    const result = deleteOpportunity(o.id);
    setNotice(
      result.ok || result.reason === "not_found"
        ? { tone: "success", text: `Deleted “${jobTitle(o)}”.` }
        : { tone: "error", text: "Your browser didn't allow the change. Check that site data isn't blocked and try again." },
    );
  }

  function clearDevice() {
    const ok = clearOpportunities() && clearProfile();
    setNotice(
      ok
        ? { tone: "success", text: "Everything JobMatch stored on this device has been deleted.", cleared: true }
        : { tone: "error", text: "Your browser didn't allow the data to be deleted. Try clearing this site's data in your browser settings." },
    );
  }

  return (
    <div className="mt-8 sm:mt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My opportunities</h1>
          <p className="mt-1.5 text-muted">Jobs you saved or applied to. Stored only in this browser.</p>
        </div>
        {kept.length > 0 && (
          <p className="text-sm text-subtle">
            {saved} saved · {applied} applied
          </p>
        )}
      </header>

      <div aria-live="polite">
        {notice && (
          <div
            className={`mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
              notice.tone === "success" ? "bg-brand-soft text-brand-strong" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            <span>{notice.text}</span>
            {notice.cleared && (
              <Link href="/profile" className="underline underline-offset-2 hover:no-underline">
                Create a new profile
              </Link>
            )}
          </div>
        )}
      </div>

      <StorageWarning kept={kept.length} />

      {kept.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-8">
          <h2 className="text-lg font-semibold">No saved jobs yet</h2>
          <p className="mt-2 text-muted">
            After an analysis, choose <span className="font-medium text-foreground">Save opportunity</span> or{" "}
            <span className="font-medium text-foreground">Mark as applied</span> on the Application Decision step, and the job
            will appear here.
          </p>
          <Link href="/analyze" className={`${buttonClass.primary} mt-5`}>
            Analyse a job →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {kept.map((o) => (
            <Row key={o.id} o={o} onDelete={() => remove(o)} />
          ))}
        </ul>
      )}

      {kept.length > 0 && (
        <div className="mt-6">
          <Link href="/analyze" className={buttonClass.primary}>
            Analyse another job →
          </Link>
        </div>
      )}

      {/* Clear this device (spec §9: the user controls their data) */}
      <section id="device" aria-labelledby="device-heading" className="mt-10 scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 id="device-heading" className="text-lg font-semibold">
          Your data on this device
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          JobMatch has no accounts. Your profile and analysed jobs are kept only in this browser
          {list.length > 0 && (
            <>
              {" "}
              ({list.length} analysed {list.length === 1 ? "job" : "jobs"}
              {notSaved > 0 && `, ${notSaved} not saved`})
            </>
          )}
          .
        </p>
        <div className="mt-4">
          <ConfirmButton
            className={buttonClass.secondary}
            title="Clear this device?"
            message={
              <p>
                This permanently deletes your profile and all {list.length} analysed {list.length === 1 ? "job" : "jobs"}, including{" "}
                {saved} saved and {applied} applied, from this browser. It can&apos;t be undone.
              </p>
            }
            confirmLabel="Delete everything"
            onConfirm={clearDevice}
          >
            Clear this device
          </ConfirmButton>
        </div>
      </section>
    </div>
  );
}

function Row({ o, onDelete }: { o: Opportunity; onDelete: () => void }) {
  const title = jobTitle(o);
  const company = jobCompany(o);
  const href = `/opportunity/${o.id}/decision`;
  return (
    <li className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            <Link href={href} className="hover:text-brand hover:underline">
              {title}
            </Link>
          </h2>
          {company && <p className="mt-0.5 text-sm text-muted">{company}</p>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={o.status} />
            <LevelBadge level={o.analysis.alignmentLevel} short />
            <span className="text-subtle">
              {o.status === "applied" ? `Applied ${formatDate(o.appliedAt)}` : `Analysed ${formatDate(o.analysis.analysedAt ?? o.createdAt)}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href={href} className={`${buttonClass.secondary} h-10 px-4`} aria-label={`Open ${title}`}>
            Open
          </Link>
          {o.sourceUrl && (
            <a
              href={o.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`${buttonClass.quiet} h-10 px-3`}
              aria-label={`Original job listing for ${title} (opens in a new tab)`}
            >
              Job listing ↗
            </a>
          )}
          <ConfirmButton
            className={`${buttonClass.quiet} h-10 px-3 text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300`}
            ariaLabel={`Delete ${title}`}
            title="Delete this job?"
            message={
              <p>
                “{title}”{company ? ` at ${company}` : ""} and its analysis will be deleted from this browser. It can&apos;t be undone.
              </p>
            }
            confirmLabel="Delete"
            onConfirm={onDelete}
          >
            Delete
          </ConfirmButton>
        </div>
      </div>
    </li>
  );
}

/** Friendly warning before or when the storage limit is reached (never deletes anything itself). */
export function StorageWarning({ kept }: { kept: number }) {
  if (kept < NEAR_LIMIT) return null;
  const full = kept >= MAX_OPPORTUNITIES;
  return (
    <div role="status" className="mt-6 rounded-xl border border-accent/40 bg-accent-soft p-4 text-sm">
      <p className="font-medium text-foreground">
        {full ? "Storage is full" : "Storage is nearly full"} — {kept} of {MAX_OPPORTUNITIES} jobs kept.
      </p>
      <p className="mt-1 text-muted">
        {full
          ? "New analyses can't be stored until you delete a saved or applied job you no longer need. Nothing is deleted automatically."
          : "Saved and applied jobs are never deleted automatically. When it's full, you'll need to delete one before analysing a new job."}
      </p>
    </div>
  );
}
