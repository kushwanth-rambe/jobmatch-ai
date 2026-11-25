/**
 * App-code checks applied to every AI reply before it is shown (spec §6.5).
 * The AI classifies; this code verifies and decides the headline:
 *   - drops requirements that don't come from the job description,
 *   - grounding check: a "matched" item must cite words found in the profile,
 *     otherwise it is moved to "unproven" (never invent qualifications),
 *   - removes hiring-prediction wording,
 *   - calculates Strong / Partial / Limited alignment from the counts.
 */
import type { AlignmentLevel, Analysis, ExperienceStatus, Profile, Requirement } from "../types.ts";
import type { AiAnalysis } from "./schema.ts";

export const MAX_REQUIREMENTS = 15;
export const MAX_TO_CLARIFY = 5;

const LIMITS = {
  requirement: 80,
  jdEvidence: 150,
  profileEvidence: 120,
  note: 160,
  explanation: 240,
  summary: 400,
  clarify: 200,
  short: 80,
};

const STOPWORDS = new Set(
  `a an and are as at be been being by can could do does for from has have having in into is it its of on or our
  such than that the their them then there these this those to was were will with within without you your we us
  experience experienced years year skills skill knowledge ability abilities strong proven good great excellent solid
  work working worked team teams related relevant including include includes using use used etc plus preferred
  required requirement requirements must nice ideally least more other similar across level levels deep hands
  understanding familiarity familiar demonstrated track record background role roles candidate ideal`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lower-case meaningful words ("A/B testing" → ["testing"], "C++" stays "c++"). */
export function meaningfulTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#]+/)) {
    const t = raw.replace(/^[+#]+/, ""); // keep "c++" / "c#", drop stray leading symbols
    if (t.length < 2 || STOPWORDS.has(t)) continue;
    out.add(t);
    if (t.length > 4 && t.endsWith("s")) out.add(t.slice(0, -1)); // "dashboards" ~ "dashboard"
  }
  return out;
}

function overlaps(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

/** Words that can count as evidence: skills, highlights and current role (not the target role). */
export function profileEvidenceTokens(profile: Omit<Profile, "updatedAt">): Set<string> {
  return meaningfulTokens([profile.skills.join(" , "), profile.experienceHighlights ?? "", profile.currentRole].join(" \n "));
}

/** Share of the evidence's meaningful words needed in the profile for it to count as "from the profile". */
export const GROUNDING_THRESHOLD = 0.6;

/**
 * True when the cited evidence really comes from the profile: most of its
 * meaningful words (≥ 60%) must appear in the profile's skills, highlights or current role.
 */
export function isGrounded(evidence: string | null, profile: Omit<Profile, "updatedAt">, profileTokens = profileEvidenceTokens(profile)): boolean {
  if (!evidence || !evidence.trim()) return false;
  const tokens = meaningfulTokens(evidence);
  if (tokens.size > 0) {
    let found = 0;
    for (const t of tokens) if (profileTokens.has(t)) found += 1;
    if (found / tokens.size >= GROUNDING_THRESHOLD) return true;
  }
  // "6 years" style evidence is grounded when it matches the profile's years.
  const years = evidence.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)\b/i);
  return years !== null && Number(years[1]) === profile.yearsExperience;
}

const PREDICTION_PATTERN =
  /\b(chances?|odds|likelihood|probabilit(?:y|ies)|probable|guarantee[ds]?|candidacy|likely to (?:be|get) (?:hired|selected|shortlisted|an? (?:offer|interview))|(?:get|be|being|getting) (?:hired|shortlisted|selected)|you (?:will|would) (?:get (?:the|this) (?:job|role|offer))|willing(?:ness)? to (?:hire|consider|train|accept)|hiring success rate)\b|\d{1,3}(?:\.\d+)?\s?%/i;

/** True when text sounds like a hiring prediction or a percentage score (AC-A4). */
export function containsPrediction(text: string): boolean {
  return PREDICTION_PATTERN.test(text);
}

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  // Prefer ending at a full sentence so text is never cut mid-thought.
  const sentences = t.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [];
  let kept = "";
  for (const sentence of sentences) {
    if ((kept + sentence).trim().length > max) break;
    kept += sentence;
  }
  if (kept.trim().length >= max * 0.5) return kept.trim();
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Generated commentary: shortened, and replaced if it contains prediction language. */
function safeCommentary(text: string | null | undefined, max: number, fallback: string): string {
  const t = truncate(text ?? "", max);
  if (!t || containsPrediction(t)) return fallback;
  return t;
}

/** The documented alignment rule (spec §6.5). Same counts → same level, always. */
export function alignmentLevel(matched: number, total: number, experience: ExperienceStatus): AlignmentLevel {
  const ratio = total === 0 ? 0 : matched / total;
  if (ratio >= 0.75) return experience === "below" ? "partial" : "strong";
  if (ratio >= 0.4) return "partial";
  return "limited";
}

export type PostProcessResult =
  | { ok: true; analysis: Analysis }
  | { ok: false; reason: "not_job_description" };

export function postProcess(
  ai: AiAnalysis,
  ctx: { profile: Omit<Profile, "updatedAt">; jobDescription: string; model: string; promptVersion: string; now?: Date },
): PostProcessResult {
  if (!ai.is_job_description) return { ok: false, reason: "not_job_description" };

  const jdTokens = meaningfulTokens(ctx.jobDescription);
  const profileTokens = profileEvidenceTokens(ctx.profile);
  const seen = new Set<string>();
  let groundingDowngrades = 0;
  const requirements: Requirement[] = [];

  for (const r of ai.requirements) {
    const name = truncate(r.requirement, LIMITS.requirement);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    // Traceability (AC-A3): the quoted evidence must share words with the real JD.
    if (!overlaps(meaningfulTokens(`${r.jd_evidence} ${r.requirement}`), jdTokens)) continue;
    seen.add(key);

    let status = r.status;
    let profileEvidence = r.profile_evidence ? truncate(r.profile_evidence, LIMITS.profileEvidence) : null;
    let note = r.note;
    const grounded = isGrounded(profileEvidence, ctx.profile, profileTokens);

    if (status === "matched" && !grounded) {
      // Anti-hallucination rule (AC-A2).
      status = "unproven";
      groundingDowngrades += 1;
      note = "Not clearly shown in your profile. If you have this experience, add it to your profile and analyse again.";
      profileEvidence = null;
    } else if (status !== "matched" && profileEvidence && !grounded) {
      profileEvidence = null; // never show "evidence" that isn't in the profile
    }
    if (status === "missing") profileEvidence = null;

    requirements.push({
      id: `r${requirements.length + 1}`,
      requirement: name,
      category: r.category,
      importance: r.importance,
      jdEvidence: truncate(r.jd_evidence, LIMITS.jdEvidence),
      status,
      profileEvidence,
      note:
        status === "matched"
          ? null
          : safeCommentary(note, LIMITS.note, status === "missing" ? "Not shown in your profile." : "Related experience, but not explicitly shown in your profile."),
    });
    if (requirements.length >= MAX_REQUIREMENTS) break;
  }

  if (requirements.length === 0) return { ok: false, reason: "not_job_description" };

  const must = requirements.filter((r) => r.importance === "must_have");
  const nice = requirements.filter((r) => r.importance === "nice_to_have");
  const countMatched = (list: Requirement[]) => list.filter((r) => r.status === "matched").length;
  const mustHaveMatched = countMatched(must);
  const niceToHaveMatched = countMatched(nice);
  const basis = must.length > 0 ? must : requirements;
  const level = alignmentLevel(countMatched(basis), basis.length, ai.experience_alignment.status);

  const fallbackSummary =
    must.length > 0
      ? `Your profile shows ${mustHaveMatched} of ${must.length} must-have requirements for this job. See the matching and missing skills below for the details.`
      : `Your profile shows ${countMatched(requirements)} of ${requirements.length} listed requirements for this job. See the details below.`;

  const nullIfBlank = (s: string | null) => (s && s.trim() ? truncate(s, LIMITS.short) : null);

  return {
    ok: true,
    analysis: {
      job: {
        title: nullIfBlank(ai.job.title),
        company: nullIfBlank(ai.job.company),
        location: nullIfBlank(ai.job.location),
        workMode: ai.job.work_mode === "unspecified" ? null : ai.job.work_mode,
        seniority: nullIfBlank(ai.job.seniority),
        requiredYearsMin: ai.job.required_years_min,
        requiredYearsMax: ai.job.required_years_max,
      },
      requirements,
      experienceAlignment: {
        status: ai.experience_alignment.status,
        explanation: safeCommentary(ai.experience_alignment.explanation, LIMITS.explanation, "Compare the experience asked for with your profile."),
      },
      locationAlignment: {
        status: ai.location_alignment.status,
        explanation: safeCommentary(ai.location_alignment.explanation, LIMITS.explanation, "Check the job's location and work mode against your preferences."),
      },
      toClarify: ai.to_clarify
        .filter((c) => c.requirement.trim() && c.suggested_question.trim())
        .slice(0, MAX_TO_CLARIFY)
        .map((c) => ({
          requirement: truncate(c.requirement, LIMITS.requirement),
          reason: safeCommentary(c.reason, LIMITS.clarify, "Not explained in the job description."),
          suggestedQuestion: safeCommentary(c.suggested_question, LIMITS.clarify, "Could you tell me more about this requirement?"),
        })),
      summary: safeCommentary(ai.summary, LIMITS.summary, fallbackSummary),
      alignmentLevel: level,
      mustHaveMatched,
      mustHaveTotal: must.length,
      niceToHaveMatched,
      niceToHaveTotal: nice.length,
      groundingDowngrades,
      model: ctx.model,
      promptVersion: ctx.promptVersion,
      analysedAt: (ctx.now ?? new Date()).toISOString(),
    },
  };
}
