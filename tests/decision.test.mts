/** M3: Application Decision, My Opportunities, storage limit and "Clear this device" (spec §5.4). */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { postProcess } from "../lib/analysis/postprocess.ts";
import {
  JOB_DRAFT_STORAGE_KEY,
  MAX_OPPORTUNITIES,
  OPPORTUNITIES_STORAGE_KEY,
  addOpportunity,
  clearOpportunities,
  deleteOpportunity,
  hasRoomForNew,
  keptCount,
  parseOpportunities,
  removeFromList,
  setOpportunityStatus,
  storeOpportunity,
  subscribeToOpportunities,
  updateOpportunityStatus,
} from "../lib/opportunities.ts";
import { PROFILE_STORAGE_KEY, clearProfile } from "../lib/profile.ts";
import type { Opportunity } from "../lib/types.ts";
import { JD, PROFILE, aiReply } from "./helpers.mts";

const result = postProcess(aiReply(), { profile: PROFILE, jobDescription: JD, model: "m", promptVersion: "v" });
assert.ok(result.ok);
const analysis = result.analysis;

const opp = (id: string, status: Opportunity["status"] = "analysed", appliedAt: string | null = null): Opportunity => ({
  id,
  jobTitle: `Job ${id}`,
  company: "Acme",
  location: null,
  sourceUrl: "https://example.com/job",
  sourceType: "paste",
  status,
  appliedAt,
  inputHash: `hash-${id}`,
  jobDescription: JD,
  profileSnapshot: PROFILE,
  analysis,
  createdAt: "2026-11-25T00:00:00.000Z",
});

const NOW = new Date("2026-11-26T09:30:00.000Z");

/* ---------- A small in-memory stand-in for the browser's storage ---------- */

class MemoryStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(k: string) {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.data.set(k, v);
  }
  removeItem(k: string) {
    if (this.failWrites) throw new Error("SecurityError");
    this.data.delete(k);
  }
}

let local: MemoryStorage;
let session: MemoryStorage;
const g = globalThis as unknown as { window?: unknown };

function stored(): Opportunity[] {
  return parseOpportunities(local.getItem(OPPORTUNITIES_STORAGE_KEY));
}
function seed(list: Opportunity[]) {
  local.data.set(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(list));
}

describe("status changes (pure)", () => {
  it("Save: analysed → saved, no applied date", () => {
    const next = setOpportunityStatus([opp("a"), opp("b")], "a", "saved", { now: NOW });
    assert.equal(next?.[0].status, "saved");
    assert.equal(next?.[0].appliedAt, null);
  });
  it("Mark as applied from analysed stores today's date", () => {
    const next = setOpportunityStatus([opp("a")], "a", "applied", { now: NOW });
    assert.equal(next?.[0].status, "applied");
    assert.equal(next?.[0].appliedAt, NOW.toISOString());
  });
  it("Mark as applied from saved", () => {
    const next = setOpportunityStatus([opp("a", "saved")], "a", "applied", { now: NOW });
    assert.equal(next?.[0].status, "applied");
  });
  it("Undo restores the previous status and applied date", () => {
    const applied = setOpportunityStatus([opp("a", "saved")], "a", "applied", { now: NOW })!;
    const undone = setOpportunityStatus(applied, "a", "saved")!;
    assert.equal(undone[0].status, "saved");
    assert.equal(undone[0].appliedAt, null);
    const reapplied = setOpportunityStatus(undone, "a", "applied", { appliedAt: "2026-11-01T00:00:00.000Z" })!;
    assert.equal(reapplied[0].appliedAt, "2026-11-01T00:00:00.000Z");
  });
  it("changes only the chosen job and keeps its analysis, cache key and order", () => {
    const list = [opp("a"), opp("b"), opp("c")];
    const next = setOpportunityStatus(list, "b", "saved")!;
    assert.deepEqual(next.map((o) => o.id), ["a", "b", "c"]);
    assert.deepEqual(next[0], list[0]);
    assert.deepEqual(next[2], list[2]);
    assert.deepEqual(next[1].analysis, list[1].analysis);
    assert.equal(next[1].inputHash, list[1].inputHash);
  });
  it("returns null for an unknown job", () => {
    assert.equal(setOpportunityStatus([opp("a")], "zzz", "saved"), null);
    assert.equal(removeFromList([opp("a")], "zzz"), null);
  });
  it("removes only the chosen job", () => {
    assert.deepEqual(removeFromList([opp("a"), opp("b")], "a")?.map((o) => o.id), ["b"]);
  });
  it("reads older or damaged status values safely", () => {
    const list = parseOpportunities(
      JSON.stringify([{ ...opp("a"), status: "weird", appliedAt: "x" }, { ...opp("b"), status: "saved", appliedAt: "2026-01-01" }]),
    );
    assert.equal(list[0].status, "analysed");
    assert.equal(list[0].appliedAt, null);
    assert.equal(list[1].appliedAt, null, "only applied jobs keep an applied date");
  });
});

describe("storage limit — saved and applied jobs are never deleted automatically", () => {
  const full = (n: number, status: Opportunity["status"]) => Array.from({ length: n }, (_, i) => opp(`k${i}`, status));

  it("refuses to add when every stored job is saved or applied", () => {
    const list = [...full(2, "saved"), opp("x", "applied")];
    const r = addOpportunity(list, opp("new"), 3);
    assert.deepEqual(r, { ok: false, reason: "full" });
    assert.equal(hasRoomForNew(list, 3), false);
  });
  it("removes an analysed-only job (never a kept one) to make room", () => {
    const list = [opp("s1", "saved"), opp("old"), opp("a1", "applied")];
    assert.equal(hasRoomForNew(list, 3), true);
    const r = addOpportunity(list, opp("new"), 3);
    assert.ok(r.ok);
    assert.deepEqual(r.list.map((o) => o.id), ["new", "s1", "a1"]);
  });
  it("has room while below the limit", () => {
    assert.equal(hasRoomForNew(full(MAX_OPPORTUNITIES - 1, "saved")), true);
    assert.equal(hasRoomForNew(full(MAX_OPPORTUNITIES, "saved")), false);
  });
  it("counts kept jobs", () => {
    assert.equal(keptCount([opp("a"), opp("b", "saved"), opp("c", "applied")]), 2);
  });
});

describe("browser storage actions", () => {
  beforeEach(() => {
    local = new MemoryStorage();
    session = new MemoryStorage();
    g.window = { localStorage: local, sessionStorage: session, addEventListener() {}, removeEventListener() {} };
  });
  afterEach(() => {
    delete g.window;
  });

  it("Save persists (still saved after a reload)", () => {
    seed([opp("a")]);
    assert.deepEqual(updateOpportunityStatus("a", "saved"), { ok: true });
    assert.equal(stored()[0].status, "saved");
  });
  it("Mark as applied persists with a date", () => {
    seed([opp("a", "saved")]);
    assert.deepEqual(updateOpportunityStatus("a", "applied"), { ok: true });
    const [a] = stored();
    assert.equal(a.status, "applied");
    assert.ok(a.appliedAt && !Number.isNaN(Date.parse(a.appliedAt)));
  });
  it("tells listeners (open pages) about changes", () => {
    seed([opp("a")]);
    let calls = 0;
    const stop = subscribeToOpportunities(() => (calls += 1));
    updateOpportunityStatus("a", "saved");
    deleteOpportunity("a");
    stop();
    updateOpportunityStatus("a", "saved");
    assert.equal(calls, 2);
  });
  it("reports a blocked or full browser storage without changing anything", () => {
    seed([opp("a")]);
    local.failWrites = true;
    assert.deepEqual(updateOpportunityStatus("a", "saved"), { ok: false, reason: "storage_error" });
    assert.deepEqual(deleteOpportunity("a"), { ok: false, reason: "storage_error" });
    assert.equal(stored()[0].status, "analysed");
  });
  it("reports an unknown job", () => {
    seed([opp("a")]);
    assert.deepEqual(updateOpportunityStatus("zzz", "saved"), { ok: false, reason: "not_found" });
    assert.deepEqual(deleteOpportunity("zzz"), { ok: false, reason: "not_found" });
  });
  it("Delete removes the job everywhere it is shown", () => {
    seed([opp("a", "saved"), opp("b", "applied", NOW.toISOString())]);
    assert.deepEqual(deleteOpportunity("a"), { ok: true });
    assert.deepEqual(stored().map((o) => o.id), ["b"]);
  });
  it("refuses a new analysis when full of kept jobs, leaving storage untouched", () => {
    const kept = Array.from({ length: MAX_OPPORTUNITIES }, (_, i) => opp(`k${i}`, i % 2 ? "saved" : "applied"));
    seed(kept);
    const before = local.getItem(OPPORTUNITIES_STORAGE_KEY);
    assert.deepEqual(storeOpportunity(opp("new")), { ok: false, reason: "full" });
    assert.equal(local.getItem(OPPORTUNITIES_STORAGE_KEY), before);
  });
  it("stores a new analysis when there is room", () => {
    seed([opp("a", "saved")]);
    assert.deepEqual(storeOpportunity(opp("new")), { ok: true });
    assert.deepEqual(stored().map((o) => o.id), ["new", "a"]);
  });
  it("Clear this device deletes the profile, all jobs and the unsent job text", () => {
    seed([opp("a", "saved"), opp("b")]);
    local.data.set(PROFILE_STORAGE_KEY, "{}");
    local.data.set("unrelated.key", "kept");
    session.data.set(JOB_DRAFT_STORAGE_KEY, "{}");
    assert.equal(clearOpportunities(), true);
    assert.equal(clearProfile(), true);
    assert.equal(local.getItem(OPPORTUNITIES_STORAGE_KEY), null);
    assert.equal(local.getItem(PROFILE_STORAGE_KEY), null);
    assert.equal(session.getItem(JOB_DRAFT_STORAGE_KEY), null);
    assert.equal(local.getItem("unrelated.key"), "kept", "only JobMatch's own data is removed");
  });
  it("Clear this device reports when the browser blocks it", () => {
    local.failWrites = true;
    assert.equal(clearOpportunities(), false);
    assert.equal(clearProfile(), false);
  });
});
