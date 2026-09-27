"use client";

/* The couple's own photo on the home hero. Reuses the site-photo pipeline
   rather than inventing a second one: the picture is stored in the private
   `site-photos` bucket with role='hero', which is the same photo the website
   builder treats as the front-page favourite. Upload here and it shows both
   places, there is only ever one hero per event, enforced by the API.

   The bucket is private, so the URL has to be signed per request; sitePhotos
   in context carries only storage paths. */

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import { normalizeImage } from '../../site/normalizeImage';
import type { SitePhotoRow } from '@/lib/db/types';

export default function HeroPhoto({
  fallback,
  alt,
  className,
  frameClassName,
}: {
  fallback: string;
  alt: string;
  /* The frame is the caller's business: the home hero wants a wide 380px
     panel, the registry header a small square beside the couple's name.
     Baking the hero's size into the component made it burst out of any
     narrower column it was put in. */
  className?: string;
  frameClassName?: string;
}) {
  const { t } = useLang();
  const { event, sitePhotos, refresh } = useWedding();
  // Keyed by the photo it belongs to, so a stale signed URL is never shown
  // against a newly chosen picture — and so the effect only writes state after
  // an await, never synchronously.
  const [signed, setSigned] = useState<{ id: string; url: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const heroId = sitePhotos.find((p) => p.role === 'hero')?.id ?? null;
  const url = heroId && signed?.id === heroId ? signed.url : null;

  // Same shape as the photo fetch in Website.tsx: the signed URL only exists
  // server-side, so it has to be asked for whenever the hero changes.
  useEffect(() => {
    if (!event || !heroId || signed?.id === heroId) return;
    let alive = true;
    fetch(`/api/website/photos?eventId=${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { photos?: (SitePhotoRow & { url: string | null })[] } | null) => {
        if (!alive || !d?.photos) return;
        setSigned({ id: heroId, url: d.photos.find((p) => p.id === heroId)?.url ?? null });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [event, heroId, signed]);

  const pick = (file: File | null) => {
    if (!file || !event) return;
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        // iPhones hand us HEIC and 10 MB originals; the API takes jpeg/png/webp
        // under 8 MB.
        const ready = await normalizeImage(file);
        if (!ready) { setError(t('Billedet kunne ikke læses, prøv et andet.')); return; }
        const form = new FormData();
        form.append('file', ready);
        form.append('eventId', event.id);
        form.append('role', 'hero');
        const res = await fetch('/api/website/photos', { method: 'POST', body: form });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? t('Billedet kunne ikke gemmes.'));
          return;
        }
        const data = (await res.json()) as { photo?: { id: string; url: string | null } };
        // Show it straight away; refresh() then catches sitePhotos up and the
        // id lines up with the new hero.
        if (data.photo) setSigned({ id: data.photo.id, url: data.photo.url });
        await refresh();
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    })();
  };

  /** Back to the default picture. The photo stays in their website gallery —
   *  demoting is recoverable, deleting is not. */
  const clear = async () => {
    if (!heroId) return;
    setBusy(true);
    try {
      await fetch(`/api/website/photos/${heroId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'gallery' }),
      });
      setSigned(null);
      await refresh();
    } finally { setBusy(false); }
  };

  const shown = url ?? fallback;

  return (
    <div className={cn('flex w-full shrink-0 flex-col gap-2', className ?? 'lg:w-[380px]')}>
      <div
        className={cn(
          'group relative w-full rounded-[22px] border-[6px] border-[#f8f6f0] bg-cover bg-center shadow-[0_16px_40px_rgba(36,65,58,0.18)]',
          frameClassName ?? 'h-[240px] lg:h-[300px]',
        )}
        style={{ backgroundImage: `url('${shown}')` }}
        role="img"
        aria-label={alt}
      >
        <div className={cn(
          'absolute inset-0 flex items-center justify-center gap-2 rounded-[16px] bg-[#141a13]/35 transition-opacity duration-200',
          busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
        )}>
          {busy ? (
            <Loader2 size={20} className="animate-spin text-white" aria-hidden />
          ) : (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[0.78rem] font-semibold text-ink transition-colors hover:bg-white cursor-pointer"
              >
                <Camera size={14} />
                {url ? t('Skift billede') : t('Vælg jeres billede')}
              </button>
              {url && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-full bg-white/85 px-3 py-2 text-[0.78rem] font-medium text-ink transition-colors hover:bg-white cursor-pointer"
                >
                  {t('Fjern')}
                </button>
              )}
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="sr-only"
          aria-label={t('Vælg jeres billede')}
        />
      </div>

      {error && <p role="alert" className="px-1 text-[0.78rem] text-terracotta">{error}</p>}
      {url && !error && (
        <p className="px-1 text-[0.72rem] text-sage">{t('Billedet bruges også som forside på jeres bryllupsside.')}</p>
      )}
    </div>
  );
}
