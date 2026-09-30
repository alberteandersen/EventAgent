import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link2, Check, Eye, EyeOff, Users, Images, Heart, ArrowUpRight } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { cn } from '../../ui';
import { useLang } from '../../i18n';

/** What the couple can put on the public recap. Lives in wedding_sites.config,
 *  so it needs no table of its own. */
type Recap = { headline: string; message: string };

function readRecap(config: Record<string, unknown> | undefined): Recap {
  const r = (config?.recap ?? {}) as Partial<Recap>;
  return {
    headline: typeof r.headline === 'string' ? r.headline : '',
    message: typeof r.message === 'string' ? r.message : '',
  };
}

export default function DelTab({ onNavigate }: { onNavigate?: (s: 'website') => void }) {
  const { t } = useLang();
  const { event, guests, venues, weddingSite, saveSite } = useWedding();

  const config = (weddingSite?.config as Record<string, unknown> | undefined) ?? {};
  const [recap, setRecap] = useState<Recap>(() => readRecap(config));
  const [copied, setCopied] = useState(false);
  const [albumCount, setAlbumCount] = useState<number | null>(null);

  const domain = typeof weddingSite?.domain === 'string' ? weddingSite.domain : null;
  const published = Boolean(weddingSite?.published);
  const live = config.recapPublished === true;
  const shareUrl = domain && typeof window !== 'undefined'
    ? `${window.location.origin}/w/${domain}/tak`
    : null;

  const attended = guests.filter((g) => g.rsvp === 'ja').length;
  const booked = venues.filter((v) => v.booked_at != null || v.id === event?.chosen_venue_id).length;

  useEffect(() => {
    if (!event?.id) return;
    void fetch(`/api/album?eventId=${event.id}&page=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setAlbumCount(j.total))
      .catch(() => { /* the count is decoration, not worth surfacing */ });
  }, [event?.id]);

  function save(next: Recap) {
    setRecap(next);
    void saveSite({ config: { ...config, recap: next } });
  }

  function togglePublished() {
    void saveSite({ config: { ...config, recapPublished: !live } });
  }

  function copyLink() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!published || !domain) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] border border-dashed border-line bg-white px-7 py-14 text-center"
      >
        <p className="font-serif text-xl text-ink">{t('Udgiv jeres hjemmeside først')}</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          {t('Opsamlingen deler adresse med jeres side, så den kan først åbne når siden er udgivet.')}
        </p>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate('website')}
            className="mt-5 inline-flex h-9 items-center rounded-full bg-ink-deep px-4 text-xs font-semibold text-white cursor-pointer"
          >
            {t('Gå til Hjemmeside')}
          </button>
        )}
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 rounded-[28px] border border-line bg-white p-5 sm:p-7"
    >
      <p className="max-w-md text-sm text-muted">
        {t('En lille side der opsummerer dagen, til dem der ikke kunne komme, og til jer selv om ti år.')}
      </p>

      {/* Real numbers only */}
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[18px] border border-line-soft bg-line-soft">
        <Stat icon={<Users size={14} />} label={t('Gæster')} value={String(attended)} />
        <Stat icon={<Images size={14} />} label={t('Billeder')} value={albumCount == null ? '-' : String(albumCount)} />
        <Stat icon={<Heart size={14} />} label={t('Leverandører')} value={String(booked)} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {t('Overskrift')}
        </span>
        <input
          value={recap.headline}
          onChange={(e) => setRecap({ ...recap, headline: e.target.value })}
          onBlur={() => save(recap)}
          maxLength={80}
          placeholder={t('Tak fordi I fejrede med os')}
          className="h-11 rounded-[14px] border border-line-soft bg-paper px-4 text-sm text-ink placeholder:text-faint focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          {t('Jeres hilsen')}
        </span>
        <textarea
          value={recap.message}
          onChange={(e) => setRecap({ ...recap, message: e.target.value })}
          onBlur={() => save(recap)}
          rows={5}
          maxLength={1200}
          placeholder={t('Skriv et par linjer om dagen, hvordan det var, og hvad I sidder tilbage med.')}
          className="resize-none rounded-[14px] border border-line-soft bg-paper px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-faint focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePublished}
          className={cn(
            'flex h-11 items-center gap-1.5 rounded-[14px] px-4 text-xs font-semibold transition-colors cursor-pointer',
            live ? 'bg-ink-deep text-white' : 'border border-line bg-white text-ink',
          )}
        >
          {live ? <Eye size={14} /> : <EyeOff size={14} />}
          {live ? t('Synlig for alle') : t('Kun jer')}
        </button>

        <code className="min-w-0 flex-1 truncate rounded-[14px] border border-line-soft bg-paper px-4 py-3 font-mono text-[13px] text-ink">
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={copyLink}
          disabled={!live}
          title={live ? undefined : t('Gør siden synlig først')}
          className="flex h-11 items-center gap-1.5 rounded-[14px] bg-ink-deep px-4 text-xs font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? t('Kopieret') : t('Kopiér link')}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-faint">
          {t('Opsamlingen viser jeres hilsen og tallene ovenfor. Gæsternes billeder forbliver private.')}
        </p>
        {live && shareUrl && (
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[0.78rem] font-semibold text-ink hover:underline"
          >
            {t('Se siden')} <ArrowUpRight size={13} aria-hidden />
          </a>
        )}
      </div>
    </motion.section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-paper px-4 py-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-sage">{icon}</div>
      <div className="mt-1 font-serif text-[1.5rem] text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">{label}</div>
    </div>
  );
}
