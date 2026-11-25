/**
 * POST /api/analyze behaviour, tested through the plain handler with a
 * stand-in Gemini (no network, no cost). Covers the missing-key case,
 * bad input, oversized input, API failures and the no-content logging rule.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { USER_MESSAGES, handleAnalyzeRequest, type AnalyzeDeps } from "../lib/analysis/handler.ts";
import { AnalysisError, type GenerateFn } from "../lib/analysis/run.ts";
import { JD, PROFILE, USAGE, aiReply } from "./helpers.mts";

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ profile: PROFILE, job: { description: JD, title: "", company: "", link: "" }, ...overrides });

const post = (raw: string) => new Request("http://localhost/api/analyze", { method: "POST", body: raw, headers: { "content-type": "application/json" } });

function deps(generate: GenerateFn, extra: Partial<AnalyzeDeps> = {}) {
  const logs: Record<string, unknown>[] = [];
  let made = 0;
  return {
    logs,
    made: () => made,
    deps: {
      apiKey: "test-key",
      model: "gemini-3.1-flash-lite",
      makeGenerate: () => {
        made += 1;
        return generate;
      },
      log: (e: Record<string, unknown>) => logs.push(e),
      ...extra,
    } satisfies AnalyzeDeps,
  };
}

const goodGenerate: GenerateFn = async () => ({ text: JSON.stringify(aiReply()), usage: USAGE });

describe("POST /api/analyze", () => {
  it("returns the analysis with measured token usage and cost", async () => {
    const d = deps(goodGenerate);
    const res = await handleAnalyzeRequest(post(body()), d.deps);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.analysis.alignmentLevel, "strong");
    assert.equal(data.meta.calls, 1);
    assert.deepEqual(data.meta.usage, USAGE);
    assert.equal(typeof data.meta.costUsd, "number");
  });

  it("works safely without an API key: clear 503 message and no AI call", async () => {
    const d = deps(goodGenerate, { apiKey: null });
    const res = await handleAnalyzeRequest(post(body()), d.deps);
    assert.equal(res.status, 503);
    const data = await res.json();
    assert.equal(data.error, "not_configured");
    assert.equal(data.message, USER_MESSAGES.not_configured);
    assert.equal(d.made(), 0);
  });

  it("rejects an invalid job description before calling the AI (400)", async () => {
    const d = deps(goodGenerate);
    const res = await handleAnalyzeRequest(post(body({ job: { description: "too short" } })), d.deps);
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /too short/);
    assert.equal(d.made(), 0);
  });

  it("rejects an incomplete profile (400)", async () => {
    const d = deps(goodGenerate);
    const res = await handleAnalyzeRequest(post(body({ profile: { ...PROFILE, skills: ["SQL"] } })), d.deps);
    assert.equal(res.status, 400);
    assert.match((await res.json()).message, /profile/i);
  });

  it("rejects broken JSON (400) and oversized requests (413)", async () => {
    const d = deps(goodGenerate);
    assert.equal((await handleAnalyzeRequest(post("{oops"), d.deps)).status, 400);
    assert.equal((await handleAnalyzeRequest(post("x".repeat(41_000)), d.deps)).status, 413);
    assert.equal(d.made(), 0);
  });

  it("maps AI failures to friendly messages", async () => {
    const cases: [string, number][] = [
      ["ai_timeout", 504],
      ["ai_rate_limited", 429],
      ["ai_unavailable", 502],
      ["not_configured", 503],
    ];
    for (const [code, status] of cases) {
      const d = deps(async () => {
        throw new AnalysisError(code as never);
      });
      const res = await handleAnalyzeRequest(post(body()), d.deps);
      assert.equal(res.status, status, code);
      const data = await res.json();
      assert.equal(data.error, code);
      assert.ok(data.message.length > 10);
    }
  });

  it("returns 422 when the text is not a job description", async () => {
    const d = deps(async () => ({ text: JSON.stringify(aiReply({ is_job_description: false })), usage: USAGE }));
    const res = await handleAnalyzeRequest(post(body()), d.deps);
    assert.equal(res.status, 422);
  });

  it("returns 502 after two unusable AI replies", async () => {
    const d = deps(async () => ({ text: "{broken", usage: USAGE }));
    const res = await handleAnalyzeRequest(post(body()), d.deps);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).error, "invalid_ai_response");
  });

  it("never logs the profile, the job description, the AI text or the key", async () => {
    const d = deps(goodGenerate);
    await handleAnalyzeRequest(post(body()), d.deps);
    const logged = JSON.stringify(d.logs);
    assert.equal(d.logs.length, 1);
    for (const secret of ["Stakeholder management", "payments platform", "growth team", "test-key", "align well"]) {
      assert.equal(logged.includes(secret), false, `log contains "${secret}"`);
    }
    assert.equal(d.logs[0].outcome, "ok");
    assert.equal(d.logs[0].inputTokens, USAGE.inputTokens);
  });

  it("never returns the API key in any response", async () => {
    for (const d of [deps(goodGenerate), deps(goodGenerate, { apiKey: null })]) {
      const text = await (await handleAnalyzeRequest(post(body()), d.deps)).text();
      assert.equal(text.includes("test-key"), false);
    }
  });
});
