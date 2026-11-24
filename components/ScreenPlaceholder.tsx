import Link from "next/link";
import type { ReactNode } from "react";
import { JourneySteps } from "@/components/JourneySteps";
import type { JourneyStepNumber } from "@/lib/journey";

type NavLink = { href: string; label: string };

type Props = {
  steps: JourneyStepNumber[];
  title: string;
  intro: string;
  /** e.g. "Built in Milestone M1" */
  milestone: string;
  /** What the finished screen will contain (taken from the spec). */
  plannedItems: string[];
  back: NavLink;
  next?: NavLink;
  children?: ReactNode;
};

/**
 * Shared layout for journey screens that are not built yet.
 * Shows what the screen will contain — never sample or fake results.
 */
export function ScreenPlaceholder({ steps, title, intro, milestone, plannedItems, back, next, children }: Props) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <JourneySteps current={steps} />

      <div className="mt-8 sm:mt-10">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
          {milestone}
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-muted">{intro}</p>
      </div>

      <section className="mt-6 rounded-2xl border border-dashed border-border bg-surface p-5 sm:p-6" aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="text-sm font-semibold uppercase tracking-wide text-subtle">
          This screen will include
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {plannedItems.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {children}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Link
          href={back.href}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-muted"
        >
          ← {back.label}
        </Link>
        {next && (
          <Link
            href={next.href}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            {next.label} →
          </Link>
        )}
      </div>
    </div>
  );
}
