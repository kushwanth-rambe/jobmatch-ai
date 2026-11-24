/** JobMatch AI mark: two overlapping circles (you + the job) with a check. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <circle cx="13" cy="16" r="6.5" fill="none" strokeWidth="2" className="stroke-brand-foreground" opacity="0.6" />
      <circle cx="19" cy="16" r="6.5" fill="none" strokeWidth="2" className="stroke-brand-foreground" />
      <path d="M13.5 16.2l2 2 3.8-4" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-brand-foreground" />
    </svg>
  );
}
