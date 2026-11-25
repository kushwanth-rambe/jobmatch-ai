import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneySteps } from "@/components/JourneySteps";
import { AnalysisView } from "@/components/analysis/AnalysisView";

export const metadata: Metadata = { title: "JobMatch Analysis" };

/**
 * Steps 3 and 4 share this page (spec §4, Screen 4). The analysis is stored in
 * the browser, so it is read on the client; M3 adds the decision actions.
 */
export default function OpportunityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <JourneySteps current={[3, 4]} />
      <Suspense fallback={<p className="mt-8 text-sm text-subtle">Loading your analysis…</p>}>
        <AnalysisView />
      </Suspense>
    </div>
  );
}
