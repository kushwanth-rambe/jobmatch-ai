/**
 * Professional Profile: validation and browser storage (spec §4 Screen 2, AC-P1–P4).
 * Plain TypeScript, no libraries, so it is easy to read and to unit test.
 */
import type { Profile, WorkMode } from "./types.ts";

export const PROFILE_STORAGE_KEY = "jobmatch.profile";

export const LIMITS = {
  roleMin: 2,
  roleMax: 80,
  yearsMin: 0,
  yearsMax: 50,
  skillsMin: 3,
  skillsMax: 40,
  skillMax: 40,
  locationMax: 120,
  highlightsMax: 1000,
} as const;

export const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

/** What the form holds while the user is typing (everything as typed). */
export type ProfileDraft = {
  currentRole: string;
  targetRole: string;
  yearsExperience: string;
  skills: string[];
  location: string;
  workModes: WorkMode[];
  experienceHighlights: string;
};

export type ProfileField = keyof ProfileDraft;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

export const EMPTY_DRAFT: ProfileDraft = {
  currentRole: "",
  targetRole: "",
  yearsExperience: "",
  skills: [],
  location: "",
  workModes: [],
  experienceHighlights: "",
};

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function validateRole(value: string, label: string): string | undefined {
  const v = collapse(value);
  if (!v) return `Enter your ${label}.`;
  if (v.length < LIMITS.roleMin) return `${capitalise(label)} must be at least ${LIMITS.roleMin} characters.`;
  if (v.length > LIMITS.roleMax) return `${capitalise(label)} must be ${LIMITS.roleMax} characters or fewer.`;
  return undefined;
}

function capitalise(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Years must be 0–50, in whole or half years (e.g. 6 or 6.5). */
export function parseYears(value: string): number | null {
  const v = value.trim();
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  const n = Number(v);
  if (n < LIMITS.yearsMin || n > LIMITS.yearsMax) return null;
  if (!Number.isInteger(n * 2)) return null;
  return n;
}

/** Split a typed location string ("Bengaluru, Pune") into a clean list. */
export function parseLocations(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const v = collapse(part);
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export function locationRequired(workModes: WorkMode[]): boolean {
  return workModes.includes("onsite") || workModes.includes("hybrid");
}

/**
 * Add one or more skills (comma-separated input is split).
 * Duplicates are ignored case-insensitively ("SQL" and "sql" count once).
 */
export function addSkills(
  current: string[],
  input: string,
): { skills: string[]; error?: string } {
  const parts = input.split(",").map(collapse).filter(Boolean);
  if (parts.length === 0) return { skills: current };
  const skills = [...current];
  const lower = new Set(current.map((s) => s.toLowerCase()));
  const duplicates: string[] = [];
  for (const p of parts) {
    if (p.length > LIMITS.skillMax) {
      return { skills: current, error: `Each skill must be ${LIMITS.skillMax} characters or fewer.` };
    }
    if (lower.has(p.toLowerCase())) {
      duplicates.push(p);
      continue;
    }
    if (skills.length >= LIMITS.skillsMax) {
      return { skills, error: `You can add up to ${LIMITS.skillsMax} skills.` };
    }
    skills.push(p);
    lower.add(p.toLowerCase());
  }
  if (duplicates.length > 0 && skills.length === current.length) {
    return { skills, error: `“${duplicates[0]}” is already in your skills.` };
  }
  return { skills };
}

/** Check every field. Returns field errors, plus a clean Profile when everything is valid. */
export function validateDraft(draft: ProfileDraft): { errors: ProfileErrors; profile: Omit<Profile, "updatedAt"> | null } {
  const errors: ProfileErrors = {};

  const currentRoleError = validateRole(draft.currentRole, "current role");
  if (currentRoleError) errors.currentRole = currentRoleError;

  const targetRoleError = validateRole(draft.targetRole, "target role");
  if (targetRoleError) errors.targetRole = targetRoleError;

  const years = parseYears(draft.yearsExperience);
  if (draft.yearsExperience.trim() === "") {
    errors.yearsExperience = "Enter your years of professional experience.";
  } else if (years === null) {
    errors.yearsExperience = `Enter a number from ${LIMITS.yearsMin} to ${LIMITS.yearsMax}, in whole or half years (e.g. 6 or 6.5).`;
  }

  if (draft.skills.length < LIMITS.skillsMin) {
    const missing = LIMITS.skillsMin - draft.skills.length;
    errors.skills = `Add at least ${LIMITS.skillsMin} skills (${missing} more needed).`;
  } else if (draft.skills.length > LIMITS.skillsMax) {
    errors.skills = `You can add up to ${LIMITS.skillsMax} skills.`;
  }

  if (draft.workModes.length === 0) {
    errors.workModes = "Choose at least one work mode.";
  }

  const locations = parseLocations(draft.location);
  if (draft.location.trim().length > LIMITS.locationMax) {
    errors.location = `Location must be ${LIMITS.locationMax} characters or fewer.`;
  } else if (locations.length === 0 && locationRequired(draft.workModes)) {
    errors.location = "Enter a preferred location for on-site or hybrid work.";
  }

  const highlights = draft.experienceHighlights.trim();
  if (highlights.length > LIMITS.highlightsMax) {
    errors.experienceHighlights = `Experience highlights must be ${LIMITS.highlightsMax} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0 || years === null) return { errors, profile: null };

  return {
    errors,
    profile: {
      currentRole: collapse(draft.currentRole),
      targetRole: collapse(draft.targetRole),
      yearsExperience: years,
      skills: draft.skills,
      preferredLocations: locations,
      workModes: WORK_MODES.map((m) => m.value).filter((m) => draft.workModes.includes(m)),
      ...(highlights ? { experienceHighlights: highlights } : {}),
    },
  };
}

/** Turn a saved Profile back into form values (used when editing). */
export function profileToDraft(profile: Profile): ProfileDraft {
  return {
    currentRole: profile.currentRole,
    targetRole: profile.targetRole,
    yearsExperience: String(profile.yearsExperience),
    skills: [...profile.skills],
    location: profile.preferredLocations.join(", "),
    workModes: [...profile.workModes],
    experienceHighlights: profile.experienceHighlights ?? "",
  };
}

/**
 * Read a stored profile string safely. Anything missing, corrupted or no
 * longer valid is treated as "no profile" rather than crashing the page.
 */
export function parseStoredProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Profile>;
    if (!data || typeof data !== "object") return null;
    const draft: ProfileDraft = {
      currentRole: typeof data.currentRole === "string" ? data.currentRole : "",
      targetRole: typeof data.targetRole === "string" ? data.targetRole : "",
      yearsExperience: typeof data.yearsExperience === "number" ? String(data.yearsExperience) : "",
      skills: Array.isArray(data.skills) ? data.skills.filter((s): s is string => typeof s === "string") : [],
      location: Array.isArray(data.preferredLocations)
        ? data.preferredLocations.filter((s): s is string => typeof s === "string").join(", ")
        : "",
      workModes: Array.isArray(data.workModes)
        ? data.workModes.filter((m): m is WorkMode => WORK_MODES.some((w) => w.value === m))
        : [],
      experienceHighlights: typeof data.experienceHighlights === "string" ? data.experienceHighlights : "",
    };
    const { profile } = validateDraft(draft);
    if (!profile) return null;
    return { ...profile, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "" };
  } catch {
    return null;
  }
}

/* ---------- Browser storage (only called from the browser) ---------- */

const listeners = new Set<() => void>();

export function readProfileRaw(): string | null {
  try {
    return window.localStorage.getItem(PROFILE_STORAGE_KEY);
  } catch {
    return null; // storage blocked (e.g. some private-browsing modes)
  }
}

/** Save the profile. Returns false if the browser refused to store it. */
export function saveProfile(profile: Omit<Profile, "updatedAt">): Profile | null {
  const saved: Profile = { ...profile, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    return null;
  }
  listeners.forEach((l) => l());
  return saved;
}

/** Lets React re-read storage when the profile changes (this tab or another tab). */
export function subscribeToProfile(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROFILE_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** True when the form has the same values as the saved profile. */
export function sameProfile(a: Omit<Profile, "updatedAt"> | null, b: Profile | null): boolean {
  if (!a || !b) return false;
  const strip = (p: Omit<Profile, "updatedAt">) => ({
    currentRole: p.currentRole,
    targetRole: p.targetRole,
    yearsExperience: p.yearsExperience,
    skills: p.skills,
    preferredLocations: p.preferredLocations,
    workModes: p.workModes,
    experienceHighlights: p.experienceHighlights ?? "",
  });
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}
