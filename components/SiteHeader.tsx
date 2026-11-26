import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-md">
          <LogoMark />
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            JobMatch <span className="text-brand">AI</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/opportunities"
            className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <span className="sm:hidden">My jobs</span>
            <span className="hidden sm:inline">My opportunities</span>
          </Link>
          <Link
            href="/profile"
            className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-strong"
          >
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Check a job fit</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
