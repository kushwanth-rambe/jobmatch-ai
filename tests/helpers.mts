/**
 * Shared test data. The AI replies below are TEST DOUBLES used only to check
 * the app's own code paths — they are never shown in the product.
 */
import type { AiAnalysis } from "../lib/analysis/schema.ts";
import type { Profile } from "../lib/types.ts";

export const PROFILE: Omit<Profile, "updatedAt"> = {
  currentRole: "Senior Business Analyst",
  targetRole: "Product Manager",
  yearsExperience: 6,
  skills: ["SQL", "Jira", "Stakeholder management", "Requirements gathering", "A/B testing"],
  preferredLocations: ["Bengaluru"],
  workModes: ["hybrid"],
  experienceHighlights: "Led requirements for a payments app; ran A/B tests with the growth team.",
};

export const JD = `Product Manager — Payments
We are looking for a Product Manager to own the roadmap for our payments platform.
Requirements:
- 4+ years of experience in product management or a related role (required)
- Strong SQL skills and experience analysing data (required)
- Experience running A/B tests and experiments (required)
- Excellent stakeholder management across engineering and design (required)
- Experience with Amplitude or Mixpanel is a plus
- Experience owning a product roadmap (required)
Location: Bengaluru, hybrid (3 days in office).`;

export function aiReply(overrides: Partial<AiAnalysis> = {}): AiAnalysis {
  return {
    is_job_description: true,
    job: {
      title: "Product Manager",
      company: null,
      location: "Bengaluru",
      work_mode: "hybrid",
      seniority: "Mid",
      required_years_min: 4,
      required_years_max: null,
    },
    requirements: [
      { requirement: "SQL", category: "skill", importance: "must_have", jd_evidence: "Strong SQL skills and experience analysing data", status: "matched", profile_evidence: "SQL", note: null },
      { requirement: "A/B testing", category: "skill", importance: "must_have", jd_evidence: "Experience running A/B tests and experiments", status: "matched", profile_evidence: "ran A/B tests with the growth team", note: null },
      { requirement: "Stakeholder management", category: "skill", importance: "must_have", jd_evidence: "Excellent stakeholder management across engineering and design", status: "matched", profile_evidence: "Stakeholder management", note: null },
      { requirement: "Roadmap ownership", category: "experience", importance: "must_have", jd_evidence: "Experience owning a product roadmap", status: "unproven", profile_evidence: "Requirements gathering", note: "Roadmap ownership is not stated." },
      { requirement: "Amplitude or Mixpanel", category: "tool", importance: "nice_to_have", jd_evidence: "Experience with Amplitude or Mixpanel is a plus", status: "missing", profile_evidence: null, note: "Not in your profile." },
    ],
    experience_alignment: { status: "meets", explanation: "The role asks for 4+ years; your profile shows 6 years." },
    location_alignment: { status: "aligned", explanation: "Hybrid in Bengaluru matches your preferences." },
    to_clarify: [
      { requirement: "Related role", reason: "It is unclear which roles count as related.", suggested_question: "Would business analysis experience count as a related role?" },
    ],
    summary: "Your SQL, A/B testing and stakeholder management experience align well. The main gaps are roadmap ownership and product analytics tools.",
    ...overrides,
  };
}

export const USAGE = { inputTokens: 1000, outputTokens: 500, thinkingTokens: 100, totalTokens: 1600 };
