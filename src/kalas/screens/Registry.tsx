"use client";

/* Ønskeliste — the couple's gift registry. Paste a product URL and we fetch its
   title/image/price/store via Jina Reader, or add a wish by hand for the ones
   with no web shop behind them. Guests reserve gifts from the public site
   (registry_claims); reservations show here live. The tile itself is GiftCard,
   shared with both public-site renderers so the two surfaces match. */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Plus, Trash2, Link2, Check, Pencil, ExternalLink, Heart, Share2 } from 'lucide-react';
import { useWedding } from '../useWedding';
import { useLang } from '../i18n';
import { Pill, cn } from '../ui';
import GiftCard from '../registry/GiftCard';
import HeroPhoto from './home/HeroPhoto';
import { sortGifts, PRICE_BANDS, inBand } from '../registry/gifts';
import type { RegistryItemRow } from '@/lib/db/types';

/** An item being written: a fresh wish has no id, an edit carries one. */
type Draft = Partial<RegistryItemRow> & { id?: string };

const EMPTY: Draft = { title: '', currency: 'DKK', quantity: 1, favourite: false };

const FALLBACK_PHOTO = '/landing/hero.jpg';

export default function Registry({ onNavigate }: { onNavigate?: (s: import('../Shell').ScreenId) => void }) {
  const { t, tn } = useLang();
  const {
    couple, weddingSite,
    registryItems, addRegistryItem, updateRegistryItem, deleteRegistryItem,
  } = useWedding();
  const [url, setUrl] = useState('');
  const [looking, setLooking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [band, setBand] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  const allItems = sortGifts(registryItems);
  const items = allItems.filter((it) => inBand(it.price_cents, band));

  const coupleLabel = couple.b && couple.a ? `${couple.a} & ${couple.b}` : couple.a || t('Vores ønskeliste');

  const publicUrl = weddingSite?.domain
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/w/${weddingSite.domain}`
    : null;
  const share = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the link is on screen anyway */ }
  };

  const lookup = async () => {
    const clean = url.trim();
    if (!clean) return;
    setLooking(true);
    try {
      const res = await fetch('/api/registry/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: clean }),
      });
      const info = res.ok ? await res.json() : {};
      setDraft({
        ...EMPTY,
        title: info.title ?? '',
        image_url: info.image ?? null,
        product_url: clean,
        store_name: info.storeName ?? null,
        price_cents: info.priceCents ?? null,
        currency: info.currency ?? 'DKK',
      });
      setUrl('');
    } finally { setLooking(false); }
  };

  const save = async () => {
    if (!draft?.title?.trim()) return;
    const patch = {
      title: draft.title.trim(),
      description: draft.description?.trim() || null,
      image_url: draft.image_url?.trim() || null,
      product_url: draft.product_url?.trim() || null,
      store_name: draft.store_name?.trim() || null,
      price_cents: draft.price_cents ?? null,
      currency: draft.currency ?? 'DKK',
      quantity: draft.quantity && draft.quantity > 0 ? draft.quantity : 1,
      favourite: Boolean(draft.favourite),
    };
    if (draft.id) await updateRegistryItem(draft.id, patch);
    else await addRegistryItem({ ...patch, sort: registryItems.length });
    setDraft(null);
  };

  /** Starring from the tile writes straight through — no need to open the editor
   *  to change one's mind about a favourite. */
  const toggleFavourite = (it: RegistryItemRow) =>
    void updateRegistryItem(it.id, { favourite: !it.favourite });


  return (
    <div className="px-6 py-8 sm:px-9 lg:px-12 lg:py-8">
      {/* The couple's own list, with their faces on it — this is the page a
          guest opens, and "Ønskeliste" over a grid of products said nothing
          about whose wedding it was. */}
      <div className="flex flex-col gap-6 rounded-[28px] border border-line bg-card p-6 sm:flex-row sm:items-start sm:p-7">
        <HeroPhoto
          fallback={FALLBACK_PHOTO}
          alt={coupleLabel}
          className="sm:w-[200px]"
          frameClassName="h-[180px] sm:h-[200px]"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="eyebrow">{t('Ønskeliste')}</p>
          <h1 className="font-serif text-[clamp(1.8rem,3.5vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            {coupleLabel}
          </h1>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.82rem] text-muted">
              {tn(allItems.length, 'Ét ønske på listen', '{n} ønsker på listen')}
            </span>
            {publicUrl ? (
              <button
                type="button"
                onClick={share}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[0.78rem] font-semibold text-ink transition-colors hover:border-ink"
              >
                {copied ? <Check size={13} /> : <Share2 size={13} />}
                {copied ? t('Link kopieret') : t('Del listen')}
              </button>
            ) : (
              <span className="text-[0.78rem] text-muted">
                {t('Udgiv jeres bryllupsside, så kan I dele listen.')}
              </span>
            )}
          </div>

          {allItems.length > 0 && (
            <p className="text-[0.78rem] text-muted">
              {t('Gæsterne kan se, hvad der er reserveret, så to ikke køber det samme. I kan ikke — det er hele overraskelsen.')}
            </p>
          )}
        </div>
      </div>

      {/* Add */}
      <div className="mt-8 flex flex-wrap items-center gap-2 rounded-2xl rule bg-card p-2">
        <div className="flex flex-1 items-center gap-2 px-3">
          <Link2 size={16} className="shrink-0 text-muted" />
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void lookup(); }}
            placeholder={t('Indsæt produktlink (fx fra en webshop)…')}
            className="flex-1 bg-transparent py-2.5 text-[0.92rem] text-ink placeholder:text-muted focus:outline-none" />
        </div>
        <button onClick={() => setDraft({ ...EMPTY })}
          className="rounded-full px-3 py-2.5 text-[0.78rem] text-muted hover:text-ink transition-colors cursor-pointer">
          {t('Tilføj uden link')}
        </button>
        <button onClick={lookup} disabled={looking || !url.trim()}
          className="flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[0.8rem] font-medium text-canvas hover:bg-ink/90 transition-colors cursor-pointer disabled:opacity-50">
          {looking ? t('Henter…') : <><Plus size={14} /> {t('Tilføj')}</>}
        </button>
      </div>

      {/* Editor, one panel for a new wish and for editing a saved one */}
      <AnimatePresence>
        {draft && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="mt-3 rounded-2xl rule bg-card p-4">
              <p className="mb-3 text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted">
                {draft.id ? t('Rediger ønske') : t('Nyt ønske')}
              </p>
              <div className="flex flex-wrap gap-4 sm:flex-nowrap">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-shell">
                  {draft.image_url
                    ? <img src={draft.image_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center bg-sage-tint"><Gift size={22} className="text-ink/30" /></div>}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    placeholder={t('Gavens navn')} autoFocus
                    className="w-full rounded-lg rule bg-canvas px-3 py-2 font-serif text-[1rem] text-ink focus:border-ink focus:outline-none" />
                  <div className="flex flex-wrap gap-2">
                    <input value={draft.price_cents != null ? String(draft.price_cents / 100) : ''}
                      onChange={(e) => { const n = Number(e.target.value.replace(/[^\d.]/g, '')); setDraft({ ...draft, price_cents: Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null }); }}
                      placeholder={t('Pris')} inputMode="decimal"
                      className="w-24 rounded-lg rule bg-canvas px-3 py-1.5 text-[0.85rem] text-ink focus:border-ink focus:outline-none" />
                    <input value={draft.store_name ?? ''} onChange={(e) => setDraft({ ...draft, store_name: e.target.value })}
                      placeholder={t('Butik')}
                      className="min-w-[120px] flex-1 rounded-lg rule bg-canvas px-3 py-1.5 text-[0.85rem] text-ink focus:border-ink focus:outline-none" />
                    <input value={draft.quantity ?? 1} type="number" min={1}
                      onChange={(e) => setDraft({ ...draft, quantity: Math.max(1, Number(e.target.value) || 1) })}
                      aria-label={t('Antal')} title={t('Antal')}
                      className="w-20 rounded-lg rule bg-canvas px-3 py-1.5 text-[0.85rem] text-ink focus:border-ink focus:outline-none" />
                  </div>
                  <input value={draft.image_url ?? ''} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })}
                    placeholder={t('Billedlink')}
                    className="w-full rounded-lg rule bg-canvas px-3 py-1.5 text-[0.8rem] text-muted focus:border-ink focus:text-ink focus:outline-none" />
                  <textarea value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder={t('En note til gæsterne, farve, størrelse, hvor I helst vil have den fra')} rows={2}
                    className="w-full resize-none rounded-lg rule bg-canvas px-3 py-2 text-[0.82rem] text-ink placeholder:text-muted focus:border-ink focus:outline-none" />

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={() => setDraft({ ...draft, favourite: !draft.favourite })}
                      aria-pressed={Boolean(draft.favourite)}
                      className={cn('flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.78rem] transition-colors cursor-pointer',
                        draft.favourite ? 'bg-[var(--color-terracotta-tint)] text-[var(--color-terracotta)]' : 'rule text-muted hover:text-ink')}>
                      <Heart size={13} className={draft.favourite ? 'fill-current' : ''} /> {t('Ønskes mest')}
                    </button>
                    <button onClick={save} disabled={!draft.title?.trim()}
                      className="flex items-center gap-1.5 rounded-full bg-sage px-4 py-2 text-[0.78rem] font-medium text-ink hover:bg-sage-strong transition-colors cursor-pointer disabled:opacity-50">
                      <Check size={14} /> {draft.id ? t('Gem ændringer') : t('Gem på listen')}
                    </button>
                    <button onClick={() => setDraft(null)} className="rounded-full px-3 py-2 text-[0.78rem] text-muted hover:text-ink cursor-pointer">{t('Annuller')}</button>
                    {!draft.title?.trim() && (
                      <span className="text-[0.74rem] text-muted">{t('Giv ønsket et navn, så kan I gemme det.')}</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The grid */}
      {items.length === 0 && !draft ? (
        <div className="mt-14 flex flex-col items-center justify-center rounded-2xl rule bg-card py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage-tint"><Gift size={22} className="text-ink" /></div>
          <p className="mt-4 font-serif text-[1.2rem] text-ink">{t('Ingen ønsker endnu')}</p>
          <p className="mt-1 max-w-sm text-[0.88rem] text-muted">{t('Indsæt jeres første gavelink ovenfor.')}</p>
        </div>
      ) : (
        <>
        {/* Prisklasser: a guest arrives with an amount in mind, not a product.
            Hidden until there is enough on the list for filtering to mean
            anything. */}
        {allItems.length >= 4 && (
          <div className="mt-8 flex flex-wrap gap-1.5">
            {PRICE_BANDS.map((b) => {
              const count = allItems.filter((it) => inBand(it.price_cents, b.id)).length;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBand(b.id)}
                  disabled={count === 0}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-colors cursor-pointer',
                    band === b.id
                      ? 'border-ink bg-ink text-canvas'
                      : 'border-line text-ink-soft hover:border-ink hover:text-ink',
                    count === 0 && 'cursor-not-allowed opacity-40',
                  )}
                >
                  {t(b.label)} <span className="opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((it) => {
            /* Deliberately not computed. Whether a gift is taken, and by whom,
               is the guests' business — the couple's own screen never shows it,
               because knowing is exactly the surprise the list protects. The
               public site (SiteRenderer) is where reservations live. */
            return (
              <div key={it.id} className="flex flex-col gap-1.5">
                <GiftCard
                  item={it}
                  reserved={false}
                  reservedBy={null}
                  actions={
                    <>
                      <TileButton label={t('Rediger')} onClick={() => setDraft({ ...it })}><Pencil size={15} /></TileButton>
                      <TileButton label={t('Ønskes mest')} onClick={() => toggleFavourite(it)}>
                        <Heart size={15} className={it.favourite ? 'fill-[var(--color-terracotta)] text-[var(--color-terracotta)]' : ''} />
                      </TileButton>
                      {it.product_url && (
                        <TileButton label={t('Åbn produkt')} href={it.product_url}><ExternalLink size={15} /></TileButton>
                      )}
                      <TileButton label={t('Fjern ønske')} tone="danger" onClick={() => setConfirmDelete(it.id)}>
                        <Trash2 size={15} />
                      </TileButton>
                    </>
                  }
                />

                {/* Confirming inline rather than in a dialog: deleting used to
                    happen on a single click, with no way back. */}
                {confirmDelete === it.id && (
                  <div className="rounded-xl border border-[#e2b9ab] bg-[#faf4ef] px-3 py-2.5">
                    <p className="text-[0.78rem] text-ink">{t('Slet “{title}”?', { title: it.title })}</p>
                    <div className="mt-1.5 flex gap-2">
                      <button onClick={() => { setConfirmDelete(null); void deleteRegistryItem(it.id); }}
                        className="rounded-full bg-[var(--color-terracotta)] px-3 py-1 text-[0.72rem] font-medium text-white cursor-pointer">
                        {t('Ja, slet')}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        className="rounded-full px-2 py-1 text-[0.72rem] text-muted hover:text-ink cursor-pointer">
                        {t('Behold')}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
        {items.length === 0 && allItems.length > 0 && (
          <p className="mt-8 text-center text-[0.85rem] text-ink-soft">
            {t('Ingen ønsker i denne prisklasse.')}
          </p>
        )}
        </>
      )}

      {items.length > 0 && (
        <div className="mt-8 flex items-center gap-3 rule-t pt-6">
          <p className="text-[0.85rem] text-muted">{t('Ønskelisten vises automatisk på jeres bryllupsside under “Gaveønsker”.')}</p>
          {onNavigate && <Pill variant="ghost" arrow onClick={() => onNavigate('website')}>{t('Åbn hjemmeside')}</Pill>}
        </div>
      )}
    </div>
  );
}

/** Round control on the tile's hover overlay. Renders as a link when it has an
 *  href so "open product" keeps middle-click and copy-link. */
function TileButton({ label, onClick, href, tone, children }: {
  label: string;
  onClick?: () => void;
  href?: string;
  tone?: 'danger';
  children: React.ReactNode;
}) {
  const className = cn(
    'flex h-8 w-8 items-center justify-center rounded-full bg-card transition-colors cursor-pointer',
    tone === 'danger' ? 'text-[var(--color-terracotta)] hover:bg-[#faf4ef]' : 'text-ink hover:bg-shell',
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
      {children}
    </button>
  );
}
