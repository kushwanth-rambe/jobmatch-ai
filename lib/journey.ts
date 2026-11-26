/**
 * The one Release 1 journey (spec §0.1):
 * Professional Profile → Add Job Description → JobMatch Analysis → Application Decision.
 * Steps 3 and 4 are separate pages: /opportunity/[id] and /opportunity/[id]/decision.
 */
export const JOURNEY_STEPS = [
  { number: 1, label: "Professional Profile", shortLabel: "Profile" },
  { number: 2, label: "Add Job Description", shortLabel: "Add job" },
  { number: 3, label: "JobMatch Analysis", shortLabel: "Analysis" },
  { number: 4, label: "Application Decision", shortLabel: "Decision" },
] as const;

export type JourneyStepNumber = (typeof JOURNEY_STEPS)[number]["number"];
