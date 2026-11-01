'use client';

import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useLang } from '../i18n';
import { Button } from './Button';
import { cn } from './base';

/* The one modal. A sheet from the bottom on a phone, a card in the middle
   from sm up. It is portalled to <body> so no sticky header or overflow
   clips it, inside a .theme-kalas wrapper so the app's colours and fonts
   come along. Focus moves in when it opens, stays in while it is open, and
   goes back where it was when it closes; Escape and the backdrop close it. */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const WIDTH = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' } as const;

const noop = () => () => {};

export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  size = 'md',
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  size?: keyof typeof WIDTH;
  /** Actions, right-aligned under the body. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  // No document during a server render; the portal waits for the client.
  const onClient = useSyncExternalStore(noop, () => true, () => false);
  if (!onClient) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogPanel onClose={onClose} title={title} eyebrow={eyebrow} description={description} size={size} footer={footer}>
          {children}
        </DialogPanel>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DialogPanel({
  onClose, title, eyebrow, description, size, footer, children,
}: {
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  size: keyof typeof WIDTH;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useLang();
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="theme-kalas font-sans text-ink">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-6"
        onClick={onClose}
      >
        <motion.div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line bg-card shadow-[0_32px_80px_-16px_rgba(18,51,43,0.28)] outline-none sm:max-h-[88vh] sm:rounded-[24px]',
            WIDTH[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div className="min-w-0">
              {eyebrow && <p className="eyebrow">{eyebrow}</p>}
              <h2 id={titleId} className="mt-0.5 font-serif text-title text-ink">{title}</h2>
              {description && <div className="mt-1 text-meta text-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('Luk')}
              className="-mr-1.5 shrink-0 cursor-pointer rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {children && <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>}
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ── Confirm ─────────────────────────────────────────────────────────────
   `await confirm({ title })` instead of window.confirm, which is unstyled,
   blocks the page and cannot be translated. Resolves true on the confirm
   button, false on anything else. */

export type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button, for what cannot be undone. */
  danger?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

// Outside a provider (a dev harness), the browser's own dialog still works.
const ConfirmCtx = createContext<Confirm>(async ({ title, body }) =>
  window.confirm(body ? `${title}\n\n${body}` : title),
);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback<Confirm>(
    (options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );
  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>{pending?.cancelLabel ?? t('Annuller')}</Button>
            <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => settle(true)} data-autofocus>
              {pending?.confirmLabel ?? t('OK')}
            </Button>
          </>
        }
      >
        {pending?.body && <p className="text-sm text-ink-soft">{pending.body}</p>}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): Confirm {
  return useContext(ConfirmCtx);
}
