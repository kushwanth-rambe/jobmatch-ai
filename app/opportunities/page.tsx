import type { Metadata } from "next";
import { OpportunityList } from "@/components/opportunities/OpportunityList";

export const metadata: Metadata = { title: "My opportunities" };

/** Saved and applied jobs. Stored in the browser, so the list is read on the client. */
export default function OpportunitiesPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <OpportunityList />
    </div>
  );
}
