/**
 * Analysed jobs ("opportunities") stored in this browser (spec §8.3).
 * Also the browser-side cache: an analysis is reused when the cache key matches (AC-A6).
 */
import type { JobDraft } from "./job.ts";
import type { Opportunity, OpportunityStatus } from "./types.ts";

export const OPPORTUNITIES_STORAGE_KEY = "jobmatch.opportunities";
export const JOB_DRAFT_STORAGE_KEY = "jobmatch.jobDraft";
/** Keep browser storage small. Only analysed-only jobs are ever removed to make room. */
export const MAX_OPPORTUNITIES = 50;

const listeners = new Set<() => void>();

const STATUSES: OpportunityStatus[] = ["analysed", "saved", "applied"];

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
    ).map((o) =>
      STATUSES.includes(o.status)
        ? { ...o, appliedAt: o.status === "applied" && typeof o.appliedAt === "string" ? o.appliedAt : null }
        : { ...o, status: "analysed", appliedAt: null },
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

/** Jobs the user chose to keep. These are never removed automatically. */
export function isKept(o: Opportunity): boolean {
  return o.status === "saved" || o.status === "applied";
}

export function keptCount(list: Opportunity[]): number {
  return list.filter(isKept).length;
}

/** Show a "nearly full" warning from this many kept jobs. */
export const NEAR_LIMIT = MAX_OPPORTUNITIES - 5;

/**
 * True when a new analysis can be stored: there is a free slot, or an
 * analysed-only (not saved, not applied) job that can make room.
 */
export function hasRoomForNew(list: Opportunity[], max = MAX_OPPORTUNITIES): boolean {
  return list.length < max || list.some((o) => !isKept(o));
}

export type AddResult = { ok: true; list: Opportunity[] } | { ok: false; reason: "full" };

/**
 * Newest first. To make room, only the oldest analysed-only jobs are removed.
 * Saved and Applied jobs are never removed: if only those are left, the add is refused
 * so the user can decide what to delete.
 */
export function addOpportunity(list: Opportunity[], item: Opportunity, max = MAX_OPPORTUNITIES): AddResult {
  const next = [item, ...list.filter((o) => o.id !== item.id)];
  while (next.length > max) {
    const idx = next.findLastIndex((o, i) => i > 0 && !isKept(o));
    if (idx === -1) return { ok: false, reason: "full" };
    next.splice(idx, 1);
  }
  return { ok: true, list: next };
}

/** Changes one job's status. Returns null if the job isn't in the list. */
export function setOpportunityStatus(
  list: Opportunity[],
  id: string,
  status: OpportunityStatus,
  options: { now?: Date; appliedAt?: string | null } = {},
): Opportunity[] | null {
  if (!list.some((o) => o.id === id)) return null;
  const appliedAt = status === "applied" ? (options.appliedAt ?? (options.now ?? new Date()).toISOString()) : null;
  return list.map((o) => (o.id === id ? { ...o, status, appliedAt } : o));
}

/** Removes one job. Returns null if the job isn't in the list. */
export function removeFromList(list: Opportunity[], id: string): Opportunity[] | null {
  return list.some((o) => o.id === id) ? list.filter((o) => o.id !== id) : null;
}

export type StoreResult = { ok: true } | { ok: false; reason: "full" | "storage_error" | "not_found" };

function writeOpportunities(list: Opportunity[]): boolean {
  try {
    window.localStorage.setItem(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    return false; // storage full (quota) or blocked
  }
  listeners.forEach((l) => l());
  return true;
}

const current = () => parseOpportunities(readOpportunitiesRaw());

/** Stores a newly analysed job. */
export function storeOpportunity(item: Opportunity): StoreResult {
  const result = addOpportunity(current(), item);
  if (!result.ok) return result;
  return writeOpportunities(result.list) ? { ok: true } : { ok: false, reason: "storage_error" };
}

/** Save / Mark as applied / Undo. */
export function updateOpportunityStatus(id: string, status: OpportunityStatus, appliedAt?: string | null): StoreResult {
  const next = setOpportunityStatus(current(), id, status, { appliedAt });
  if (!next) return { ok: false, reason: "not_found" };
  return writeOpportunities(next) ? { ok: true } : { ok: false, reason: "storage_error" };
}

/** Deletes one job (after the user confirmed). */
export function deleteOpportunity(id: string): StoreResult {
  const next = removeFromList(current(), id);
  if (!next) return { ok: false, reason: "not_found" };
  return writeOpportunities(next) ? { ok: true } : { ok: false, reason: "storage_error" };
}

/** Removes every analysed job and the unsent job text from this browser. */
export function clearOpportunities(): boolean {
  try {
    window.localStorage.removeItem(OPPORTUNITIES_STORAGE_KEY);
    window.sessionStorage.removeItem(JOB_DRAFT_STORAGE_KEY);
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
