/**
 * Unit tests for profile validation and storage parsing (spec AC-P1–P4).
 * Run with: npm test
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_DRAFT,
  addSkills,
  parseLocations,
  parseStoredProfile,
  parseYears,
  profileToDraft,
  sameProfile,
  validateDraft,
  type ProfileDraft,
} from "../lib/profile.ts";

const VALID: ProfileDraft = {
  currentRole: "Senior Business Analyst",
  targetRole: "Product Manager",
  yearsExperience: "6",
  skills: ["SQL", "Jira", "Stakeholder management"],
  location: "Bengaluru",
  workModes: ["hybrid"],
  experienceHighlights: "",
};

describe("validateDraft", () => {
  it("accepts a complete profile and cleans it up", () => {
    const { errors, profile } = validateDraft({ ...VALID, currentRole: "  Senior   Business Analyst " });
    assert.deepEqual(errors, {});
    assert.equal(profile?.currentRole, "Senior Business Analyst");
    assert.equal(profile?.yearsExperience, 6);
    assert.deepEqual(profile?.preferredLocations, ["Bengaluru"]);
    assert.equal("experienceHighlights" in (profile ?? {}), false);
  });

  it("reports every required field on an empty form", () => {
    const { errors, profile } = validateDraft(EMPTY_DRAFT);
    assert.equal(profile, null);
    assert.deepEqual(Object.keys(errors).sort(), ["currentRole", "skills", "targetRole", "workModes", "yearsExperience"]);
  });

  it("requires at least 3 skills (AC-P2)", () => {
    const { errors, profile } = validateDraft({ ...VALID, skills: ["SQL", "Jira"] });
    assert.equal(profile, null);
    assert.match(errors.skills ?? "", /Add at least 3 skills \(1 more needed\)/);
  });

  it("checks role length", () => {
    assert.ok(validateDraft({ ...VALID, targetRole: "P" }).errors.targetRole);
    assert.ok(validateDraft({ ...VALID, targetRole: "x".repeat(81) }).errors.targetRole);
  });

  it("requires a location for on-site or hybrid, but not for remote only", () => {
    assert.ok(validateDraft({ ...VALID, location: "", workModes: ["onsite"] }).errors.location);
    assert.ok(validateDraft({ ...VALID, location: "", workModes: ["remote", "hybrid"] }).errors.location);
    assert.equal(validateDraft({ ...VALID, location: "", workModes: ["remote"] }).errors.location, undefined);
  });

  it("limits experience highlights to 1,000 characters", () => {
    assert.ok(validateDraft({ ...VALID, experienceHighlights: "a".repeat(1001) }).errors.experienceHighlights);
    assert.equal(validateDraft({ ...VALID, experienceHighlights: "a".repeat(1000) }).errors.experienceHighlights, undefined);
  });
});

describe("parseYears", () => {
  it("accepts whole and half years from 0 to 50", () => {
    assert.equal(parseYears("0"), 0);
    assert.equal(parseYears("6.5"), 6.5);
    assert.equal(parseYears("50"), 50);
  });
  it("rejects anything else", () => {
    for (const v of ["", "-1", "51", "6.3", "abc", "1e1", "6,5"]) assert.equal(parseYears(v), null, v);
  });
});

describe("addSkills", () => {
  it("ignores duplicates case-insensitively (AC-P4)", () => {
    const { skills, error } = addSkills(["SQL"], "sql");
    assert.deepEqual(skills, ["SQL"]);
    assert.match(error ?? "", /already in your skills/);
  });
  it("splits a pasted comma-separated list", () => {
    assert.deepEqual(addSkills([], "SQL, Jira ,  Figma,").skills, ["SQL", "Jira", "Figma"]);
  });
  it("rejects skills longer than 40 characters", () => {
    const { skills, error } = addSkills([], "x".repeat(41));
    assert.deepEqual(skills, []);
    assert.ok(error);
  });
  it("stops at 40 skills", () => {
    const forty = Array.from({ length: 40 }, (_, i) => `Skill ${i}`);
    const { skills, error } = addSkills(forty, "One more");
    assert.equal(skills.length, 40);
    assert.ok(error);
  });
});

describe("parseLocations", () => {
  it("splits, trims and de-duplicates", () => {
    assert.deepEqual(parseLocations(" Bengaluru, pune ,Pune,, "), ["Bengaluru", "pune"]);
  });
});

describe("stored profile", () => {
  it("round-trips a saved profile for editing (AC-P3)", () => {
    const { profile } = validateDraft(VALID);
    const raw = JSON.stringify({ ...profile, updatedAt: "2026-11-24T10:00:00.000Z" });
    const loaded = parseStoredProfile(raw);
    assert.ok(loaded);
    assert.deepEqual(profileToDraft(loaded), VALID);
    assert.ok(sameProfile(profile, loaded));
  });
  it("treats missing, corrupted or invalid data as no profile", () => {
    assert.equal(parseStoredProfile(null), null);
    assert.equal(parseStoredProfile("{not json"), null);
    assert.equal(parseStoredProfile(JSON.stringify({ currentRole: "BA" })), null);
  });
});
