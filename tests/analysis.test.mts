/**
 * JobMatch Analysis: app-code checks (spec §6.5, AC-A2–A5, AC-A7, AC-N5).
 * Gemini is replaced by a stand-in function, so no API calls or costs.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { costUsd } from "../lib/analysis/cost.ts";
import { alignmentLevel, containsPrediction, isGrounded, postProcess } from "../lib/analysis/postprocess.ts";
import { SYSTEM_INSTRUCTION, buildUserContent } from "../lib/analysis/prompt.ts";
import { AnalysisError, parseAiReply, runAnalysis, type GenerateFn } from "../lib/analysis/run.ts";
import { geminiResponseSchema } from "../lib/analysis/schema.ts";
import { JD, PROFILE, USAGE, aiReply } from "./helpers.mts";

const ctx = { profile: PROFILE, jobDescription: JD, model: "gemini-3.1-flash-lite", promptVersion: "test" };

function ok(result: ReturnType<typeof postProcess>) {
  assert.ok(result.ok, "expected a successful analysis");
  return result.analysis;
}

describe("alignment rule (AC-A5)", () => {
  it("uses the documented thresholds", () => {
    assert.equal(alignmentLevel(3, 4, "meets"), "strong"); // 75%
    assert.equal(alignmentLevel(3, 4, "below"), "partial"); // strong coverage, experience below
    assert.equal(alignmentLevel(2, 5, "meets"), "partial"); // 40%
    assert.equal(alignmentLevel(1, 3, "exceeds"), "limited"); // 33%
    assert.equal(alignmentLevel(0, 0, "meets"), "limited");
  });
  it("gives the same result for the same input", () => {
    const a = ok(postProcess(aiReply(), ctx));
    const b = ok(postProcess(aiReply(), ctx));
    assert.equal(a.alignmentLevel, b.alignmentLevel);
    assert.deepEqual(a.requirements, b.requirements);
  });
  it("counts must-haves and nice-to-haves separately", () => {
    const a = ok(postProcess(aiReply(), ctx));
    assert.equal(a.mustHaveTotal, 4);
    assert.equal(a.mustHaveMatched, 3);
    assert.equal(a.niceToHaveTotal, 1);
    assert.equal(a.niceToHaveMatched, 0);
    assert.equal(a.alignmentLevel, "strong");
  });
  it("falls back to all requirements when the job lists no must-haves", () => {
    const reply = aiReply();
    reply.requirements = reply.requirements.map((r) => ({ ...r, importance: "nice_to_have" as const }));
    const a = ok(postProcess(reply, ctx));
    assert.equal(a.mustHaveTotal, 0);
    assert.equal(a.alignmentLevel, "partial"); // 3 of 5 listed requirements
  });
});

describe("grounding check — never invent qualifications (AC-A2)", () => {
  it("accepts evidence copied from the profile", () => {
    assert.ok(isGrounded("Stakeholder management", PROFILE));
    assert.ok(isGrounded("ran A/B tests with the growth team", PROFILE));
    assert.ok(isGrounded("6 years", PROFILE));
  });
  it("rejects evidence that is not in the profile", () => {
    assert.equal(isGrounded("Python and machine learning", PROFILE), false);
    assert.equal(isGrounded("Owned the product roadmap at a fintech", PROFILE), false);
    assert.equal(isGrounded("10 years", PROFILE), false);
    assert.equal(isGrounded(null, PROFILE), false);
  });
  it("moves an AI 'matched' item without real profile evidence to 'unproven'", () => {
    const reply = aiReply();
    reply.requirements[0] = { ...reply.requirements[0], requirement: "Python", jd_evidence: "Strong SQL skills", profile_evidence: "Python expert" };
    const a = ok(postProcess(reply, ctx));
    const item = a.requirements.find((r) => r.requirement === "Python");
    assert.equal(item?.status, "unproven");
    assert.equal(item?.profileEvidence, null);
    assert.equal(a.groundingDowngrades, 1);
    assert.equal(a.mustHaveMatched, 2);
  });
  it("never shows profile evidence for a missing requirement", () => {
    const reply = aiReply();
    reply.requirements[4] = { ...reply.requirements[4], profile_evidence: "SQL" };
    assert.equal(ok(postProcess(reply, ctx)).requirements[4].profileEvidence, null);
  });
  it("drops requirements whose quote does not come from the job description (AC-A3)", () => {
    const reply = aiReply();
    reply.requirements.push({ requirement: "Kubernetes", category: "tool", importance: "must_have", jd_evidence: "Kubernetes clusters", status: "missing", profile_evidence: null, note: null });
    const a = ok(postProcess(reply, ctx));
    assert.equal(a.requirements.some((r) => r.requirement === "Kubernetes"), false);
  });
  it("removes duplicates and keeps at most 15 requirements", () => {
    const reply = aiReply();
    reply.requirements = Array.from({ length: 25 }, (_, i) => ({ ...reply.requirements[0], requirement: `SQL ${i % 20}` }));
    assert.equal(ok(postProcess(reply, ctx)).requirements.length, 15);
  });
});

describe("no hiring predictions (AC-A4)", () => {
  it("detects prediction language and percentages", () => {
    for (const t of ["You have an 85% chance", "high likelihood of success", "You will get the job", "probability of an offer", "70% match"]) {
      assert.ok(containsPrediction(t), t);
    }
    assert.equal(containsPrediction("Your SQL experience aligns well with this role."), false);
  });
  it("replaces a summary that predicts hiring with a neutral, count-based one", () => {
    const a = ok(postProcess(aiReply({ summary: "You have a 90% chance of being hired." }), ctx));
    assert.equal(containsPrediction(a.summary), false);
    assert.match(a.summary, /3 of 4 must-have requirements/);
  });
  it("cleans prediction wording in explanations and notes too", () => {
    const reply = aiReply({ experience_alignment: { status: "meets", explanation: "Good odds given 6 years." } });
    const a = ok(postProcess(reply, ctx));
    assert.equal(containsPrediction(a.experienceAlignment.explanation), false);
  });
  it("the prompt forbids predictions and invented qualifications", () => {
    assert.match(SYSTEM_INSTRUCTION, /NEVER predict or speculate about hiring outcomes/);
    assert.match(SYSTEM_INSTRUCTION, /NEVER assume, infer or invent/);
  });
});

describe("not a job description (AC-J4)", () => {
  it("is rejected when the AI says so", () => {
    assert.deepEqual(postProcess(aiReply({ is_job_description: false }), ctx), { ok: false, reason: "not_job_description" });
  });
  it("is rejected when no requirement can be traced to the text", () => {
    const reply = aiReply();
    reply.requirements = [{ ...reply.requirements[0], requirement: "Rust", jd_evidence: "Rust compilers" }];
    assert.equal(postProcess(reply, ctx).ok, false);
  });
});

describe("prompt and schema", () => {
  it("sends only work-related profile fields, wrapped as data", () => {
    const content = buildUserContent(PROFILE, { description: JD, titleHint: null, companyHint: null });
    assert.match(content, /<PROFILE>[\s\S]*<\/PROFILE>/);
    assert.match(content, /<JOB_DESCRIPTION>[\s\S]*<\/JOB_DESCRIPTION>/);
    assert.equal(/updatedAt|email|name"/.test(content), false);
  });
  it("produces a JSON schema for Gemini with every required field", () => {
    const schema = geminiResponseSchema();
    assert.equal(schema.type, "object");
    assert.equal("$schema" in schema, false);
    assert.deepEqual(
      [...(schema.required as string[])].sort(),
      ["experience_alignment", "is_job_description", "job", "location_alignment", "requirements", "summary", "to_clarify"],
    );
  });
  it("parseAiReply rejects broken or wrongly shaped replies", () => {
    assert.equal(parseAiReply(undefined), null);
    assert.equal(parseAiReply("{not json"), null);
    assert.equal(parseAiReply(JSON.stringify({ summary: "hi" })), null);
    assert.ok(parseAiReply(JSON.stringify(aiReply())));
  });
});

describe("runAnalysis — one call per analysis (AC-N5, AC-A7)", () => {
  const job = { description: JD, title: null, company: null, link: null };
  const fake = (replies: (string | Error)[]) => {
    let calls = 0;
    const generate: GenerateFn = async () => {
      const r = replies[calls++];
      if (r instanceof Error) throw r;
      return { text: r, usage: USAGE };
    };
    return { generate, calls: () => calls };
  };

  it("makes exactly one call when the reply is valid", async () => {
    const f = fake([JSON.stringify(aiReply())]);
    const result = await runAnalysis({ profile: PROFILE, job, model: "m", generate: f.generate });
    assert.equal(f.calls(), 1);
    assert.equal(result.calls, 1);
    assert.deepEqual(result.usage, USAGE);
    assert.equal(result.analysis.model, "m");
  });
  it("retries once when the first reply is unusable, and adds up token usage", async () => {
    const f = fake(["{broken", JSON.stringify(aiReply())]);
    const result = await runAnalysis({ profile: PROFILE, job, model: "m", generate: f.generate });
    assert.equal(f.calls(), 2);
    assert.equal(result.usage.inputTokens, 2000);
  });
  it("stops after two unusable replies with a clear error", async () => {
    const f = fake(["{broken", "{still broken", JSON.stringify(aiReply())]);
    await assert.rejects(runAnalysis({ profile: PROFILE, job, model: "m", generate: f.generate }), (e: AnalysisError) => e.code === "invalid_ai_response");
    assert.equal(f.calls(), 2);
  });
  it("does not retry on API errors (e.g. timeout) — no extra cost", async () => {
    const f = fake([new AnalysisError("ai_timeout"), JSON.stringify(aiReply())]);
    await assert.rejects(runAnalysis({ profile: PROFILE, job, model: "m", generate: f.generate }), (e: AnalysisError) => e.code === "ai_timeout");
    assert.equal(f.calls(), 1);
  });
  it("reports 'not a job description' without retrying", async () => {
    const f = fake([JSON.stringify(aiReply({ is_job_description: false }))]);
    await assert.rejects(runAnalysis({ profile: PROFILE, job, model: "m", generate: f.generate }), (e: AnalysisError) => e.code === "not_job_description");
    assert.equal(f.calls(), 1);
  });
});

describe("cost from measured tokens", () => {
  it("uses the published Gemini 3.1 Flash-Lite prices (thinking billed as output)", () => {
    // 1,000 input × $0.25/M + (500 + 100) output × $1.50/M
    assert.equal(costUsd("gemini-3.1-flash-lite", USAGE), 0.00025 + 0.0009);
  });
  it("returns null (not a guess) for a model without a listed price", () => {
    assert.equal(costUsd("some-other-model", USAGE), null);
  });
});

describe("m2-v2 refinements", () => {
  const job = { description: JD, title: null, company: null, link: null };
  it("retries once, after a short pause, when Google is briefly overloaded", async () => {
    let calls = 0;
    const pauses: number[] = [];
    const generate: GenerateFn = async () => {
      calls += 1;
      if (calls === 1) throw new AnalysisError("ai_unavailable", "Gemini HTTP 503");
      return { text: JSON.stringify(aiReply()), usage: USAGE };
    };
    const result = await runAnalysis({ profile: PROFILE, job, model: "m", generate, sleep: async (ms) => void pauses.push(ms) });
    assert.equal(calls, 2);
    assert.equal(result.calls, 2);
    assert.deepEqual(result.usage, USAGE, "the failed call used no tokens");
    assert.deepEqual(pauses, [1500]);
  });
  it("does not retry a slow failure (keeps the request inside its time limit)", async () => {
    let t = 0;
    let calls = 0;
    const generate: GenerateFn = async () => {
      calls += 1;
      t += 20_000;
      throw new AnalysisError("ai_unavailable", "Gemini HTTP 504");
    };
    await assert.rejects(
      runAnalysis({ profile: PROFILE, job, model: "m", generate, now: () => t, sleep: async () => {} }),
      (e: AnalysisError) => e.code === "ai_unavailable",
    );
    assert.equal(calls, 1);
  });
  it("gives up after the retry if Google is still overloaded", async () => {
    let calls = 0;
    const generate: GenerateFn = async () => {
      calls += 1;
      throw new AnalysisError("ai_unavailable", "Gemini HTTP 503");
    };
    await assert.rejects(runAnalysis({ profile: PROFILE, job, model: "m", generate, sleep: async () => {} }));
    assert.equal(calls, 2);
  });
  it("treats speculation about candidacy or the employer's willingness as prediction language", () => {
    assert.ok(containsPrediction("Successful candidacy would depend on training."));
    assert.ok(containsPrediction("It depends on the company's willingness to train you."));
    assert.ok(containsPrediction("You may not be shortlisted."));
    assert.equal(containsPrediction("Your SQL and A/B testing experience line up with the job."), false);
  });
  it("shortens long text at a full sentence instead of mid-sentence", async () => {
    const { truncate } = await import("../lib/analysis/postprocess.ts");
    const text = "Your SQL lines up well. Your A/B testing lines up too. The main gap is roadmap ownership and analytics tools like Amplitude.";
    assert.equal(truncate(text, 60), "Your SQL lines up well. Your A/B testing lines up too.");
  });
});
