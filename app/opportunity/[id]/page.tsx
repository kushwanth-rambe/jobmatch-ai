import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export const metadata: Metadata = { title: "JobMatch Analysis" };

/**
 * Steps 3 and 4 share this page (spec §4, Screen 4).
 * In M0 it does not read the opportunity id; saved analyses are loaded from
 * the browser in M2/M3.
 */
export default function OpportunityPage() {
  return (
    <ScreenPlaceholder
      steps={[3, 4]}
      title="JobMatch Analysis & Application Decision"
      intro="Your results appear here after you analyse a job: how your profile compares with the job, followed by your decision."
      milestone="Analysis in M2 · Decision in M3"
      plannedItems={[
        "Alignment summary (Strong, Partial or Limited) with the counts behind it",
        "Matching skills, with evidence from your profile",
        "Missing or unproven skills",
        "Experience alignment",
        "Location and work mode",
        "Requirements to clarify, with questions for the recruiter",
        "Open original job, Save, Mark as applied",
        "Disclaimer: not a prediction of hiring success",
      ]}
      back={{ href: "/analyze", label: "Add Job Description" }}
    >
      <p className="mt-6 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
        This compares your profile with the job description. It is not a prediction of hiring success.
      </p>
    </ScreenPlaceholder>
  );
}
