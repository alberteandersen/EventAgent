"use client";

import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, MessageCircle, ArrowLeft, MapPin, Globe as GlobeIcon, Plus, Send, ArrowRight } from 'lucide-react';
import type { Couple } from '../../useWedding';
import { Button, Eyebrow, cn } from '../../ui';
import { useLang } from '../../i18n';
import { ComparisonView } from './ComparisonView';
import { VenueDetail } from './VenueDetail';
import { type DisplayVenue, RatingBadge, StageChip, type VenueStage, imgSrc, venueAreaLabel } from './shared';

/* ═══════════════════════════════════════════════════════════════════════
   PICKS VIEW, venue management
═══════════════════════════════════════════════════════════════════════ */
export function PicksView({
  venues, couple, saved, sent, booked, stageOf, initialSelectedId, onToggleSave, onOutreach, onBook, onDiscover, onBack, onReview, onAva, onRefresh, embedded = false, categoryBar,
}: {
  venues: DisplayVenue[];
  couple: Couple;
  saved: Set<string>; sent: Set<string>; booked: string | null;
  stageOf: (id: string) => VenueStage;
  initialSelectedId?: string | null;
  onToggleSave: (id: string) => void; onOutreach: (id: string) => void;
  onBook: (id: string) => void; onDiscover: () => void; onAva: () => void;
  onBack?: () => void;
  onReview: () => void;
  onRefresh: () => Promise<void>;
  embedded?: boolean;
  categoryBar?: ReactNode;
}) {
  const { t } = useLang();
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [comparing, setComparing] = useState(false);
  const venueCity = venueAreaLabel(couple.region);
  const savedVenues = venues.filter(v => saved.has(v.id));
  const selectedVenue = selectedId ? venues.find((v) => v.id === selectedId) ?? null : null;
  const padX = embedded ? 'px-0' : 'px-6 sm:px-9 lg:px-12';

  // Booked first, then saved, then the rest.
  const sortedVenues = [...venues].sort((a, b) => {
    const rank = (v: DisplayVenue) => (v.id === booked ? 0 : saved.has(v.id) ? 1 : 2);
    return rank(a) - rank(b);
  });

  if (comparing && savedVenues.length >= 2) {
    return (
      <ComparisonView
        venues={savedVenues}
        saved={saved}
        booked={booked}
        onBack={() => setComparing(false)}
        onToggleSave={onToggleSave}
        onBook={onBook}
      />
    );
  }

  if (selectedVenue) {
    return (
      <AnimatePresence mode="wait">
        <VenueDetail
          key={selectedVenue.id}
          venue={selectedVenue}
          allVenues={venues}
          saved={saved.has(selectedVenue.id)}
          sent={sent.has(selectedVenue.id)}
          isBooked={booked === selectedVenue.id}
          onBack={() => setSelectedId(null)}
          onSave={() => onToggleSave(selectedVenue.id)}
          onContact={() => { onOutreach(selectedVenue.id); setSelectedId(null); }}
          onBook={() => onBook(selectedVenue.id)}
          onSelectOther={(id) => setSelectedId(id)}
          onRefresh={onRefresh}
        />
      </AnimatePresence>
    );
  }

  // Nothing found yet — point to discovery.
  if (venues.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink">
          <MapPin size={22} className="text-white" />
        </div>
        <h2 className="display mt-5 text-[1.8rem] text-ink">{t('Ingen venues på listen endnu')}</h2>
        <p className="mt-2 max-w-sm text-[0.9rem] text-ink-soft">
          {venueCity
            ? t('Udforsk verdenskortet eller fortæl Ava mere om jeres drøm nær {area}, så researcher hun rigtige venues.', { area: venueCity })
            : t('Udforsk verdenskortet eller fortæl Ava mere om jeres drøm, så researcher hun rigtige venues.')}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button icon={GlobeIcon} onClick={onDiscover}>{t('Udforsk venues')}</Button>
          <Button variant="secondary" icon={MessageCircle} onClick={onAva}>{t('Tal med Ava')}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className="pb-24">

      {/* ── Back button ──────────────────────────────────────────────── */}
      {onBack && (
      <div className={cn(padX, 'pt-8')}>
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-muted hover:text-ink transition-colors cursor-pointer">
          <ArrowLeft size={13} /> {t('Venues')}
        </button>
      </div>
      )}

      {/* ── List tools ──────────────────────────────────────────────── */}
      {savedVenues.length >= 2 && (
        <div className={cn(padX, 'pt-8 flex justify-end')}>
          <button onClick={() => setComparing(true)}
            className="rounded-full bg-ink px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-canvas hover:opacity-85 transition-opacity cursor-pointer">
            {t('Sammenlign ({n})', { n: savedVenues.length })}
          </button>
        </div>
      )}

      {/* ── Category filter (hub shortlist) ──────────────────────────── */}
      {categoryBar && <div className={cn(padX, 'pt-6')}>{categoryBar}</div>}

      {/* ── Outreach progress → review page ──────────────────────────── */}
      {savedVenues.length > 0 && (
        <div className={cn(padX, 'pt-8')}>
          <OutreachBanner
            notContacted={savedVenues.filter((v) => !sent.has(v.id)).length}
            contacted={savedVenues.filter((v) => sent.has(v.id)).length}
            onReview={onReview}
          />
        </div>
      )}

      {/* ── Venue grid ───────────────────────────────────────────────── */}
      <div className={cn(padX, 'pt-8')}>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sortedVenues.map((venue, i) => (
            <VenueGridCard key={venue.id} venue={venue} index={i}
              saved={saved.has(venue.id)} sent={sent.has(venue.id)} isBooked={booked === venue.id}
              stage={stageOf(venue.id)}
              onToggleSave={() => onToggleSave(venue.id)}
              onChoose={() => onBook(venue.id)}
              onContact={() => onOutreach(venue.id)}
              onSelect={() => setSelectedId(venue.id)} />
          ))}

          {/* Discover-more card */}
          <button
            type="button"
            onClick={onDiscover}
            className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-[var(--color-line-strong)] p-6 text-center transition-colors hover:border-ink/40 hover:bg-card cursor-pointer"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink">
              <GlobeIcon size={18} className="text-white" />
            </div>
            <div>
              <p className="font-serif text-[1.15rem] text-ink">{t('Udforsk flere venues')}</p>
              <p className="mt-1 text-[0.8rem] text-muted">
                {t('Vælg land og by på kloden, Ava researcher rigtige venues.')}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Ask Ava ──────────────────────────────────────────────────── */}
      <div className={cn(padX, 'pt-12')}>
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rule rounded-2xl bg-card p-8 text-center">
          <Eyebrow className="text-center">{t('Spørg Ava')}</Eyebrow>
          <p className="mt-3 text-[0.95rem] text-ink-soft max-w-md mx-auto">
            {t('Ava kender jeres profil og kan sammenligne venues, tjekke datoer og skrive henvendelser for jer.')}
          </p>
          <div className="mt-6 flex justify-center">
            <Button variant="secondary" icon={MessageCircle} onClick={onAva}>{t('Tal med Ava')}</Button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Outreach banner — progress + entry to the review page ────────────── */
function OutreachBanner({
  notContacted, contacted, onReview,
}: {
  notContacted: number; contacted: number; onReview: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink px-6 py-5 text-canvas">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/12">
          <Send size={17} />
        </div>
        <div>
          <p className="font-serif text-[1.1rem] leading-snug">
            {notContacted > 0
              ? t('{n} på listen mangler kontakt', { n: notContacted })
              : t('Ava har kontaktet hele listen')}
          </p>
          <p className="mt-0.5 text-[0.78rem] text-canvas/70">
            {contacted > 0 ? t('{n} kontaktet · ', { n: contacted }) : ''}
            {notContacted > 0 ? t('Se hvad Ava vil sende, og godkend.') : t('Følg svarene under Henvendelser.')}
          </p>
        </div>
      </div>
      {notContacted > 0 && (
        <button
          onClick={onReview}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] text-paper hover:opacity-90 transition-opacity cursor-pointer"
        >
          {t('Lad Ava kontakte ({n})', { n: notContacted })} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

/* ── Venue management grid card ───────────────────────────────────────── */
function VenueGridCard({
  venue, index, saved, sent, isBooked, stage, onToggleSave, onChoose, onContact, onSelect,
}: {
  venue: DisplayVenue; index: number; saved: boolean; sent: boolean; isBooked: boolean;
  stage: VenueStage;
  onToggleSave: () => void; onChoose: () => void; onContact: () => void; onSelect: () => void;
}) {
  const { t } = useLang();
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="group flex flex-col overflow-hidden rounded-[18px] border border-line bg-white">

      <button type="button" onClick={onSelect} className="relative block aspect-[4/3] overflow-hidden cursor-pointer text-left">
        <img src={imgSrc(venue.image)} alt={venue.name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-deep/45 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <RatingBadge rating={venue.rating} count={venue.reviewCount} />
          {isBooked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-canvas">
              <Check size={10} /> {t('Valgt')}
            </span>
          )}
        </div>
        {!isBooked && stage !== 'idle' && (
          <div className="absolute bottom-3 left-3">
            <StageChip stage={stage} className="shadow-sm" />
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-serif text-[1.15rem] leading-tight text-ink">{venue.name}</h3>
            {venue.location && <p className="mt-0.5 truncate text-[0.72rem] text-muted">{venue.location}</p>}
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onToggleSave} aria-label={saved ? t('Fjern fra listen') : t('Tilføj til liste')}
            className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-soft transition-all cursor-pointer',
              saved ? 'bg-sage-wash text-ink' : 'text-muted hover:text-ink hover:bg-paper')}>
            {saved ? <Check size={14} /> : <Plus size={14} />}
          </motion.button>
        </div>

        {venue.quote && (
          <p className="mt-2 line-clamp-2 text-[0.78rem] leading-snug text-muted">{venue.quote}</p>
        )}

        <div className="mt-auto flex items-end gap-5 pt-4">
          <div>
            <p className="eyebrow !text-sage">{t('Pris')}</p>
            <p className="mt-0.5 font-serif text-[0.95rem] leading-none text-ink">{venue.price}</p>
          </div>
          <div>
            <p className="eyebrow !text-sage">{t('Kapacitet')}</p>
            <p className="mt-0.5 font-serif text-[0.95rem] leading-none text-ink">{venue.capacity}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={onSelect}
            className="flex h-8 flex-1 items-center justify-center rounded-full border border-line-soft px-3 text-xs font-semibold text-ink hover:bg-paper transition-colors cursor-pointer">
            {t('Se venue')}
          </button>
          {isBooked ? (
            <span className="flex h-8 items-center gap-1.5 rounded-full bg-sage-wash px-3 text-xs font-semibold text-ink">
              <Check size={12} /> {t('Jeres venue')}
            </span>
          ) : (
            <button onClick={onChoose}
              className="flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper hover:opacity-85 transition-opacity cursor-pointer">
              <Check size={12} /> {t('Vælg')}
            </button>
          )}
        </div>

        {sent ? (
          !isBooked && (
            <p className="mt-2.5 flex items-center gap-1.5 text-[0.7rem] text-muted">
              <Check size={10} className="text-sage" /> {t('Ava har kontaktet venuet')}
            </p>
          )
        ) : (
          <button onClick={onContact}
            className="mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-full border border-line-soft bg-white px-3 text-xs font-semibold text-ink hover:bg-paper transition-colors cursor-pointer">
            <Send size={12} /> {t('Kontakt via Ava')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
