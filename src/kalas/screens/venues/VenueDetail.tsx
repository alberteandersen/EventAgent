"use client";

import { useState } from 'react';
import { Heart, Check, Star, Loader2, BookOpen, Send, Users, Wallet } from 'lucide-react';
import { Button, cn } from '../../ui';
import { useLang } from '../../i18n';
import { type DisplayVenue, imgSrc } from './shared';
import VenueModal, { type VenueFact } from './VenueModal';

/* A venue on the couple's list, in the same modal Udforsk opens. `venue` is
 * null while nothing is open.
 *
 * What a saved row adds is Juno's research: she reads the venue's own pages
 * and fills in capacity, prices and the practical details. It runs when they
 * press the button, not when the venue is opened — a look is not a request,
 * and the modal already has something to show without it. */
export function VenueDetail({
  venue, saved, sent, isBooked, onClose, onSave, onContact, onBook, onPhoto, onRefresh,
}: {
  venue: DisplayVenue | null; saved: boolean; sent: boolean; isBooked: boolean;
  onClose: () => void; onSave: () => void; onContact: () => void; onBook: () => void;
  onPhoto: (index: number) => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useLang();
  /* By venue id, and kept out here rather than in the modal's body: the
     research takes a while, and closing the modal must not lose track of it. */
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [researchError, setResearchError] = useState<{ id: string; message: string } | null>(null);

  async function runResearch(id: string) {
    setResearchingId(id);
    setResearchError(null);
    try {
      const res = await fetch(`/api/venues/${id}/research`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? 'Research failed');
      }
      await onRefresh();
    } catch (err) {
      setResearchError({ id, message: err instanceof Error ? err.message : t('Kunne ikke researche venue') });
    } finally {
      setResearchingId((cur) => (cur === id ? null : cur));
    }
  }

  const facts: VenueFact[] = [];
  if (venue) {
    if (venue.rating != null) {
      facts.push({
        icon: <Star size={12} fill="currentColor" className="text-amber" />,
        label: t('Bedømmelse'),
        value: `${venue.rating.toFixed(1)}${venue.reviewCount ? ` (${venue.reviewCount})` : ''}`,
      });
    }
    if (venue.capacity && venue.capacity !== '-') {
      facts.push({ icon: <Users size={12} />, label: t('Kapacitet'), value: venue.capacity });
    }
    if (venue.price && venue.price !== '-') {
      facts.push({ icon: <Wallet size={12} />, label: t('Pris'), value: venue.price });
    }
  }

  return (
    <VenueModal
      open={venue !== null}
      onClose={onClose}
      name={venue?.name ?? ''}
      address={venue?.location}
      photos={venue ? (venue.photos.length ? venue.photos : [imgSrc(venue.image)]) : []}
      onPhoto={onPhoto}
      facts={facts}
      note={venue?.quote}
      description={venue?.description}
      footer={venue && (
        <>
          <Button variant="secondary" onClick={onSave}>
            <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
            {saved ? t('Gemt') : t('Gem venue')}
          </Button>
          {isBooked ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sage-wash px-4 text-meta font-semibold text-ink">
              <Check size={14} /> {t('Jeres venue')}
            </span>
          ) : (
            <>
              <Button variant="secondary" onClick={onContact} disabled={sent} icon={sent ? Check : Send}>
                {sent ? t('Juno har kontaktet stedet') : t('Kontakt via Juno')}
              </Button>
              <Button onClick={onBook} icon={Check}>{t('Vælg som jeres venue')}</Button>
            </>
          )}
        </>
      )}
    >
      {venue && (
        <Research
          venue={venue}
          researching={researchingId === venue.id}
          error={researchError?.id === venue.id ? researchError.message : null}
          onResearch={() => void runResearch(venue.id)}
        />
      )}
    </VenueModal>
  );
}

function Research({ venue, researching, error, onResearch }: {
  venue: DisplayVenue; researching: boolean; error: string | null; onResearch: () => void;
}) {
  const { t } = useLang();
  const research = venue.research;

  const button = (
    <Button variant="secondary" size="sm" onClick={onResearch} disabled={researching}>
      {researching ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
      {researching ? t('Juno researcher…') : research ? t('Opdater research') : t('Research venue')}
    </Button>
  );

  return (
    <section className="mt-6 flex flex-col gap-6 border-t border-line-soft pt-5">
      {error && (
        <p className="rounded-[14px] border border-terracotta/20 bg-terracotta-wash px-4 py-3 text-sm text-terracotta">{error}</p>
      )}

      {!research ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-dashed border-line px-4 py-3.5">
          <p aria-live="polite" className="min-w-[14rem] flex-1 text-meta text-muted">
            {researching
              ? t('Juno researcher venueet, søger på nettet og udfylder kapacitet, priser og praktisk info fra stedets egne sider…')
              : t('Juno kan researche stedet og udfylde kapacitet, priser og praktisk info fra stedets egne sider.')}
          </p>
          {button}
        </div>
      ) : (
        <>
          <div className="rounded-[18px] bg-ink p-5 text-paper">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-paper/75">{t('Junos briefing')}</p>
              {button}
            </div>
            {research.briefing.length > 0 && (
              <ul className="mt-3 space-y-2.5">
                {research.briefing.map((line) => (
                  <li key={line} className="flex items-start gap-3 text-[0.9rem] leading-snug">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sage-tint" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            )}
            {research.directions && (
              <p className="mt-3 text-[0.8rem] text-paper/75">{research.directions}</p>
            )}
          </div>

          {research.practical.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Praktisk info')}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                {research.practical.map(({ key, value }) => (
                  <div key={key}>
                    <dt className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-muted">{key}</dt>
                    <dd className="mt-1.5 text-[0.9rem] leading-snug text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {research.highlights.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Faciliteter & fordele')}</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {research.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-3">
                    <Check size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-sage-strong" />
                    <span className="text-[0.9rem] leading-snug text-ink-soft">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {research.packages.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink">{t('Priser & pakker')}</p>
              <p className="mt-1.5 text-[0.8rem] text-muted">{t('Fra venueets egne sider, bekræft altid pris og dato direkte.')}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {research.packages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className={cn(
                      'flex flex-col rounded-[18px] p-5',
                      pkg.featured ? 'bg-ink text-paper' : 'border border-line bg-white',
                    )}
                  >
                    {pkg.featured && (
                      <span className="mb-2 text-[0.58rem] font-bold uppercase tracking-[0.22em] text-sage-tint">{t('Mest valgt')}</span>
                    )}
                    <span className={cn('font-serif text-[1.15rem]', pkg.featured ? 'text-paper' : 'text-ink')}>
                      {pkg.name}
                    </span>
                    <span className={cn('mt-1 text-[0.76rem] leading-relaxed', pkg.featured ? 'text-paper/75' : 'text-muted')}>
                      {pkg.desc}
                    </span>
                    <span className={cn('mt-4 font-serif text-[1.5rem] leading-none', pkg.featured ? 'text-paper' : 'text-ink')}>
                      {pkg.price}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
