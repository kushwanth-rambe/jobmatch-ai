/**
 * LIVE check of JobMatch Analysis against the real Gemini API.
 * Uses real API calls (small cost) — run it manually, never in `npm test`.
 *
 *   1. Start the app with GEMINI_API_KEY set:   npm run build && npm start
 *   2. In another terminal:                     npm run check:live
 *
 * What it does:
 *   - confirms the configured model is available for your key (no cost),
 *   - analyses the five sample job descriptions in tests/fixtures/sample-jds
 *     through the app's own /api/analyze route,
 *   - sends one text that is NOT a job description (expects it to be rejected),
 *   - prints quality checks plus MEASURED tokens and cost per analysis.
 * The API key is read from the environment and is never printed.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { containsPrediction } from "../lib/analysis/postprocess.ts";
import type { Analysis } from "../lib/types.ts";

const BASE = process.env.CHECK_BASE_URL ?? "http://localhost:3000";
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite";
const OUT = process.env.CHECK_OUT ?? "live-check-results.json";

/** A realistic test profile (fictional). */
const PROFILE = {
  currentRole: "Senior Business Analyst",
  targetRole: "Product Manager",
  yearsExperience: 6,
  skills: ["SQL", "Jira", "Confluence", "Stakeholder management", "Requirements gathering", "User stories", "A/B testing", "Excel", "Process mapping", "Agile / Scrum"],
  preferredLocations: ["Bengaluru", "Pune"],
  workModes: ["hybrid", "remote"],
  experienceHighlights:
    "6 years as a business analyst in fintech and e-commerce. Led requirements and UAT for a payments app used by 2 million customers. Ran A/B tests on checkout with the growth team. Wrote user stories and acceptance criteria and supported backlog refinement for two Scrum teams.",
};

const NOT_A_JOB = `City council approves new cycle lanes. The city council voted on Tuesday to approve a network of protected cycle lanes across the central district. Supporters said the plan would reduce traffic and improve air quality, while some shop owners raised concerns about parking. Construction is expected to begin next spring and take about eighteen months. The council will hold three public meetings to gather feedback on the final route, and residents can also comment online until the end of the month. A spokesperson said the project would be funded by a regional transport grant.`;

type Row = Record<string, string | number | boolean | null>;

async function checkModel(): Promise<void> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    console.log("Model check skipped: GEMINI_API_KEY is not set in this terminal.");
    return;
  }
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`, {
    headers: { "x-goog-api-key": key },
  });
  if (!res.ok) {
    console.log(`Model check: "${MODEL}" is NOT available for this key (HTTP ${res.status}).`);
    process.exitCode = 1;
    return;
  }
  const m = (await res.json()) as { name?: string; displayName?: string; inputTokenLimit?: number; outputTokenLimit?: number };
  console.log(`Model check: ${m.name} (${m.displayName}) is available — input limit ${m.inputTokenLimit}, output limit ${m.outputTokenLimit} tokens.`);
}

async function analyse(description: string) {
  const started = Date.now();
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile: PROFILE, job: { description, title: "", company: "", link: "" } }),
  });
  const data = await res.json();
  return { status: res.status, data, ms: Date.now() - started };
}

function qualityChecks(a: Analysis): Row {
  const matched = a.requirements.filter((r) => r.status === "matched");
  const commentary = [a.summary, a.experienceAlignment.explanation, a.locationAlignment.explanation, ...a.requirements.map((r) => r.note ?? ""), ...a.toClarify.map((c) => c.reason)];
  return {
    requirements: a.requirements.length,
    mustHaves: a.mustHaveTotal,
    niceToHaves: a.niceToHaveTotal,
    matched: matched.length,
    unproven: a.requirements.filter((r) => r.status === "unproven").length,
    missing: a.requirements.filter((r) => r.status === "missing").length,
    toClarify: a.toClarify.length,
    experience: a.experienceAlignment.status,
    alignment: a.alignmentLevel,
    groundingDowngrades: a.groundingDowngrades,
    allMatchesHaveEvidence: matched.every((r) => !!r.profileEvidence),
    allRequirementsQuoteJd: a.requirements.every((r) => r.jdEvidence.length > 0),
    noPredictionLanguage: commentary.every((t) => !containsPrediction(t)),
    hasSummary: a.summary.length > 20,
  };
}

async function main() {
  await checkModel();
  const dir = new URL("../tests/fixtures/sample-jds/", import.meta.url);
  const files = (await readdir(dir)).filter((f) => f.endsWith(".txt")).sort();
  const rows: Row[] = [];
  const details: unknown[] = [];
  let totalCost = 0;
  let totalIn = 0;
  let totalOut = 0;

  for (const file of files) {
    const { status, data, ms } = await analyse(await readFile(new URL(file, dir), "utf8"));
    if (status !== 200) {
      rows.push({ file, status, error: data.error ?? "unknown", ms });
      continue;
    }
    const u = data.meta.usage;
    totalCost += data.meta.costUsd ?? 0;
    totalIn += u.inputTokens;
    totalOut += u.outputTokens + u.thinkingTokens;
    rows.push({ file, status, ms, calls: data.meta.calls, inTok: u.inputTokens, outTok: u.outputTokens, thinkTok: u.thinkingTokens, costUsd: data.meta.costUsd, ...qualityChecks(data.analysis) });
    details.push({ file, analysis: data.analysis, meta: data.meta });
  }

  const notJob = await analyse(NOT_A_JOB);
  rows.push({ file: "not-a-job-description", status: notJob.status, error: notJob.data.error ?? null, ms: notJob.ms, rejectedAsExpected: notJob.status === 422 || notJob.status === 400 });

  console.table(rows);
  const ok = rows.filter((r) => r.status === 200).length;
  console.log(`\n${ok}/${files.length} sample analyses succeeded.`);
  console.log(`Measured tokens: ${totalIn} input, ${totalOut} output incl. thinking.`);
  console.log(`Measured cost (published ${MODEL} paid-tier prices): $${totalCost.toFixed(6)} total, $${(totalCost / Math.max(ok, 1)).toFixed(6)} per analysis.`);
  await writeFile(OUT, JSON.stringify({ model: MODEL, ranAt: new Date().toISOString(), rows, details }, null, 2));
  console.log(`Full results saved to ${OUT} (not committed).`);
}

main().catch((e) => {
  console.error("Live check failed:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
