import Link from "next/link";

const HOW_IT_WORKS = [
  {
    title: "Add your profile",
    body: "Current role, target role, years of experience, skills and preferred location. About a minute, saved on this device.",
  },
  {
    title: "Paste a job",
    body: "Copy the job description from any job site and paste it in. Add the original link so you can find it again.",
  },
  {
    title: "Get your match analysis",
    body: "See where you match, what's missing or unproven, and what to clarify — then save the job or mark it as applied.",
  },
];

const ANALYSIS_SECTIONS = [
  {
    icon: "✓",
    title: "Matching skills",
    body: "Requirements your profile clearly covers, with the evidence from your profile.",
  },
  {
    icon: "!",
    title: "Missing or unproven skills",
    body: "What the job asks for that your profile doesn't show yet — so you know your gaps.",
  },
  {
    icon: "↔",
    title: "Experience alignment",
    body: "Required years and seniority compared with yours, explained in one line.",
  },
  {
    icon: "?",
    title: "Requirements to clarify",
    body: "Vague or unusual asks, with a polite question you could put to the recruiter.",
  },
];

const TRUST_POINTS = [
  {
    title: "No invented qualifications",
    body: "Every match must point to something in your profile. If it doesn't, it's shown as unproven.",
  },
  {
    title: "No hiring predictions",
    body: "You get an explained comparison with the job description — never a “chance of being hired”.",
  },
  {
    title: "No sign-up, your data stays here",
    body: "Your profile and saved jobs stay in this browser. No account needed.",
  },
];

/** Empty outline of the analysis screen. Shows layout only — no sample results. */
function AnalysisOutline() {
  return (
    <div aria-hidden="true" className="rounded-2xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-3 w-32 rounded bg-surface-muted" />
          <div className="h-2.5 w-20 rounded bg-surface-muted" />
        </div>
        <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">Alignment</span>
      </div>
      <div className="mt-5 space-y-3">
        {ANALYSIS_SECTIONS.map((s) => (
          <div key={s.title} className="rounded-xl border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-xs text-brand">
                {s.icon}
              </span>
              {s.title}
            </p>
            <div className="mt-2.5 space-y-1.5 pl-8">
              <div className="h-2 w-11/12 rounded bg-surface-muted" />
              <div className="h-2 w-2/3 rounded bg-surface-muted" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-9 rounded-lg bg-surface-muted" />
        <div className="h-9 rounded-lg bg-brand/80" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 md:pb-16 md:pt-14 lg:grid-cols-2 lg:gap-12 lg:pb-20 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            For professionals exploring their next move
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Smarter Job Search, <span className="text-brand">Better Career Matches.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Check how well a job matches your skills and experience. See your strengths, your gaps and what to
            clarify — then decide whether to apply.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/profile"
              className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-lg bg-brand px-6 text-base font-medium text-brand-foreground shadow-sm transition-colors hover:bg-brand-strong"
            >
              Check a job fit — no sign-up needed
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-lg border border-border bg-surface px-6 text-base font-medium transition-colors hover:bg-surface-muted"
            >
              How it works
            </a>
          </div>
          <p className="mt-4 text-sm text-subtle">Free · Works with any job site · About two minutes per job</p>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <AnalysisOutline />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <p className="mt-2 text-muted">Three steps. One clear decision per job.</p>
          <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title} className="rounded-2xl border border-border bg-background p-5 sm:p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What your JobMatch Analysis shows</h2>
        <p className="mt-2 max-w-2xl text-muted">
          A structured comparison of the job&apos;s requirements with your profile — every point backed by the job
          description or your own profile.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ANALYSIS_SECTIONS.map((s) => (
            <div key={s.title} className="rounded-2xl border border-border bg-surface p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand" aria-hidden="true">
                {s.icon}
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Honest by design</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {TRUST_POINTS.map((p) => (
              <div key={p.title}>
                <h3 className="font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start gap-4 rounded-2xl bg-brand-soft p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium">Found a job that looks interesting? Check your fit before you apply.</p>
            <Link
              href="/profile"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
