/**
 * The exact JSON shape Gemini must return (spec §6.4).
 * One Zod definition is used twice:
 *   1. converted to JSON Schema and sent to Gemini (structured output), and
 *   2. used to check Gemini's reply before anything is shown.
 * Kept small and flat: Google's docs advise short schemas, and every
 * property name costs output tokens. Length limits live in the prompt and
 * are enforced in code (Gemini ignores maxLength).
 */
import * as z from "zod";

const text = z.string();
const nullableText = z.string().nullable();

export const REQUIREMENT_CATEGORIES = ["skill", "tool", "experience", "education", "certification", "domain", "other"] as const;
export const IMPORTANCE = ["must_have", "nice_to_have"] as const;
export const STATUSES = ["matched", "unproven", "missing"] as const;
export const EXPERIENCE_STATUSES = ["below", "meets", "exceeds", "not_specified"] as const;
export const LOCATION_STATUSES = ["aligned", "partial", "not_aligned", "unclear"] as const;

export const aiRequirementSchema = z.object({
  requirement: text.describe("Short name of the requirement, max 80 chars."),
  category: z.enum(REQUIREMENT_CATEGORIES),
  importance: z.enum(IMPORTANCE),
  jd_evidence: text.describe("Short quote from the JOB DESCRIPTION, max 150 chars."),
  status: z.enum(STATUSES),
  profile_evidence: nullableText.describe("Exact words copied from the PROFILE; null if missing."),
  note: nullableText.describe("For unproven/missing: one neutral sentence, max 120 chars."),
});

export const aiAnalysisSchema = z.object({
  is_job_description: z.boolean(),
  job: z.object({
    title: nullableText,
    company: nullableText,
    location: nullableText,
    work_mode: z.enum(["onsite", "hybrid", "remote", "unspecified"]),
    seniority: nullableText,
    required_years_min: z.number().nullable(),
    required_years_max: z.number().nullable(),
  }),
  requirements: z.array(aiRequirementSchema),
  experience_alignment: z.object({
    status: z.enum(EXPERIENCE_STATUSES),
    explanation: text,
  }),
  location_alignment: z.object({
    status: z.enum(LOCATION_STATUSES),
    explanation: text,
  }),
  to_clarify: z.array(
    z.object({
      requirement: text,
      reason: text,
      suggested_question: text,
    }),
  ),
  summary: text.describe("2-3 sentences: why it fits and why not. Strengths first, then gaps."),
});

export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
export type AiRequirement = z.infer<typeof aiRequirementSchema>;

/** JSON Schema sent to Gemini as `responseJsonSchema`. */
export function geminiResponseSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(aiAnalysisSchema, { target: "draft-7" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
