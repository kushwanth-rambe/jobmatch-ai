import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export const metadata: Metadata = { title: "Add Job Description" };

export default function AnalyzePage() {
  return (
    <ScreenPlaceholder
      steps={[2]}
      title="Add Job Description"
      intro="Paste the full job description from any job site. Add the original link so you can open the listing again later."
      milestone="Built in Milestone M2"
      plannedItems={[
        "Paste job description (required, 300–15,000 characters)",
        "Job title and company (optional)",
        "Original job link (optional)",
        "Summary of the profile being used, with an Edit link",
        "Analyse fit button with progress steps",
      ]}
      back={{ href: "/profile", label: "Professional Profile" }}
      next={{ href: "/opportunity/preview", label: "Preview analysis screen" }}
    />
  );
}
