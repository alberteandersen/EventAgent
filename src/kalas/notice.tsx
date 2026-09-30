"use client";

/* A short confirmation ("Kongsgaarden er nu jeres venue"), shown through the
   same Toaster as the Fortryd toasts (mounted by UndoProvider), so the two
   stack instead of landing on top of each other. */

import { AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';

export function showNotice(title: string, body?: string) {
  toast.custom(() => (
    <div className="mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-3.5 rounded-full bg-ink py-3 pl-4 pr-5 font-sans shadow-[0_16px_48px_rgba(18,51,43,0.32)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage">
        <Check size={16} className="text-white" strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-serif text-[0.98rem] leading-snug text-canvas">{title}</p>
        {body && <p className="text-[0.72rem] text-canvas/70">{body}</p>}
      </div>
    </div>
  ), { duration: 3800 });
}

/** Something the couple did did not go through. One at a time: a burst of
 *  failures (offline) shows a single toast, not a stack. */
export function showError(title: string, body?: string) {
  toast.custom(() => (
    <div role="alert" className="mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-3.5 rounded-full bg-ink py-3 pl-4 pr-5 font-sans shadow-[0_16px_48px_rgba(18,51,43,0.32)]">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta">
        <AlertCircle size={16} className="text-white" strokeWidth={2.5} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-serif text-[0.98rem] leading-snug text-canvas">{title}</p>
        {body && <p className="text-[0.72rem] text-canvas/70">{body}</p>}
      </div>
    </div>
  ), { id: 'kalas-error', duration: 5200 });
}
