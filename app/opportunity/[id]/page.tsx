import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneySteps } from "@/components/JourneySteps";
import { AnalysisView } from "@/components/analysis/AnalysisView";

export const metadata: Metadata = { title: "JobMatch Analysis" };

/**
 * Step 3 · JobMatch Analysis. The analysis is stored in the browser, so it is read
 * on the client. Step 4 (Application Decision) is the next page: ./decision.
 */
export default function OpportunityPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <JourneySteps current={[3]} />
      <Suspense fallback={<p className="mt-8 text-sm text-subtle">Loading your analysis…</p>}>
        <AnalysisView />
      </Suspense>
    </div>
  );
}
