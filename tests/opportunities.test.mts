/** Browser storage of analysed jobs and cache lookup (AC-A6, spec §8.3). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postProcess } from "../lib/analysis/postprocess.ts";
import { addOpportunity, findByCacheKey, parseOpportunities } from "../lib/opportunities.ts";
import type { Opportunity } from "../lib/types.ts";
import { JD, PROFILE, aiReply } from "./helpers.mts";

const result = postProcess(aiReply(), { profile: PROFILE, jobDescription: JD, model: "m", promptVersion: "v" });
assert.ok(result.ok);
const analysis = result.analysis;

const opp = (id: string, status: Opportunity["status"] = "analysed"): Opportunity => ({
  id,
  jobTitle: "PM",
  company: null,
  location: null,
  sourceUrl: null,
  sourceType: "paste",
  status,
  appliedAt: null,
  inputHash: `hash-${id}`,
  jobDescription: JD,
  profileSnapshot: PROFILE,
  analysis,
  createdAt: "2026-11-25T00:00:00.000Z",
});

describe("opportunities", () => {
  it("round-trips through JSON and keeps the original job description", () => {
    const list = parseOpportunities(JSON.stringify([opp("a")]));
    assert.equal(list.length, 1);
    assert.equal(list[0].jobDescription, JD);
  });
  it("ignores broken or incomplete stored data safely", () => {
    assert.deepEqual(parseOpportunities(null), []);
    assert.deepEqual(parseOpportunities("{broken"), []);
    assert.deepEqual(parseOpportunities(JSON.stringify({ not: "a list" })), []);
    assert.equal(parseOpportunities(JSON.stringify([opp("a"), { id: "b" }])).length, 1);
  });
  it("finds a previous analysis by cache key", () => {
    const list = [opp("a"), opp("b")];
    assert.equal(findByCacheKey(list, "hash-b")?.id, "b");
    assert.equal(findByCacheKey(list, "hash-z"), undefined);
  });
  it("adds newest first and replaces an item with the same id", () => {
    const list = addOpportunity(addOpportunity([], opp("a")), opp("b"));
    assert.deepEqual(list.map((o) => o.id), ["b", "a"]);
    assert.equal(addOpportunity(list, opp("a")).length, 2);
  });
  it("prunes the oldest analysed-only item first, keeping saved or applied jobs", () => {
    const list = [opp("new"), opp("saved", "saved"), opp("old"), opp("applied", "applied")];
    const pruned = addOpportunity(list.slice(1), list[0], 3);
    assert.deepEqual(pruned.map((o) => o.id), ["new", "saved", "applied"]);
  });
});
