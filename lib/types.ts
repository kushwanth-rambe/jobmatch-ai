/**
 * Data shapes for Release 1, taken from JOBMATCH_AI_PRODUCT_SPEC.md
 * (§4 Screen 2, §6.4 output schema, §8.3 local storage shape).
 * Nothing uses these yet in M0; they keep later milestones consistent with the spec.
 */

export type WorkMode = "onsite" | "hybrid" | "remote";

/** Professional Profile (spec §4, Screen 2). Stored in the browser in Release 1. */
export type Profile = {
  currentRole: string;
  targetRole: string;
  yearsExperience: number;
  skills: string[];
  preferredLocations: string[];
  workModes: WorkMode[];
  /** Optional, max 1,000 characters. */
  experienceHighlights?: string;
  updatedAt: string;
};

export type RequirementCategory =
  | "skill"
  | "tool"
  | "experience"
  | "education"
  | "certification"
  | "domain"
  | "other";

export type RequirementStatus = "matched" | "unproven" | "missing";

/** One job requirement as classified by the analysis (spec §6.4). */
export type Requirement = {
  id: string;
  requirement: string;
  category: RequirementCategory;
  importance: "must_have" | "nice_to_have";
  jdEvidence: string;
  status: RequirementStatus;
  profileEvidence: string | null;
  note: string | null;
};

export type AlignmentLevel = "strong" | "partial" | "limited";

export type ExperienceStatus = "below" | "meets" | "exceeds" | "not_specified";
export type LocationStatus = "aligned" | "partial" | "not_aligned" | "unclear";

/** Validated JobMatch Analysis result plus the values computed by app code (spec §6.4–6.5). */
export type Analysis = {
  job: {
    title: string | null;
    company: string | null;
    location: string | null;
    workMode: string | null;
    seniority: string | null;
    requiredYearsMin: number | null;
    requiredYearsMax: number | null;
  };
  requirements: Requirement[];
  experienceAlignment: { status: ExperienceStatus; explanation: string };
  locationAlignment: { status: LocationStatus; explanation: string };
  toClarify: { requirement: string; reason: string; suggestedQuestion: string }[];
  summary: string;
  /** Computed by app code, never by the AI. */
  alignmentLevel: AlignmentLevel;
  mustHaveMatched: number;
  mustHaveTotal: number;
  niceToHaveMatched: number;
  niceToHaveTotal: number;
  /** How many AI "matched" items the grounding check moved to "unproven". */
  groundingDowngrades: number;
  model: string;
  promptVersion: string;
  analysedAt: string;
};

export type OpportunityStatus = "analysed" | "saved" | "applied";

/** One analysed job, stored in the browser in Release 1 (spec §8.3). */
export type Opportunity = {
  id: string;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  sourceUrl: string | null;
  sourceType: "paste";
  status: OpportunityStatus;
  appliedAt: string | null;
  inputHash: string;
  /** The job description exactly as pasted, kept for review. */
  jobDescription: string;
  /** The profile the analysis was based on. */
  profileSnapshot: Omit<Profile, "updatedAt">;
  analysis: Analysis;
  createdAt: string;
};
