"use client";

import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * A button that asks "Are you sure?" in a small dialog before doing something
 * that can't be undone (delete a job, clear this device).
 * Uses the browser's built-in <dialog>: keyboard focus stays inside, Esc cancels.
 */
export function ConfirmButton({
  children,
  className,
  title,
  message,
  confirmLabel,
  onConfirm,
  ariaLabel,
}: {
  children: ReactNode;
  className: string;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  // If the page is hidden (kept alive by Next.js for back-navigation), close the dialog.
  useLayoutEffect(() => {
    const dialog = ref.current;
    return () => dialog?.close();
  }, []);

  return (
    <>
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => ref.current?.showModal()}>
        {children}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) ref.current?.close(); // click on the backdrop cancels
        }}
      >
        <div className="p-5 sm:p-6">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          <div id={`${id}-text`} className="mt-2 text-sm text-muted">
            {message}
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => ref.current?.close()}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium transition-colors hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                ref.current?.close();
                onConfirm();
              }}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-red-600 px-5 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
