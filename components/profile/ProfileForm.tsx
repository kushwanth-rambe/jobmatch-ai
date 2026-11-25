"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import {
  EMPTY_DRAFT,
  LIMITS,
  WORK_MODES,
  addSkills,
  locationRequired,
  parseStoredProfile,
  profileToDraft,
  readProfileRaw,
  sameProfile,
  saveProfile,
  subscribeToProfile,
  validateDraft,
  type ProfileDraft,
  type ProfileField,
} from "@/lib/profile";
import type { Profile, WorkMode } from "@/lib/types";

const FIELD_LABELS: Record<ProfileField, string> = {
  currentRole: "Current role",
  targetRole: "Target role",
  yearsExperience: "Years of experience",
  skills: "Skills",
  location: "Preferred location",
  workModes: "Work mode",
  experienceHighlights: "Experience highlights",
};

const serverSnapshot = () => undefined;

/**
 * Loads any saved profile from this browser, then shows the form.
 * The server can't see browser storage, so it renders a short loading state first.
 */
export function ProfileEditor() {
  const raw = useSyncExternalStore<string | null | undefined>(subscribeToProfile, readProfileRaw, serverSnapshot);
  if (raw === undefined) return <FormLoading />;
  return <ProfileForm saved={parseStoredProfile(raw)} />;
}

function FormLoading() {
  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-8" aria-busy="true">
      <p className="text-sm text-subtle">Loading your profile…</p>
      <div className="mt-6 space-y-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-32 rounded bg-surface-muted" />
            <div className="h-11 rounded-lg bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileForm({ saved }: { saved: Profile | null }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDraft>(() => (saved ? profileToDraft(saved) : EMPTY_DRAFT));
  const [touched, setTouched] = useState<Set<ProfileField>>(() => new Set());
  const [skillInput, setSkillInput] = useState("");
  const [skillMessage, setSkillMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const { errors, profile } = validateDraft(draft);
  const isValid = profile !== null;
  const hasUnsavedChanges = saved ? !sameProfile(profile, saved) : true;

  const showError = (field: ProfileField) => (touched.has(field) ? errors[field] : undefined);

  function update<K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) {
    setDraft((d) => ({ ...d, [field]: value }));
    setStatus(null);
  }

  function touch(field: ProfileField) {
    setTouched((t) => (t.has(field) ? t : new Set(t).add(field)));
  }

  function handleAddSkill() {
    const { skills, error } = addSkills(draft.skills, skillInput);
    update("skills", skills);
    setSkillMessage(error ?? null);
    if (!error || skills.length !== draft.skills.length) setSkillInput("");
    touch("skills");
  }

  function handleSkillKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (skillInput.trim()) handleAddSkill();
    }
  }

  function removeSkill(skill: string) {
    update(
      "skills",
      draft.skills.filter((s) => s !== skill),
    );
    setSkillMessage(null);
    touch("skills");
  }

  function toggleWorkMode(mode: WorkMode) {
    const next = draft.workModes.includes(mode)
      ? draft.workModes.filter((m) => m !== mode)
      : [...draft.workModes, mode];
    update("workModes", next);
    touch("workModes");
  }

  /** Saves if anything changed. Returns false if the browser refused to store it. */
  function save(): boolean {
    if (!profile) return false;
    if (!hasUnsavedChanges) return true;
    const result = saveProfile(profile);
    if (!result) {
      setStatus({
        tone: "error",
        text: "Your browser didn't allow the profile to be saved. Check that site data isn't blocked, or try a non-private window.",
      });
      return false;
    }
    setStatus({ tone: "success", text: saved ? "Profile updated." : "Profile saved on this device." });
    return true;
  }

  function handleContinue() {
    if (save()) router.push("/analyze");
  }

  const missing = (Object.keys(errors) as ProfileField[]).map((f) => FIELD_LABELS[f]);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        handleContinue();
      }}
      className="mt-6"
    >
      {saved && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-brand">
            <span aria-hidden="true">✓</span> Profile saved on this device
          </span>
          <span className="text-subtle">Edit any field below and save to update it.</span>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Current role" required error={showError("currentRole")} hint="Your job title today.">
            {(p) => (
              <input
                {...p}
                type="text"
                autoComplete="organization-title"
                placeholder="e.g. Senior Business Analyst"
                maxLength={LIMITS.roleMax + 20}
                value={draft.currentRole}
                onChange={(e) => update("currentRole", e.target.value)}
                onBlur={() => touch("currentRole")}
                className={inputClass(!!showError("currentRole"))}
              />
            )}
          </Field>

          <Field label="Target role" required error={showError("targetRole")} hint="The role you want to move into.">
            {(p) => (
              <input
                {...p}
                type="text"
                placeholder="e.g. Product Manager"
                maxLength={LIMITS.roleMax + 20}
                value={draft.targetRole}
                onChange={(e) => update("targetRole", e.target.value)}
                onBlur={() => touch("targetRole")}
                className={inputClass(!!showError("targetRole"))}
              />
            )}
          </Field>

          <Field
            label="Years of professional experience"
            required
            error={showError("yearsExperience")}
            hint="Whole or half years, e.g. 6 or 6.5."
          >
            {(p) => (
              <input
                {...p}
                type="text"
                inputMode="decimal"
                placeholder="e.g. 6"
                value={draft.yearsExperience}
                onChange={(e) => update("yearsExperience", e.target.value)}
                onBlur={() => touch("yearsExperience")}
                className={`${inputClass(!!showError("yearsExperience"))} sm:max-w-40`}
              />
            )}
          </Field>
        </div>

        {/* Skills */}
        <SkillsField
          skills={draft.skills}
          input={skillInput}
          onInput={(v) => {
            setSkillInput(v);
            setSkillMessage(null);
          }}
          onKeyDown={handleSkillKeyDown}
          onAdd={handleAddSkill}
          onRemove={removeSkill}
          message={skillMessage}
          error={showError("skills")}
        />

        {/* Work mode + location */}
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <fieldset aria-describedby={showError("workModes") ? "workmodes-error" : undefined}>
            <legend className="text-sm font-medium">
              Work mode <RequiredMark />
            </legend>
            <p className="mt-1 text-sm text-subtle">Choose all that suit you.</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {WORK_MODES.map((m) => (
                <label
                  key={m.value}
                  className="inline-flex h-11 cursor-pointer select-none items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={draft.workModes.includes(m.value)}
                    onChange={() => toggleWorkMode(m.value)}
                  />
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 items-center justify-center rounded-full border text-[10px] ${
                      draft.workModes.includes(m.value)
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-subtle"
                    }`}
                  >
                    {draft.workModes.includes(m.value) ? "✓" : ""}
                  </span>
                  {m.label}
                </label>
              ))}
            </div>
            {showError("workModes") && <ErrorText id="workmodes-error">{showError("workModes")}</ErrorText>}
          </fieldset>

          <Field
            label="Preferred location"
            required={locationRequired(draft.workModes)}
            optionalText={draft.workModes.length > 0 && !locationRequired(draft.workModes) ? "optional for remote" : undefined}
            error={showError("location")}
            hint="City or region. Separate several with commas."
          >
            {(p) => (
              <input
                {...p}
                type="text"
                autoComplete="address-level2"
                placeholder="e.g. Bengaluru, Pune"
                maxLength={LIMITS.locationMax + 20}
                value={draft.location}
                onChange={(e) => update("location", e.target.value)}
                onBlur={() => touch("location")}
                className={inputClass(!!showError("location"))}
              />
            )}
          </Field>
        </div>

        {/* Highlights */}
        <div className="mt-6">
          <Field
            label="Experience highlights"
            optionalText="optional"
            error={showError("experienceHighlights")}
            hint="Key tools, achievements and domains. Only include what's true — this helps the analysis find evidence beyond your skills list."
          >
            {(p) => (
              <>
                <textarea
                  {...p}
                  rows={4}
                  placeholder="e.g. Led requirements for a payments app; ran A/B tests with the growth team"
                  value={draft.experienceHighlights}
                  onChange={(e) => update("experienceHighlights", e.target.value)}
                  onBlur={() => touch("experienceHighlights")}
                  className={`${inputClass(!!showError("experienceHighlights"))} h-auto min-h-28 py-2.5 leading-relaxed`}
                />
                <p
                  className={`mt-1 text-right text-xs ${
                    draft.experienceHighlights.trim().length > LIMITS.highlightsMax ? "text-red-600 dark:text-red-400" : "text-subtle"
                  }`}
                >
                  {draft.experienceHighlights.trim().length} / {LIMITS.highlightsMax}
                </p>
              </>
            )}
          </Field>
        </div>

        <p className="mt-4 rounded-lg bg-surface-muted px-3.5 py-2.5 text-xs leading-relaxed text-muted">
          Please don&apos;t enter sensitive personal details such as ID numbers, your home address or phone number.
          Your profile is stored only in this browser.
        </p>
      </div>

      {/* Status + actions */}
      <div className="mt-6">
        <div aria-live="polite" className="min-h-0">
          {status && (
            <p
              className={`mb-4 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                status.tone === "success"
                  ? "bg-brand-soft text-brand-strong"
                  : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              {status.text}
            </p>
          )}
        </div>

        {!isValid && (
          <p className="mb-4 text-sm text-muted">
            <span className="font-medium text-foreground">To continue, complete:</span> {missing.join(", ")}.
          </p>
        )}
        {isValid && saved && hasUnsavedChanges && !status && (
          <p className="mb-4 text-sm text-accent">You have unsaved changes.</p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            ← Home
          </Link>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={save}
              disabled={!isValid || !hasUnsavedChanges}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface"
            >
              {saved && !hasUnsavedChanges ? "Saved" : "Save profile"}
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
            >
              {hasUnsavedChanges ? "Save & add job description →" : "Add Job Description →"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* ---------- Small building blocks ---------- */

function inputClass(invalid: boolean) {
  return `block h-11 w-full rounded-lg border bg-surface px-3.5 text-base text-foreground placeholder:text-subtle transition-colors focus:outline-2 focus:outline-offset-0 focus:outline-ring sm:text-sm ${
    invalid ? "border-red-500 dark:border-red-400" : "border-border"
  }`;
}

function RequiredMark() {
  return (
    <span className="text-accent" aria-hidden="true">
      *
    </span>
  );
}

function ErrorText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}

type ControlProps = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

function Field({
  label,
  required,
  optionalText,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optionalText?: string;
  hint?: string;
  error?: string;
  children: (props: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label} {required && <RequiredMark />}
        {optionalText && <span className="font-normal text-subtle"> ({optionalText})</span>}
      </label>
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-subtle">
          {hint}
        </p>
      )}
      <div className="mt-2">
        {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy, "aria-required": required || undefined })}
      </div>
      {error && <ErrorText id={errorId}>{error}</ErrorText>}
    </div>
  );
}

function SkillsField({
  skills,
  input,
  onInput,
  onKeyDown,
  onAdd,
  onRemove,
  message,
  error,
}: {
  skills: string[];
  input: string;
  onInput: (v: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onAdd: () => void;
  onRemove: (skill: string) => void;
  message: string | null;
  error?: string;
}) {
  const id = useId();
  const remaining = Math.max(0, LIMITS.skillsMin - skills.length);
  return (
    <div className="mt-6">
      <label htmlFor={id} className="text-sm font-medium">
        Professional skills <RequiredMark />
      </label>
      <p id={`${id}-hint`} className="mt-1 text-sm text-subtle">
        Add at least {LIMITS.skillsMin}. Press Enter or comma after each skill, or paste a comma-separated list.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          type="text"
          placeholder="e.g. SQL"
          value={input}
          maxLength={200}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKeyDown}
          aria-describedby={`${id}-hint ${id}-status`}
          aria-invalid={!!error}
          className={inputClass(!!error)}
        />
        <button
          type="button"
          onClick={onAdd}
          disabled={!input.trim()}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {skills.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your skills">
          {skills.map((skill) => (
            <li
              key={skill}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/30 bg-brand-soft py-1 pl-3 pr-1 text-sm"
            >
              <span className="truncate">{skill}</span>
              <button
                type="button"
                onClick={() => onRemove(skill)}
                aria-label={`Remove ${skill}`}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-foreground"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p
        id={`${id}-status`}
        aria-live="polite"
        className={`mt-2 text-sm ${message || error ? "text-red-600 dark:text-red-400" : "text-subtle"}`}
      >
        {message ??
          error ??
          (remaining > 0
            ? `Add at least ${LIMITS.skillsMin} skills (${remaining} more needed).`
            : `${skills.length} skill${skills.length === 1 ? "" : "s"} added.`)}
      </p>
    </div>
  );
}
