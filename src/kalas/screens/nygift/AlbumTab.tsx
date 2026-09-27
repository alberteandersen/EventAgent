import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Link2, Check, Trash2, Heart, Loader2, ImageOff, Lock, Unlock } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useUndo, useWithoutPending } from '../../undo';
import { Lightbox } from '../../onboarding/Lightbox';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { AlbumPhotoRow } from '@/lib/db/types';

type Photo = AlbumPhotoRow & { url: string | null };

export default function AlbumTab({ onNavigate }: { onNavigate?: (s: 'website') => void }) {
  const { t } = useLang();
  const { event, weddingSite, saveSite } = useWedding();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const undo = useUndo();

  const domain = typeof weddingSite?.domain === 'string' ? weddingSite.domain : null;
  const published = Boolean(weddingSite?.published);
  const albumOpen = (weddingSite?.config as Record<string, unknown> | undefined)?.albumOpen !== false;
  const shareUrl = domain && typeof window !== 'undefined'
    ? `${window.location.origin}/w/${domain}/del`
    : null;

  const eventId = event?.id ?? null;

  // No synchronous setState here: the first state write happens after the
  // await, so mounting this tab does not cascade a render.
  const load = useCallback(async (p: number) => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/album?eventId=${eventId}&page=${p}`);
      if (!res.ok) return;
      const json = await res.json();
      setPhotos((prev) => (p === 0 ? json.photos : [...prev, ...json.photos]));
      setTotal(json.total);
      setHasMore(json.hasMore);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(0); }, [load]);

  /* A guest's photo is the one thing here that cannot be made again, so a
     delete waits behind Fortryd like a removed guest does. */
  function remove(id: string) {
    undo.remove({
      ids: id,
      label: t('Billedet er slettet'),
      commit: async () => {
        await fetch(`/api/album/${id}`, { method: 'DELETE' });
        setPhotos((prev) => prev.filter((p) => p.id !== id));
        setTotal((n) => Math.max(0, n - 1));
      },
    });
  }

  const kept = useWithoutPending(photos);
  const favorites = kept.filter((p) => p.favorite).length;
  // The filter lets go by itself once the last favourite is gone.
  const showFavorites = onlyFavorites && favorites > 0;
  const shown = showFavorites ? kept.filter((p) => p.favorite) : kept;
  const viewable = shown.filter((p): p is Photo & { url: string } => Boolean(p.url));
  const count = total - (photos.length - kept.length);

  async function toggleFavorite(photo: Photo) {
    const favorite = !photo.favorite;
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, favorite } : p)));
    await fetch(`/api/album/${photo.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ favorite }),
    });
  }

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleOpen() {
    const config = { ...(weddingSite?.config as Record<string, unknown> ?? {}), albumOpen: !albumOpen };
    void saveSite({ config });
  }

  // The link only works once the wedding site is published — that is what the
  // guest page looks up. Say so plainly rather than handing out a dead URL.
  if (!published || !domain) {
    return (
      <Panel>
        <p className="font-serif text-xl text-[#24413a]">{t('Udgiv jeres hjemmeside først')}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#5f6b66]">
          {t('Gæsterne uploader via jeres side-adresse, så albummet åbner i samme øjeblik hjemmesiden er udgivet.')}
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('website')}
            className="mt-5 inline-flex h-9 items-center rounded-full bg-[#12332b] px-4 text-xs font-semibold text-white cursor-pointer"
          >
            {t('Gå til Hjemmeside')}
          </button>
        )}
      </Panel>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-[28px] border border-[#dcdfdb] bg-[#ffffff] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-md text-sm text-[#5f6b66]">
          {t('Del linket med gæsterne, de kan lægge billeder op uden at oprette noget. Kun I kan se dem.')}
        </p>
        <p className="shrink-0 text-sm font-bold text-[#7d938a]">
          {t('{n} billeder', { n: count })}
        </p>
      </div>

      {/* Share link */}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[14px] border border-[#e6e9e5] bg-[#f8f9f8] px-4 py-3 font-mono text-[13px] text-[#24413a]">
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={copyLink}
          className="flex h-11 items-center gap-1.5 rounded-[14px] bg-[#12332b] px-4 text-xs font-semibold text-white cursor-pointer"
        >
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? t('Kopieret') : t('Kopiér link')}
        </button>
        <button
          type="button"
          onClick={toggleOpen}
          title={albumOpen ? t('Luk for nye billeder') : t('Åbn for nye billeder')}
          className="flex h-11 items-center gap-1.5 rounded-[14px] border border-[#d9ded9] bg-white px-4 text-xs font-semibold text-[#24413a] cursor-pointer"
        >
          {albumOpen ? <Unlock size={14} /> : <Lock size={14} />}
          {albumOpen ? t('Åbent') : t('Lukket')}
        </button>
      </div>

      {loading && photos.length === 0 && (
        <div className="flex items-center justify-center py-16 text-[#9a9686]">
          <Loader2 size={20} className="animate-spin" />
        </div>
      )}

      {favorites > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('Vis')}>
          {[
            { on: false, label: t('Alle'), n: count },
            { on: true, label: t('Favoritter'), n: favorites },
          ].map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setOnlyFavorites(f.on)}
              aria-pressed={showFavorites === f.on}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-colors cursor-pointer',
                showFavorites === f.on
                  ? 'bg-[#24413a] text-[#f8f9f8]'
                  : 'border border-[#e6e9e5] bg-[#f8f9f8] text-[#5f6b66] hover:text-[#24413a]',
              )}
            >
              {f.on && <Heart size={11} fill="currentColor" className={showFavorites ? '' : 'text-[#b34e37]'} />}
              {f.label}
              <span className={showFavorites === f.on ? 'text-[#dbe5e0]' : 'text-[#9a9686]'}>{f.n}</span>
            </button>
          ))}
        </div>
      )}

      {!loading && kept.length === 0 && (
        <div className="rounded-[18px] border border-[#e6e9e5] bg-[#f8f9f8] px-5 py-12 text-center">
          <ImageOff size={22} className="mx-auto text-[#9a9686]" />
          <p className="mt-3 font-serif text-lg text-[#24413a]">{t('Ingen billeder endnu')}</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-[#5f6b66]">
            {t('Send linket rundt i gruppechatten, så fyldes albummet af sig selv.')}
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((photo) => (
            <figure key={photo.id} className="group relative aspect-square overflow-hidden rounded-[18px] bg-[#eceeeb]">
              {photo.url ? (
                <button
                  type="button"
                  onClick={() => setViewing(viewable.findIndex((p) => p.id === photo.id))}
                  aria-label={photo.uploader_name ? t('Se billede fra {name}', { name: photo.uploader_name }) : t('Se billede')}
                  className="block h-full w-full cursor-zoom-in"
                >
                  <img src={photo.url} alt={photo.caption ?? ''} loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[#9a9686]">
                  <ImageOff size={18} />
                </div>
              )}

              {photo.uploader_name && (
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 pt-6 text-[11px] font-medium text-white">
                  {photo.uploader_name}
                </figcaption>
              )}

              {/* Shown on hover where there is one; always on a touch screen,
                  where there is no hover to reveal them. */}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                <button
                  type="button"
                  onClick={() => void toggleFavorite(photo)}
                  aria-label={t('Marker som favorit')}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full backdrop-blur transition-colors cursor-pointer',
                    photo.favorite ? 'bg-white text-[#b34e37]' : 'bg-black/35 text-white hover:bg-black/50',
                  )}
                >
                  <Heart size={14} fill={photo.favorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(photo.id)}
                  aria-label={t('Slet billede')}
                  className="flex size-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-[#b34e37] cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {photo.favorite && (
                <span className="pointer-events-none absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-white/90 text-[#b34e37] [@media(hover:hover)]:group-hover:opacity-0 [@media(hover:none)]:hidden">
                  <Heart size={12} fill="currentColor" />
                </span>
              )}
            </figure>
          ))}
        </div>
      )}

      {viewing != null && viewable.length > 0 && (
        <Lightbox
          photos={viewable.map((p) => p.url)}
          index={Math.min(Math.max(viewing, 0), viewable.length - 1)}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          alt={viewable[viewing]?.uploader_name ?? ''}
        />
      )}

      {hasMore && !showFavorites && (
        <button
          type="button"
          onClick={() => { const next = page + 1; setPage(next); setLoading(true); void load(next); }}
          disabled={loading}
          className="mx-auto flex h-9 items-center gap-1.5 rounded-full border border-[#d9ded9] bg-white px-4 text-xs font-semibold text-[#24413a] cursor-pointer disabled:opacity-50"
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {t('Hent flere')}
        </button>
      )}
    </motion.section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-dashed border-[#dcdfdb] bg-[#ffffff] px-7 py-14 text-center"
    >
      {children}
    </motion.section>
  );
}
