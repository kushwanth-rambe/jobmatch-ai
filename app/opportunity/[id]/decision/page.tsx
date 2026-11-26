import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneySteps } from "@/components/JourneySteps";
import { DecisionView } from "@/components/decision/DecisionView";

export const metadata: Metadata = { title: "Application Decision" };

/** Step 4 · Application Decision. The job is stored in the browser, so it is read on the client. */
export default function DecisionPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <JourneySteps current={[4]} />
      <Suspense fallback={<p className="mt-8 text-sm text-subtle">Loading…</p>}>
        <DecisionView />
      </Suspense>
    </div>
  );
}
