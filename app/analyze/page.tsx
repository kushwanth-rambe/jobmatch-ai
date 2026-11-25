import type { Metadata } from "next";
import { JourneySteps } from "@/components/JourneySteps";
import { AddJobScreen } from "@/components/job/AddJobForm";

export const metadata: Metadata = { title: "Add Job Description" };

export default function AnalyzePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <JourneySteps current={[2]} />

      <div className="mt-8 sm:mt-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Add Job Description</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Paste a job you&apos;re interested in. We&apos;ll compare its requirements with your profile and show where you
          match, what&apos;s missing and what to clarify.
        </p>
      </div>

      <AddJobScreen />
    </div>
  );
}
