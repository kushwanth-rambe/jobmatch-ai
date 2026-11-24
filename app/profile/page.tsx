import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/ScreenPlaceholder";

export const metadata: Metadata = { title: "Professional Profile" };

export default function ProfilePage() {
  return (
    <ScreenPlaceholder
      steps={[1]}
      title="Professional Profile"
      intro="Tell us about your background once. Every job you check is compared against this profile. It's saved on this device — no account needed."
      milestone="Built in Milestone M1"
      plannedItems={[
        "Current role",
        "Target role",
        "Years of professional experience",
        "Skills (at least 3)",
        "Preferred location and work mode (on-site, hybrid, remote)",
        "Experience highlights (optional)",
      ]}
      back={{ href: "/", label: "Home" }}
      next={{ href: "/analyze", label: "Add Job Description" }}
    />
  );
}
