import { useEffect, useState } from 'react';
import { MoreHorizontal, RotateCcw } from 'lucide-react';
import { useLang } from '../../i18n';

/**
 * Starting a tab over, tucked behind "⋯". It used to be a Nulstil button in
 * plain sight whose "Sikker?" stood for four seconds, and a reset throws away
 * every tick and every item the couple wrote themselves, which is why the
 * confirmation says how many of each before anything happens.
 */
export default function ResetControl({ itemLabel, confirmTitle, detail, onReset }: {
  /** Danish source strings for t(). */
  itemLabel: string;
  confirmTitle: string;
  /** Already translated: what will be lost, with the numbers in it. */
  detail: string;
  onReset: () => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState<'menu' | 'confirm' | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(open ? null : 'menu')}
        aria-label={t('Flere handlinger')}
        aria-expanded={open !== null}
        className="flex size-8 items-center justify-center rounded-full border border-line bg-card text-muted transition-colors hover:text-ink cursor-pointer"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(null)} />
          <div className="absolute right-0 top-10 z-50 w-[min(300px,calc(100vw-48px))] overflow-hidden rounded-[14px] border border-line bg-card shadow-[0_16px_40px_-12px_rgba(20,26,19,0.25)]">
            {open === 'menu' ? (
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => setOpen('confirm')}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-ink transition-colors hover:bg-shell cursor-pointer"
                >
                  <RotateCcw size={14} className="text-muted" /> {t(itemLabel)}
                </button>
              </div>
            ) : (
              <div role="alertdialog" aria-label={t(confirmTitle)} className="p-4">
                <p className="font-serif text-lg leading-snug text-ink">{t(confirmTitle)}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{detail}</p>
                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setOpen(null); onReset(); }}
                    className="h-8 rounded-full bg-terracotta px-3.5 text-xs font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer"
                  >
                    {t('Gendan')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    autoFocus
                    className="h-8 rounded-full border border-line px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-shell cursor-pointer"
                  >
                    {t('Behold')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
