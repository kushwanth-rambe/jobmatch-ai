# JobMatch AI

**Smarter Job Search, Better Career Matches.**

JobMatch AI helps professionals exploring a job move check how well a specific job matches their skills and experience: matching skills, missing or unproven skills, experience alignment and requirements to clarify, followed by a clear decision (save it or mark it as applied).

The product specification is in [`JOBMATCH_AI_PRODUCT_SPEC.md`](./JOBMATCH_AI_PRODUCT_SPEC.md).

## Status

**Release 1 · Milestones M2 + M3 — JobMatch Analysis and Application Decision.**

| Route | Screen | Built in |
|---|---|---|
| `/` | Landing page | M0 ✅ |
| `/profile` | Step 1 · Professional Profile (saved in this browser) | M1 ✅ |
| `/analyze` | Step 2 · Add Job Description (paste text) | M2 ✅ |
| `/opportunity/[id]` | Step 3 · JobMatch Analysis | M2 ✅ |
| `/opportunity/[id]/decision` | Step 4 · Application Decision: summary, original job link, Save / Mark as applied | M3 ✅ |
| `/opportunities` | My opportunities: saved and applied jobs, Delete, Clear this device | M3 ✅ |
| `/api/analyze` | Server route that calls Gemini (API key stays on the server) | M2 ✅ |

Public job-URL fetching is planned for M5; M2 uses pasted job descriptions only.

## How the analysis works

1. The browser checks for a saved result for the same profile + job description (no API call if found).
2. Otherwise it sends the profile and job description to `/api/analyze`.
3. The server makes **one** Gemini call with a strict JSON output format (retrying once only if the reply is unusable).
4. App code — not the AI — then checks the result: every "matching" skill must be backed by words from the profile (otherwise it is marked *unproven*), hiring-prediction wording is removed, and the Strong / Partial / Limited level is calculated from the counts.
5. The result and the original job description are saved in the browser only.

The analysis compares the profile with the job description. It never predicts hiring success.

## Application decision and storage

- Save, Mark as applied (with today's date), Undo, Delete and Clear this device work entirely in the browser — **no API calls**.
- Up to 50 analysed jobs are kept in `localStorage`. To make room, only the oldest jobs that were **not** saved or applied are removed. Saved and Applied jobs are never removed automatically: when storage is full of them, the app warns you and asks you to delete one before analysing a new job (no API call is made).
- **Clear this device** (on My opportunities) deletes the profile, all analysed jobs and any unsent job text, after confirmation.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) with TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) for styling
- [Gemini API](https://ai.google.dev/) via `@google/genai`, default model `gemini-3.1-flash-lite`
- [Zod](https://zod.dev/) to define and check the AI's JSON output
- ESLint; tests with Node's built-in test runner
- Deployed on [Vercel](https://vercel.com/)

Not used (Release 2 only): Supabase and sign-in.

## Environment variables

Server-side only — never prefix them with `NEXT_PUBLIC_`. See [`.env.example`](./.env.example).

| Name | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes, for analysis | Google AI Studio API key. Without it the app still runs and shows a clear "not set up" message instead of analysing. |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.1-flash-lite`. Change it to compare models. |
| `GEMINI_THINKING_LEVEL` | No | `minimal`, `low`, `medium` or `high`. Defaults to `minimal` (same quality as `low` in testing, lower and more predictable cost). |

For local development put them in `.env.local` (ignored by Git). On Vercel add them under **Project → Settings → Environment Variables**.

## Run it locally

Requires Node.js 20.9 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

## Checks

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

`npm test` never calls the real API. To run the **live** check of the five sample job descriptions (small real API cost), start the app with `GEMINI_API_KEY` set, then:

```bash
npm run check:live
```

## Project structure

```
app/
  layout.tsx                  Shared page frame: header, footer, fonts, page titles
  page.tsx                    Landing page
  profile/page.tsx            Step 1 · Professional Profile
  analyze/page.tsx            Step 2 · Add Job Description
  opportunity/[id]/page.tsx   Step 3 · JobMatch Analysis
  opportunity/[id]/decision/  Step 4 · Application Decision
  opportunities/page.tsx      My opportunities
  api/analyze/route.ts        Server route: runs one analysis
components/
  profile/ProfileForm.tsx     Profile form
  job/AddJobForm.tsx          Job description form
  analysis/AnalysisView.tsx   Analysis results
  decision/DecisionView.tsx   Application Decision
  opportunities/              My opportunities list and shared pieces
  ConfirmButton.tsx           "Are you sure?" dialog for delete / clear
  JourneySteps.tsx, SiteHeader.tsx, SiteFooter.tsx, Logo.tsx
lib/
  profile.ts                  Profile rules and browser storage
  job.ts                      Job description rules and cache key
  opportunities.ts            Analysed jobs in browser storage
  analysis/                   Prompt, output schema, checks, runner, request handler, cost
  server/gemini.ts            Gemini client (server only)
  types.ts, journey.ts
scripts/live-check.mts        Manual live check against Gemini
tests/                        Unit tests and sample job descriptions (test data only)
```
