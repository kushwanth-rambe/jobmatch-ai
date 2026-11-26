import { JOURNEY_STEPS, type JourneyStepNumber } from "@/lib/journey";

type Props = {
  /** The step(s) shown on the current page, e.g. [4] on the Application Decision page. */
  current: JourneyStepNumber[];
};

export function JourneySteps({ current }: Props) {
  const first = Math.min(...current);
  const currentLabel = JOURNEY_STEPS.filter((s) => current.includes(s.number))
    .map((s) => s.label)
    .join(" & ");
  const stepText = current.length > 1 ? `Steps ${current.join(" & ")} of 4` : `Step ${first} of 4`;

  return (
    <nav aria-label="Your progress">
      {/* Phone: compact summary + progress bar */}
      <div className="md:hidden">
        <p className="text-sm text-subtle">
          {stepText} · <span className="font-medium text-foreground">{currentLabel}</span>
        </p>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {JOURNEY_STEPS.map((s) => (
            <span
              key={s.number}
              className={`h-1.5 rounded-full ${s.number <= Math.max(...current) ? "bg-brand" : "bg-border"}`}
            />
          ))}
        </div>
      </div>

      {/* Tablet and desktop: all four steps */}
      <ol className="hidden items-center gap-2 md:flex">
        {JOURNEY_STEPS.map((s, i) => {
          const isCurrent = current.includes(s.number);
          const isDone = s.number < first;
          return (
            <li key={s.number} className="flex flex-1 items-center gap-2">
              <span
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm whitespace-nowrap ${
                  isCurrent
                    ? "border-brand bg-brand-soft font-medium text-foreground"
                    : isDone
                      ? "border-border bg-surface text-muted"
                      : "border-border bg-surface text-subtle"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent || isDone ? "bg-brand text-brand-foreground" : "bg-surface-muted text-subtle"
                  }`}
                >
                  {isDone ? "✓" : s.number}
                </span>
                <span className="lg:hidden">{s.shortLabel}</span>
                <span className="hidden lg:inline">{s.label}</span>
              </span>
              {i < JOURNEY_STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
