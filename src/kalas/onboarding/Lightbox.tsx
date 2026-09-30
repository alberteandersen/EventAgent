import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLang } from '../i18n';

/**
 * Fullscreen image viewer. Renders through a portal so it sits above the
 * onboarding drawer/footer, closes on backdrop click / Esc / the X button,
 * and supports arrow-key + on-screen navigation when given multiple photos.
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
  alt = '',
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
  alt?: string;
}) {
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const count = photos.length;
  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      onIndex((index + delta + count) % count);
    },
    [count, index, onIndex],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  if (!mounted) return null;
  const src = photos[index];
  if (!src) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="lightbox"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-deep/90 p-4 backdrop-blur-sm sm:p-8"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Luk')}
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer"
        >
          <X size={20} />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              aria-label={t('Forrige')}
              className="absolute left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer sm:left-6"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(1); }}
              aria-label={t('Næste')}
              className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 cursor-pointer sm:right-6"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        <motion.img
          key={src}
          src={src}
          alt={alt}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-2xl object-contain shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
        />

        {count > 1 && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/12 px-3.5 py-1.5 text-[0.75rem] font-medium tracking-wide text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {index + 1} / {count}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
