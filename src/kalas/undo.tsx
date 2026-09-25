"use client";

/* Deleting with a way back. A row the couple removes disappears at once but
   is only deleted for real when the toast closes, so Fortryd is just "stop
   hiding it": the row keeps its id, its RSVP link and its seat. Screens hide
   pending rows with isPending(). Outside a provider (a harness without one)
   remove() deletes straight away, as it did before. */

import * as React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { useLang } from './i18n';

const UNDO_MS = 6000;

interface RemoveOptions {
  /** The rows to hide until the toast closes. */
  ids: string | string[];
  /** What the toast says, e.g. "Mette Holm er fjernet". */
  label: string;
  /** The real delete; runs when the toast times out or is swiped away. */
  commit: () => unknown;
}

interface UndoCtx {
  remove: (opts: RemoveOptions) => void;
  isPending: (id: string) => boolean;
}

const Ctx = createContext<UndoCtx | null>(null);

const FALLBACK: UndoCtx = {
  remove: ({ commit }) => { void commit(); },
  isPending: () => false,
};

export function useUndo(): UndoCtx {
  return useContext(Ctx) ?? FALLBACK;
}

/** `rows` without the ones waiting on a Fortryd toast. For what a screen
 *  shows and counts; seeding logic should keep reading the full list. */
export function useWithoutPending<T extends { id: string }>(rows: T[]): T[] {
  const { isPending } = useUndo();
  return useMemo(() => rows.filter((r) => !isPending(r.id)), [rows, isPending]);
}

/** Removes a single row behind a Fortryd toast. `name` goes through t(),
 *  since seeded rows (tasks, programme items) are shown translated. */
export function useRemoveWithUndo() {
  const { remove } = useUndo();
  const { t } = useLang();
  return useCallback(
    (id: string, name: string, commit: () => unknown) =>
      remove({ ids: id, label: t('{name} er fjernet', { name: t(name) }), commit }),
    [remove, t],
  );
}

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const [pending, setPending] = useState<ReadonlySet<string>>(() => new Set());
  // Keyed by toast id. An entry leaves the map the moment it is either
  // committed or undone, so the two can never both happen.
  const entries = useRef(new Map<string, { ids: string[]; commit: () => unknown }>());

  const unhide = useCallback((ids: string[]) => {
    setPending((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  const finalize = useCallback((key: string) => {
    const entry = entries.current.get(key);
    if (!entry) return;
    entries.current.delete(key);
    // Unhide only once the delete has landed, so the row doesn't flash back
    // in between; if it failed, the row coming back is the truth.
    Promise.resolve()
      .then(entry.commit)
      .catch(() => {})
      .finally(() => unhide(entry.ids));
  }, [unhide]);

  const undo = useCallback((key: string) => {
    const entry = entries.current.get(key);
    if (!entry) return;
    entries.current.delete(key);
    unhide(entry.ids);
    toast.dismiss(key);
  }, [unhide]);

  const remove = useCallback(({ ids, label, commit }: RemoveOptions) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length === 0) return;
    const key = `undo:${list.join(',')}`;
    entries.current.set(key, { ids: list, commit });
    setPending((prev) => new Set([...prev, ...list]));
    toast.custom(
      () => <UndoToast label={label} action={t('Fortryd')} onUndo={() => undo(key)} />,
      { id: key, duration: UNDO_MS, onAutoClose: () => finalize(key), onDismiss: () => finalize(key) },
    );
  }, [finalize, undo, t]);

  // Leaving the page (or signing out) is not a reason to keep a row the
  // couple removed: commit whatever is still waiting.
  useEffect(() => {
    const flush = () => { for (const key of [...entries.current.keys()]) finalize(key); };
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('pagehide', flush); flush(); };
  }, [finalize]);

  const isPending = useCallback((id: string) => pending.has(id), [pending]);
  const value = useMemo<UndoCtx>(() => ({ remove, isPending }), [remove, isPending]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Above the phone's bottom bar; the offset lives in globals.css. The
          wrapper carries the app's tokens wherever the provider is mounted. */}
      <div className="theme-kalas">
        <Toaster position="bottom-center" offset={{ bottom: 'var(--kalas-toast-bottom)' }}
          mobileOffset={{ bottom: 'var(--kalas-toast-bottom)' }} gap={10}
          // Headless toasts size to their content; centre them in the column.
          toastOptions={{ className: 'w-full flex justify-center' }} />
      </div>
    </Ctx.Provider>
  );
}

function UndoToast({ label, action, onUndo }: { label: string; action: string; onUndo: () => void }) {
  return (
    <div className="mx-auto flex w-fit max-w-[calc(100vw-32px)] items-center gap-3 rounded-full bg-ink py-1.5 pl-5 pr-1.5 font-sans text-[0.84rem] text-canvas shadow-[0_10px_30px_rgba(36,65,58,0.22)]">
      <span className="min-w-0 truncate">{label}</span>
      <button type="button" onClick={onUndo}
        className="shrink-0 cursor-pointer rounded-full bg-white/12 px-3.5 py-1.5 font-semibold transition-colors hover:bg-white/20">
        {action}
      </button>
    </div>
  );
}
