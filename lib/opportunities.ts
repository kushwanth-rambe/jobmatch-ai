/**
 * Analysed jobs ("opportunities") stored in this browser (spec §8.3).
 * Also the browser-side cache: an analysis is reused when the cache key matches (AC-A6).
 */
import type { JobDraft } from "./job.ts";
import type { Opportunity } from "./types.ts";

export const OPPORTUNITIES_STORAGE_KEY = "jobmatch.opportunities";
export const JOB_DRAFT_STORAGE_KEY = "jobmatch.jobDraft";
/** Keep browser storage small: oldest analysed-only items are removed first. */
export const MAX_OPPORTUNITIES = 50;

const listeners = new Set<() => void>();

/** Parse stored data safely: anything broken is ignored instead of crashing the page. */
export function parseOpportunities(raw: string | null): Opportunity[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (o): o is Opportunity =>
        !!o &&
        typeof o === "object" &&
        typeof o.id === "string" &&
        typeof o.inputHash === "string" &&
        typeof o.jobDescription === "string" &&
        !!o.analysis &&
        Array.isArray(o.analysis.requirements),
    );
  } catch {
    return [];
  }
}

export function readOpportunitiesRaw(): string | null {
  try {
    return window.localStorage.getItem(OPPORTUNITIES_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function findByCacheKey(list: Opportunity[], inputHash: string): Opportunity | undefined {
  return list.find((o) => o.inputHash === inputHash);
}

/** Newest first; prune the oldest items the user hasn't saved or applied to. */
export function addOpportunity(list: Opportunity[], item: Opportunity, max = MAX_OPPORTUNITIES): Opportunity[] {
  const next = [item, ...list.filter((o) => o.id !== item.id)];
  while (next.length > max) {
    const idx = next.findLastIndex((o) => o.status === "analysed");
    next.splice(idx === -1 ? next.length - 1 : idx, 1);
  }
  return next;
}

/** Saves an analysed job. Returns false if the browser refused (storage full or blocked). */
export function storeOpportunity(item: Opportunity): boolean {
  const list = addOpportunity(parseOpportunities(readOpportunitiesRaw()), item);
  try {
    window.localStorage.setItem(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    return false;
  }
  listeners.forEach((l) => l());
  return true;
}

export function subscribeToOpportunities(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === OPPORTUNITIES_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function newOpportunityId(): string {
  return crypto.randomUUID();
}

/* ---- Unsent job text, kept for this browser tab so "Edit profile" doesn't lose it ---- */

export function readJobDraft(): JobDraft | null {
  try {
    const raw = window.sessionStorage.getItem(JOB_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    return { description: s(d.description), title: s(d.title), company: s(d.company), link: s(d.link) };
  } catch {
    return null;
  }
}

export function writeJobDraft(draft: JobDraft | null): void {
  try {
    if (!draft || !Object.values(draft).some((v) => v.trim())) window.sessionStorage.removeItem(JOB_DRAFT_STORAGE_KEY);
    else window.sessionStorage.setItem(JOB_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* storage blocked: the draft simply isn't kept */
  }
}
