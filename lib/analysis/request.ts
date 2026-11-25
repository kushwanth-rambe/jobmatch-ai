/**
 * Server-side check of an /api/analyze request body. The browser checks the
 * same rules, but the server never trusts the browser (spec SR-3).
 */
import { validateJobDraft, type JobInput } from "../job.ts";
import { parseStoredProfile } from "../profile.ts";
import type { Profile } from "../types.ts";

/** Generous ceiling on the raw request size (profile + 15,000-character job description). */
export const MAX_BODY_BYTES = 40_000;

export type AnalyzeRequest = { profile: Omit<Profile, "updatedAt">; job: JobInput };

export function parseAnalyzeRequest(body: unknown): { ok: true; value: AnalyzeRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Invalid request." };
  const { profile: rawProfile, job: rawJob } = body as { profile?: unknown; job?: unknown };

  const profile = parseStoredProfile(JSON.stringify(rawProfile ?? null));
  if (!profile) return { ok: false, message: "Your profile is incomplete. Please check your Professional Profile." };

  const j = (rawJob ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const { job, errors } = validateJobDraft({
    description: str(j.description),
    title: str(j.title),
    company: str(j.company),
    link: str(j.link),
  });
  if (!job) return { ok: false, message: Object.values(errors)[0] ?? "Invalid job description." };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { updatedAt, ...rest } = profile;
  return { ok: true, value: { profile: rest, job } };
}
