import type { Metadata } from "next";
import { JourneySteps } from "@/components/JourneySteps";
import { ProfileEditor } from "@/components/profile/ProfileForm";

export const metadata: Metadata = { title: "Professional Profile" };

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <JourneySteps current={[1]} />

      <div className="mt-8 sm:mt-10">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Professional Profile</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Tell us about your background once. Every job you check is compared against this profile. It&apos;s saved
          on this device — no account needed.
        </p>
        <p className="mt-2 text-sm text-subtle">
          Fields marked <span className="text-accent">*</span> are required.
        </p>
      </div>

      <ProfileEditor />
    </div>
  );
}
