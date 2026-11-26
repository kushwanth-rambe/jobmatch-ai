"use client";

/**
 * Pieces shared by the Analysis, Decision and My Opportunities screens:
 * reading saved jobs from this browser, badges, dates and the "not found" card.
 */
import Link from "next/link";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { parseOpportunities, readOpportunitiesRaw, subscribeToOpportunities } from "@/lib/opportunities";
import type { AlignmentLevel, Opportunity, OpportunityStatus } from "@/lib/types";

const serverSnapshot = () => undefined;

export const DISCLAIMER = "This compares your profile with the job description. It is not a prediction of hiring success.";

/** All analysed jobs in this browser; `undefined` while loading (the server can't see browser storage). */
export function useOpportunities(): Opportunity[] | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(subscribeToOpportunities, readOpportunitiesRaw, serverSnapshot);
  return raw === undefined ? undefined : parseOpportunities(raw);
}

/**
 * Next.js keeps recently visited pages alive (hidden) for quick back-navigation.
 * `reset` runs when the page is hidden, so one-off messages don't reappear later.
 */
export function useResetWhenHidden(reset: () => void) {
  useLayoutEffect(() => reset, []); // eslint-disable-line react-hooks/exhaustive-deps
}

export const LEVEL: Record<AlignmentLevel, { label: string; short: string; tone: string; dot: string }> = {
  strong: { label: "Strong alignment", short: "Strong", tone: "border-brand/40 bg-brand-soft text-brand-strong", dot: "bg-brand" },
  partial: { label: "Partial alignment", short: "Partial", tone: "border-accent/40 bg-accent-soft text-accent", dot: "bg-accent" },
  limited: { label: "Limited alignment", short: "Limited", tone: "border-border bg-surface-muted text-muted", dot: "bg-subtle" },
};

export function LevelBadge({ level, short = false }: { level: AlignmentLevel; short?: boolean }) {
  const l = LEVEL[level];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap ${l.tone}`}>
      <span className={`h-2 w-2 rounded-full ${l.dot}`} aria-hidden="true" />
      {short ? (
        <>
          {l.short}
          <span className="sr-only"> alignment</span>
        </>
      ) : (
        l.label
      )}
    </span>
  );
}

export const STATUS_LABEL: Record<OpportunityStatus, string> = { analysed: "Not saved", saved: "Saved", applied: "Applied" };

export function StatusBadge({ status }: { status: OpportunityStatus }) {
  const tone =
    status === "applied"
      ? "bg-brand text-brand-foreground"
      : status === "saved"
        ? "border border-brand/40 bg-brand-soft text-brand-strong"
        : "border border-border bg-surface-muted text-muted";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tone}`}>
      {status === "applied" && <span aria-hidden="true">✓</span>}
      {STATUS_LABEL[status]}
    </span>
  );
}

export const WORK_MODE_LABEL: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };

export function jobTitle(o: Opportunity): string {
  return o.jobTitle ?? o.analysis.job.title ?? "Untitled job";
}

export function jobCompany(o: Opportunity): string | null {
  return o.company ?? o.analysis.job.company;
}

/** "Company · Location · Hybrid" */
export function jobMeta(o: Opportunity): string {
  const a = o.analysis;
  return [jobCompany(o), o.location ?? a.job.location, a.job.workMode ? WORK_MODE_LABEL[a.job.workMode] : null].filter(Boolean).join(" · ");
}

export function formatDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  return !d || Number.isNaN(d.getTime()) ? "recently" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const buttonClass = {
  primary:
    "inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
  quiet:
    "inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground",
};

export function NotFound() {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h1 className="text-xl font-semibold">We couldn&apos;t find this job on this device</h1>
      <p className="mt-2 text-muted">
        Analyses are saved only in the browser where they were created. It may have been made on another device or browser,
        deleted, or the browser&apos;s site data was cleared.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Link href="/analyze" className={buttonClass.primary}>
          Analyse a job →
        </Link>
        <Link href="/opportunities" className={buttonClass.secondary}>
          My opportunities
        </Link>
      </div>
    </div>
  );
}

export function LoadingLine({ text }: { text: string }) {
  return (
    <p className="mt-8 text-sm text-subtle" aria-busy="true">
      {text}
    </p>
  );
}
