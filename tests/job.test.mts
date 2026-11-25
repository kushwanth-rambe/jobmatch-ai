/** Add Job Description input rules and the analysis cache key (AC-J1, AC-J1a, AC-J4, AC-A6). */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROMPT_VERSION } from "../lib/analysis/prompt.ts";
import { analysisCacheKey, checkLink, countWords, normaliseForAnalysis, validateJobDraft } from "../lib/job.ts";
import { JD, PROFILE } from "./helpers.mts";

const draft = (description: string, extra = {}) => ({ description, title: "", company: "", link: "", ...extra });

describe("validateJobDraft", () => {
  it("accepts a full job description and keeps the original text", () => {
    const { job, errors } = validateJobDraft(draft(`  ${JD}  `));
    assert.deepEqual(errors, {});
    assert.equal(job?.description, JD);
    assert.equal(job?.link, null);
  });
  it("rejects empty text", () => {
    assert.match(validateJobDraft(draft("")).errors.description ?? "", /Paste the job description/);
  });
  it("rejects text under 300 characters", () => {
    assert.match(validateJobDraft(draft("Product Manager. SQL required.")).errors.description ?? "", /too short/);
  });
  it("rejects text over 15,000 characters", () => {
    assert.match(validateJobDraft(draft("word ".repeat(3100))).errors.description ?? "", /longer than 15,000/);
  });
  it("rejects a pasted link instead of the description", () => {
    assert.match(validateJobDraft(draft("https://www.linkedin.com/jobs/view/123456")).errors.description ?? "", /not the link/);
  });
  it("rejects long text that has too few words (e.g. a code or ID dump)", () => {
    assert.match(validateJobDraft(draft("x".repeat(400))).errors.description ?? "", /doesn't look like a job description/);
  });
  it("accepts an https job link and rejects other links (AC-J1a)", () => {
    assert.equal(validateJobDraft(draft(JD, { link: "https://jobs.example.com/pm/1" })).job?.link, "https://jobs.example.com/pm/1");
    assert.ok(validateJobDraft(draft(JD, { link: "http://jobs.example.com/pm/1" })).errors.link);
    assert.ok(validateJobDraft(draft(JD, { link: "javascript:alert(1)" })).errors.link);
    assert.ok(validateJobDraft(draft(JD, { link: "not a link" })).errors.link);
  });
  it("limits title and company length", () => {
    assert.ok(validateJobDraft(draft(JD, { title: "x".repeat(121) })).errors.title);
    assert.ok(validateJobDraft(draft(JD, { company: "x".repeat(121) })).errors.company);
  });
});

describe("helpers", () => {
  it("counts words", () => assert.equal(countWords("Senior PM, 5+ years; SQL & A/B tests."), 7));
  it("checkLink allows an empty link", () => assert.deepEqual(checkLink("  "), { link: null }));
  it("normalises spacing without changing words", () => {
    assert.equal(normaliseForAnalysis("A\t\tB  \r\n\r\n\r\n\r\nC"), "A B\n\nC");
  });
});

describe("analysisCacheKey (AC-A6)", () => {
  it("is identical for identical profile + job text (ignoring spacing, case and save time)", async () => {
    const a = await analysisCacheKey({ ...PROFILE, updatedAt: "2026-01-01" }, JD, PROMPT_VERSION);
    const b = await analysisCacheKey({ ...PROFILE, updatedAt: "2026-02-02" }, `\n${JD.toUpperCase()}   \n`, PROMPT_VERSION);
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });
  it("changes when the profile, the job text or the prompt version changes", async () => {
    const base = await analysisCacheKey(PROFILE, JD, PROMPT_VERSION);
    assert.notEqual(base, await analysisCacheKey({ ...PROFILE, skills: [...PROFILE.skills, "Figma"] }, JD, PROMPT_VERSION));
    assert.notEqual(base, await analysisCacheKey(PROFILE, JD + " Python required.", PROMPT_VERSION));
    assert.notEqual(base, await analysisCacheKey(PROFILE, JD, "other-version"));
  });
});

describe("sample job descriptions (tests/fixtures/sample-jds)", () => {
  it("all five pass the Add Job input checks", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const dir = new URL("./fixtures/sample-jds/", import.meta.url);
    const files = (await readdir(dir)).filter((f) => f.endsWith(".txt"));
    assert.equal(files.length, 5);
    for (const f of files) {
      const { errors } = validateJobDraft(draft(await readFile(new URL(f, dir), "utf8")));
      assert.deepEqual(errors, {}, f);
    }
  });
});
