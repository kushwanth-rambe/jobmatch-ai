/**
 * Add Job Description: input rules (spec §4 Screen 3, AC-J1, AC-J1a, AC-J4).
 * Used by the browser form AND re-checked on the server before any AI call.
 */
import type { Profile } from "./types.ts";

export const JOB_LIMITS = {
  descriptionMin: 300,
  descriptionMax: 15000,
  minWords: 50,
  titleMax: 120,
  companyMax: 120,
  linkMax: 2000,
} as const;

/** What the Add Job form holds while the user is typing. */
export type JobDraft = {
  description: string;
  title: string;
  company: string;
  link: string;
};

export type JobField = keyof JobDraft;
export type JobErrors = Partial<Record<JobField, string>>;

export const EMPTY_JOB_DRAFT: JobDraft = { description: "", title: "", company: "", link: "" };

/** A clean, checked job ready to analyse. */
export type JobInput = {
  /** Exactly as pasted (only outer whitespace trimmed) — kept for review. */
  description: string;
  title: string | null;
  company: string | null;
  link: string | null;
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’+#./-]*/gu);
  return m ? m.length : 0;
}

/** True when the text is basically just a web link (URL fetching is not available yet). */
export function looksLikeOnlyALink(text: string): boolean {
  const t = text.trim();
  return /^https?:\/\/\S+$/i.test(t) || (/^https?:\/\//i.test(t) && countWords(t) < 8);
}

/** Checks the original job link: optional, https only. Returns the cleaned link or an error. */
export function checkLink(value: string): { link: string | null; error?: string } {
  const v = value.trim();
  if (!v) return { link: null };
  if (v.length > JOB_LIMITS.linkMax) return { link: null, error: "This link is too long." };
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return { link: null, error: "Enter a full web address starting with https://" };
  }
  if (url.protocol !== "https:") return { link: null, error: "Enter a secure web address starting with https://" };
  if (!url.hostname.includes(".")) return { link: null, error: "Enter a full web address, e.g. https://company.com/jobs/123" };
  return { link: url.toString() };
}

export function validateJobDraft(draft: JobDraft): { errors: JobErrors; job: JobInput | null } {
  const errors: JobErrors = {};
  const description = draft.description.trim();
  const length = description.length;

  if (!description) {
    errors.description = "Paste the job description.";
  } else if (looksLikeOnlyALink(description)) {
    errors.description =
      "Paste the job description text, not the link. Open the job, copy the full description and paste it here.";
  } else if (length < JOB_LIMITS.descriptionMin) {
    errors.description = `This looks too short to be a full job description (${length} of at least ${JOB_LIMITS.descriptionMin} characters). Please paste the full listing.`;
  } else if (length > JOB_LIMITS.descriptionMax) {
    errors.description = `This is longer than ${JOB_LIMITS.descriptionMax.toLocaleString("en")} characters. Remove company boilerplate such as benefits or equal-opportunity text and try again.`;
  } else if (countWords(description) < JOB_LIMITS.minWords) {
    errors.description = "This doesn't look like a job description. Please paste the full listing text.";
  }

  const title = collapse(draft.title);
  if (title.length > JOB_LIMITS.titleMax) errors.title = `Job title must be ${JOB_LIMITS.titleMax} characters or fewer.`;
  const company = collapse(draft.company);
  if (company.length > JOB_LIMITS.companyMax) errors.company = `Company must be ${JOB_LIMITS.companyMax} characters or fewer.`;
  const { link, error: linkError } = checkLink(draft.link);
  if (linkError) errors.link = linkError;

  if (Object.keys(errors).length > 0) return { errors, job: null };
  return { errors, job: { description, title: title || null, company: company || null, link } };
}

/**
 * Text that is sent to the AI: same words, tidier spacing (saves tokens).
 * Tabs/repeated spaces collapse; 3+ blank lines become one blank line.
 */
export function normaliseForAnalysis(description: string): string {
  return description
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Profile fields that affect the analysis (the save time does not). */
export function analysisProfile(profile: Profile | Omit<Profile, "updatedAt">): Omit<Profile, "updatedAt"> {
  return {
    currentRole: profile.currentRole,
    targetRole: profile.targetRole,
    yearsExperience: profile.yearsExperience,
    skills: profile.skills,
    preferredLocations: profile.preferredLocations,
    workModes: profile.workModes,
    ...(profile.experienceHighlights ? { experienceHighlights: profile.experienceHighlights } : {}),
  };
}

/**
 * Cache key: identical profile + identical job description + same prompt
 * version → same key → the saved result is reused with no API call (AC-A6).
 */
export async function analysisCacheKey(
  profile: Profile | Omit<Profile, "updatedAt">,
  description: string,
  promptVersion: string,
): Promise<string> {
  const payload = JSON.stringify({
    v: promptVersion,
    p: analysisProfile(profile),
    jd: normaliseForAnalysis(description).toLowerCase(),
  });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
