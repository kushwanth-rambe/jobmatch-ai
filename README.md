# JobMatch AI

**Smarter Job Search, Better Career Matches.**

JobMatch AI helps professionals exploring a job move check how well a specific job matches their skills and experience: matching skills, missing or unproven skills, experience alignment and requirements to clarify, followed by a clear decision (save it or mark it as applied).

The product specification is in [`JOBMATCH_AI_PRODUCT_SPEC.md`](./JOBMATCH_AI_PRODUCT_SPEC.md).

## Status

**Release 1 · Milestone M0 — project foundation.** The landing page is built. The journey screens are placeholders that describe what each screen will contain; there is no AI analysis yet.

| Route | Screen | Built in |
|---|---|---|
| `/` | Landing page | M0 ✅ |
| `/profile` | Step 1 · Professional Profile | M1 |
| `/analyze` | Step 2 · Add Job Description | M2 |
| `/opportunity/[id]` | Steps 3 & 4 · JobMatch Analysis & Application Decision | M2 (analysis), M3 (decision) |

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) with TypeScript
- [Tailwind CSS 4](https://tailwindcss.com/) for styling
- ESLint for code checks
- Deployed on [Vercel](https://vercel.com/)

Not used yet (added in later milestones per the spec): Gemini API (M2), Supabase and sign-in (Release 2 only).

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
npm run lint
```

```bash
npm run build
```

## Project structure

```
app/
  layout.tsx                 Shared page frame: header, footer, fonts, page titles
  globals.css                Tailwind setup and colour palette (light + dark)
  icon.svg                   Browser tab icon
  page.tsx                   Landing page
  profile/page.tsx           Step 1 · Professional Profile
  analyze/page.tsx           Step 2 · Add Job Description
  opportunity/[id]/page.tsx  Steps 3 & 4 · Analysis and Decision
components/
  SiteHeader.tsx, SiteFooter.tsx, Logo.tsx
  JourneySteps.tsx           Progress bar for the four-step journey
  ScreenPlaceholder.tsx      Shared layout for screens not built yet
lib/
  journey.ts                 The four journey steps
  types.ts                   Data shapes from the spec (profile, analysis, opportunity)
```

## Deploy to Vercel

Import this repository at [vercel.com/new](https://vercel.com/new). No settings or environment variables are needed for M0.
