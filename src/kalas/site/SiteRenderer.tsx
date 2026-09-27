"use client";

/* The real, full-size public wedding site — token-driven. Rendered at
   /w/[slug] (and scaled down as the builder preview) from two inputs:
   SiteConfig (the couple's content) and SiteDesign (Ava's generated design:
   validated palette/typography/layout tokens, see design.ts). Every visual
   decision reads from the design; every interactive piece (RSVP, registry
   claims, countdown) is a coded component with injected handlers. All
   design-authored strings render as React text only. */

import { useState } from 'react';
import { IMAGES } from '../images';
import { useLang } from '../i18n';
import GiftCard from '../registry/GiftCard';
import { sortGifts, PRICE_BANDS, inBand } from '../registry/gifts';
import type { SiteConfig } from './config';
import { mergeSections, type SiteDesign, type DesignSection } from './design';
import { fontStack } from './fonts';
import type { RegistryItemRow } from '@/lib/db/types';

export type PublicCouple = { a: string; b: string; dateLabel: string; dateISO: string | null };

function daysUntil(dateISO: string | null): number {
  if (!dateISO) return 0;
  const d = new Date(`${dateISO}T00:00:00`).getTime();
  if (Number.isNaN(d)) return 0;
  return Math.ceil((d - Date.now()) / 86400000);
}

/* ── Token maps ────────────────────────────────────────────────────────── */

const RADIUS: Record<string, string> = { none: '0px', soft: '0.75rem', round: '1.5rem' };
const MAXW: Record<string, string> = { narrow: '42rem', normal: '50rem', wide: '64rem' };
const SECTION_PAD: Record<string, string> = { airy: '7rem', comfortable: '5rem', compact: '3.25rem' };
const HERO_SIZE: Record<string, string> = {
  normal: 'clamp(2.6rem, 9vw, 6rem)',
  large: 'clamp(3rem, 11vw, 7.5rem)',
  dramatic: 'clamp(3.4rem, 13vw, 9rem)',
};
const TRACK: Record<string, string> = { tight: '-0.02em', normal: '0em', wide: '0.06em' };

/* ── Renderer ──────────────────────────────────────────────────────────── */

export function SiteRenderer({
  couple, config, design, photoUrls = {}, registryItems = [], claimedByItem = {}, onRsvp, onClaim,
  icsUrl, extra,
}: {
  couple: PublicCouple;
  config: SiteConfig;
  design: SiteDesign;
  /** Calendar file for the day. Absent when the date is not firm yet. */
  icsUrl?: string | null;
  /** Rendered after the sections, before the footer: the public guest hub. */
  extra?: React.ReactNode;
  /** site_photos id → display URL (signed). Stock IMAGES keys resolve too. */
  photoUrls?: Record<string, string>;
  registryItems?: RegistryItemRow[];
  claimedByItem?: Record<string, number>;
  onRsvp?: () => void;
  onClaim?: (item: RegistryItemRow) => void;
}) {
  const { t } = useLang();
  const { palette, typography, shape, decor } = design;
  const days = daysUntil(couple.dateISO);
  const names = `${couple.a}${couple.b ? ` & ${couple.b}` : ''}`;

  const resolveImg = (ref: string): string | null =>
    photoUrls[ref] ?? IMAGES[ref as keyof typeof IMAGES] ?? null;

  const heroImg = resolveImg(design.images.heroPhotoId) ?? IMAGES.orangeri;
  const galleryImgs = (design.images.galleryPhotoIds.length > 0
    ? design.images.galleryPhotoIds
    : (config.galleryKeys as string[])
  ).map(resolveImg).filter((u): u is string => u !== null);

  const display: React.CSSProperties = {
    fontFamily: fontStack(typography.displayFont),
    fontWeight: typography.displayWeight,
    fontStyle: typography.displayItalic ? 'italic' : 'normal',
    letterSpacing: TRACK[typography.tracking],
    lineHeight: 1.08,
  };

  const enabled = new Set<string>(config.sections.filter((s) => s.enabled).map((s) => s.id));
  const sections = mergeSections(design, enabled);
  const on = (id: string) => sections.some((s) => s.id === id);

  const hairline = shape.borders === 'none'
    ? 'none'
    : shape.borders === 'bold'
      ? `2px solid ${palette.text}`
      : `1px solid ${palette.text}22`;

  const btn = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: palette.accent,
    color: palette.onAccent,
    borderRadius: shape.radius === 'none' ? '0px' : '999px',
    ...extra,
  });

  const eyebrow = (label: string, tone?: { accent: string }) => (
    <p
      className="mb-4 text-[0.7rem] font-semibold"
      style={{
        color: (tone ?? palette).accent,
        letterSpacing: typography.uppercaseEyebrows ? '0.28em' : '0.08em',
        textTransform: typography.uppercaseEyebrows ? 'uppercase' : 'none',
      }}
    >
      {label}
    </p>
  );

  /** Per-section palette after bg treatment. */
  const toneFor = (bg: DesignSection['bg']) => {
    switch (bg) {
      case 'surface': return { bg: palette.surface, text: palette.text, muted: palette.muted, accent: palette.accent, onAccent: palette.onAccent };
      case 'wash':    return { bg: `${palette.accent}14`, text: palette.text, muted: palette.muted, accent: palette.accent, onAccent: palette.onAccent };
      case 'inverse': return { bg: palette.text, text: palette.bg, muted: `${palette.bg}b3`, accent: palette.accent, onAccent: palette.onAccent };
      default:        return { bg: 'transparent', text: palette.text, muted: palette.muted, accent: palette.accent, onAccent: palette.onAccent };
    }
  };

  const sectionTitle: Record<string, string> = {
    story: t('Vores historie'), program: t('Program for dagen'), gallery: t('Galleri'),
    gifts: t('Gaveønsker'), transport: t('Transport'), dresscode: t('Dresscode'),
    hotel: t('Overnatning'), faq: t('FAQ'), rsvp: t('RSVP'),
  };

  const renderSection = (s: DesignSection) => {
    const tone = toneFor(s.bg);
    const title = s.heading || sectionTitle[s.id] || s.id;
    let body: React.ReactNode = null;

    switch (s.id) {
      case 'story':
        if (!config.storyText && !design.copy.storyIntro) return null;
        body = <StorySection s={s} config={config} design={design} tone={tone} display={display} resolveImg={resolveImg} />;
        break;
      case 'program':
        if (config.program.length === 0) return null;
        body = (
          <>
            <ProgramSection s={s} config={config} tone={tone} display={display} hairline={hairline} />
            {/* The thing a guest actually wants to do with a date and an
                address, right where both are on screen. */}
            {icsUrl && (
              <div className="mt-10 text-center">
                <a
                  href={icsUrl}
                  className="inline-flex items-center gap-2 px-6 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-85"
                  style={{ border: `1px solid ${hairline}`, color: tone.text }}
                >
                  {t('Sæt i kalenderen')}
                </a>
              </div>
            )}
          </>
        );
        break;
      case 'gallery':
        if (galleryImgs.length === 0) return null;
        body = <GallerySection s={s} images={galleryImgs} radius={RADIUS[shape.radius]} />;
        break;
      case 'gifts':
        if (!config.giftsText && registryItems.length === 0 && !config.giftsUrl) return null;
        body = (
          <GiftsSection
            s={s} config={config} tone={tone} display={display} btn={btn}
            registryItems={registryItems} claimedByItem={claimedByItem} onClaim={onClaim} t={t}
          />
        );
        break;
      case 'transport':
        if (!config.transport) return null;
        body = <PlainText text={config.transport} framed={s.variant === 'framed'} hairline={hairline} radius={RADIUS[shape.radius]} />;
        break;
      case 'dresscode':
        if (!config.dresscode) return null;
        body = <PlainText text={config.dresscode} framed={s.variant === 'framed'} hairline={hairline} radius={RADIUS[shape.radius]} />;
        break;
      case 'hotel':
        if (config.hotels.length === 0) return null;
        body = <HotelSection s={s} config={config} tone={tone} display={display} hairline={hairline} radius={RADIUS[shape.radius]} />;
        break;
      case 'faq':
        /* Only the ones they answered. The defaults ship as questions with
           blank answers now, so an untouched FAQ renders nothing rather than
           three empty rows — or, as before, three invented ones. */
        if (config.faq.every((f) => !f.a.trim())) return null;
        body = <FaqSection s={s} config={config} display={display} hairline={hairline} radius={RADIUS[shape.radius]} />;
        break;
      case 'rsvp':
        body = (
          <div className="text-center">
            <p className="mx-auto mb-6 max-w-md text-[1rem] opacity-80">
              {config.rsvpDeadline
                ? t('Svar venligst inden {date}.', { date: config.rsvpDeadline })
                : t('Vi glæder os til at fejre dagen med jer.')}
            </p>
            <button
              onClick={onRsvp}
              className="px-8 py-3.5 text-[0.82rem] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-85"
              style={btn()}
            >
              {design.copy.rsvpCta || t('Svar på invitation')}
            </button>
          </div>
        );
        break;
      default:
        return null;
    }
    if (body === null) return null;

    return (
      <section
        key={s.id}
        id={s.id}
        style={{
          background: tone.bg,
          color: tone.text,
          paddingTop: SECTION_PAD[shape.density],
          paddingBottom: SECTION_PAD[shape.density],
        }}
      >
        <div className="mx-auto px-6 sm:px-8" style={{ maxWidth: MAXW[shape.maxWidth] }}>
          <div className="text-center">
            {eyebrow(title, tone)}
            {s.intro && <p className="mx-auto mb-8 max-w-xl text-[0.95rem] leading-relaxed opacity-75">{s.intro}</p>}
          </div>
          {body}
          {decor.dividers && <Divider style={decor.style} color={tone.accent} />}
        </div>
      </section>
    );
  };

  return (
    <div style={{ background: palette.bg, color: palette.text, fontFamily: fontStack(typography.bodyFont) }} className="relative min-h-screen">
      <DecorLayer style={decor.style} color={palette.accent} />

      {/* Nav */}
      <nav
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 backdrop-blur-md sm:px-10"
        style={{ background: `${palette.bg}e6`, borderBottom: `1px solid ${palette.text}14` }}
      >
        <span style={display} className="text-[1.05rem]">{names}</span>
        <div className="hidden items-center gap-5 sm:flex">
          {on('story') && <a href="#story" className="text-[0.72rem] uppercase tracking-[0.14em] opacity-70 hover:opacity-100">{t('Historie')}</a>}
          {on('program') && <a href="#program" className="text-[0.72rem] uppercase tracking-[0.14em] opacity-70 hover:opacity-100">{t('Program')}</a>}
          {on('gifts') && <a href="#gifts" className="text-[0.72rem] uppercase tracking-[0.14em] opacity-70 hover:opacity-100">{t('Gaveønsker')}</a>}
          {on('rsvp') && (
            <button
              onClick={onRsvp}
              className="px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] transition-opacity hover:opacity-85"
              style={btn()}
            >
              RSVP
            </button>
          )}
        </div>
      </nav>

      <Hero
        design={design} couple={couple} names={names} days={days} heroImg={heroImg}
        display={display} btn={btn} showRsvp={on('rsvp')} onRsvp={onRsvp} t={t}
        radius={RADIUS[shape.radius]} hairline={hairline}
      />

      <main>{sections.map(renderSection)}</main>

      {extra}

      {!config.hideBranding && (
        <footer className="py-10 text-center" style={{ borderTop: `1px solid ${palette.text}12` }}>
          {design.copy.footerLine && (
            <p className="mb-2 text-[0.82rem] opacity-60">{design.copy.footerLine}</p>
          )}
          <span className="text-[0.72rem] uppercase tracking-[0.2em] opacity-40">{t('Lavet med')} </span>
          <span className="font-serif text-[0.9rem] tracking-[0.12em] opacity-60">Kalas</span>
        </footer>
      )}
    </div>
  );
}

/* ── Hero variants ─────────────────────────────────────────────────────── */

function Hero({
  design, couple, names, days, heroImg, display, btn, showRsvp, onRsvp, t, radius, hairline,
}: {
  design: SiteDesign; couple: PublicCouple; names: string; days: number; heroImg: string;
  display: React.CSSProperties; btn: (e?: React.CSSProperties) => React.CSSProperties;
  showRsvp: boolean; onRsvp?: () => void;
  t: (s: string, p?: Record<string, string | number>) => string;
  radius: string; hairline: string;
}) {
  const { palette, typography, hero } = design;
  const size = HERO_SIZE[typography.scale];

  const countdown = hero.showCountdown && days > 0 && (
    <div className="mt-7 inline-flex items-center gap-2 px-5 py-2" style={btn({ background: `${palette.accent}e6` })}>
      <span className="text-[1.1rem] font-bold tabular-nums">{days}</span>
      <span className="text-[0.72rem] uppercase tracking-[0.16em]">{t('dage til')}</span>
    </div>
  );
  const rsvpBtn = showRsvp && (
    <div className="mt-7">
      <button onClick={onRsvp} className="px-7 py-3 text-[0.78rem] font-semibold uppercase tracking-[0.16em] transition-opacity hover:opacity-85" style={btn()}>
        {t('Svar på invitation')}
      </button>
    </div>
  );
  const dateLine = (cls: string) => (
    <p className={`mb-3 text-[0.75rem] uppercase tracking-[0.34em] ${cls}`}>{couple.dateLabel}</p>
  );
  const tagline = (cls: string) => (
    <p className={`mt-4 text-[0.95rem] ${cls}`}>{design.copy.tagline}</p>
  );

  switch (hero.variant) {
    case 'split':
      return (
        <header className="grid min-h-[78vh] md:grid-cols-2">
          <div className="relative min-h-[38vh]">
            <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-center px-8 py-16 text-center" style={{ background: palette.surface }}>
            <div>
              {dateLine('opacity-70')}
              <h1 style={{ ...display, fontSize: `calc(${size} * 0.72)` }}>{names}</h1>
              {tagline('opacity-75')}
              {countdown}
              {rsvpBtn}
            </div>
          </div>
        </header>
      );

    case 'framed':
      return (
        <header className="px-6 pb-4 pt-10 sm:px-10">
          <div className="relative mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center overflow-hidden text-center" style={{ borderRadius: radius, border: hairline }}>
            <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0" style={{ background: `rgba(10,12,10,${design.palette.heroOverlay})` }} />
            <div className="relative px-6 py-16">
              {dateLine('text-white/80')}
              <h1 className="text-white" style={{ ...display, fontSize: `calc(${size} * 0.85)` }}>{names}</h1>
              {tagline('text-white/85')}
              {countdown}
              {rsvpBtn}
            </div>
          </div>
        </header>
      );

    case 'editorial':
      return (
        <header className="px-6 pt-16 sm:px-10">
          <div className="mx-auto max-w-6xl">
            {dateLine('opacity-70')}
            <h1 className="break-words" style={{ ...display, fontSize: size }}>{names}</h1>
            {tagline('max-w-xl opacity-75')}
            <div className="mt-4 flex flex-wrap items-center gap-6">{countdown}{rsvpBtn}</div>
            <div className="mt-10 overflow-hidden" style={{ borderRadius: radius }}>
              <img src={heroImg} alt="" className="max-h-[62vh] w-full object-cover" />
            </div>
          </div>
        </header>
      );

    case 'minimal':
      return (
        <header className="flex min-h-[70vh] items-center justify-center px-6 text-center">
          <div>
            {dateLine('opacity-60')}
            <h1 style={{ ...display, fontSize: size }}>{names}</h1>
            <div className="mx-auto mt-6 h-px w-16" style={{ background: palette.accent }} />
            {tagline('opacity-70')}
            {countdown}
            {rsvpBtn}
          </div>
        </header>
      );

    case 'arch':
      return (
        <header className="px-6 pb-4 pt-12 text-center sm:px-10">
          <div className="mx-auto max-w-3xl">
            {dateLine('opacity-70')}
            <h1 style={{ ...display, fontSize: `calc(${size} * 0.8)` }}>{names}</h1>
            {tagline('opacity-75')}
            <div
              className="relative mx-auto mt-10 aspect-[3/4] max-w-md overflow-hidden"
              style={{ borderRadius: '50% 50% 0 0 / 38% 38% 0 0' }}
            >
              <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
            </div>
            {countdown}
            {rsvpBtn}
          </div>
        </header>
      );

    case 'full-bleed':
    default:
      return (
        <header className="relative flex min-h-[78vh] items-center justify-center overflow-hidden px-6 text-center">
          <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: `rgba(10,12,10,${design.palette.heroOverlay})` }} />
          <div className="relative">
            {dateLine('text-white/80')}
            <h1 className="text-white" style={{ ...display, fontSize: size }}>{names}</h1>
            {tagline('text-white/85')}
            {countdown}
            {rsvpBtn}
          </div>
        </header>
      );
  }
}

/* ── Section bodies ────────────────────────────────────────────────────── */

type Tone = { bg: string; text: string; muted: string; accent: string; onAccent: string };

function StorySection({ s, config, design, tone, display, resolveImg }: {
  s: DesignSection; config: SiteConfig; design: SiteDesign; tone: Tone;
  display: React.CSSProperties; resolveImg: (ref: string) => string | null;
}) {
  const textBody = config.storyText || design.copy.storyIntro;
  if (s.variant === 'quote') {
    return (
      <blockquote className="mx-auto max-w-xl text-center">
        <span aria-hidden className="block text-[3rem] leading-none" style={{ ...display, color: tone.accent }}>&ldquo;</span>
        <p className="text-[1.35rem] leading-relaxed" style={display}>{textBody}</p>
      </blockquote>
    );
  }
  if (s.variant === 'side-image') {
    const sideImg = resolveImg(design.images.galleryPhotoIds[0] ?? '') ?? IMAGES.rings;
    return (
      <div className="grid items-center gap-8 md:grid-cols-2">
        <img src={sideImg} alt="" className="aspect-[4/5] w-full rounded-[inherit] object-cover" style={{ borderRadius: '0.75rem' }} />
        <p className="text-[1.15rem] leading-relaxed opacity-90">{textBody}</p>
      </div>
    );
  }
  return <p className="mx-auto max-w-xl text-center text-[1.3rem] leading-relaxed" style={display}>{textBody}</p>;
}

function ProgramSection({ s, config, tone, display, hairline }: {
  s: DesignSection; config: SiteConfig; tone: Tone; display: React.CSSProperties; hairline: string;
}) {
  if (s.variant === 'columns') {
    return (
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {config.program.map((ev) => (
          <div key={ev.id} className="text-center">
            <p className="tabular-nums text-[1.3rem]" style={{ ...display, color: tone.accent }}>{ev.time}</p>
            <p className="mt-1 text-[1.02rem]" style={display}>{ev.label}</p>
            {ev.sublabel && <p className="text-[0.85rem] opacity-60">{ev.sublabel}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (s.variant === 'minimal') {
    return (
      <div className="mx-auto max-w-md space-y-2 text-center">
        {config.program.map((ev) => (
          <p key={ev.id} className="text-[1rem]">
            <span className="tabular-nums" style={{ color: tone.accent }}>{ev.time}</span>
            <span className="mx-3 opacity-40">·</span>
            {ev.label}
          </p>
        ))}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md">
      {config.program.map((ev) => (
        <div key={ev.id} className="flex items-baseline gap-5 py-4" style={{ borderBottom: hairline }}>
          <span className="w-14 shrink-0 tabular-nums text-[0.95rem]" style={{ color: tone.accent }}>{ev.time}</span>
          <div>
            <p style={{ ...display, fontSize: '1.1rem' }}>{ev.label}</p>
            {ev.sublabel && <p className="text-[0.85rem] opacity-60">{ev.sublabel}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function GallerySection({ s, images, radius }: { s: DesignSection; images: string[]; radius: string }) {
  if (s.variant === 'filmstrip') {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="h-64 w-auto shrink-0 object-cover" style={{ borderRadius: radius }} />
        ))}
      </div>
    );
  }
  if (s.variant === 'masonry') {
    return (
      <div className="columns-2 gap-3 sm:columns-3 [&>img]:mb-3">
        {images.map((url, i) => (
          <img key={i} src={url} alt="" className="w-full break-inside-avoid object-cover" style={{ borderRadius: radius }} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map((url, i) => (
        <div key={i} className="aspect-square overflow-hidden" style={{ borderRadius: radius }}>
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

function GiftsSection({ s, config, tone, display, btn, registryItems, claimedByItem, onClaim, t }: {
  s: DesignSection; config: SiteConfig; tone: Tone; display: React.CSSProperties;
  btn: (e?: React.CSSProperties) => React.CSSProperties;
  registryItems: RegistryItemRow[]; claimedByItem: Record<string, number>;
  onClaim?: (item: RegistryItemRow) => void;
  t: (s: string, p?: Record<string, string | number>) => string;
}) {
  const list = s.variant === 'list';
  /* A guest arrives with an amount in mind, not a product. Only worth showing
     once the list is long enough that scrolling it is a chore. */
  const [band, setBand] = useState('all');
  const all = sortGifts(registryItems);
  const shown = all.filter((it) => inBand(it.price_cents, band));
  return (
    <>
      {config.giftsText && <p className="mx-auto mb-8 max-w-xl text-center text-[0.98rem] leading-relaxed opacity-80">{config.giftsText}</p>}
      {all.length >= 6 && (
        <div className="mx-auto mb-6 flex flex-wrap justify-center gap-1.5">
          {PRICE_BANDS.map((b) => {
            const count = all.filter((it) => inBand(it.price_cents, b.id)).length;
            if (count === 0) return null;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBand(b.id)}
                className="rounded-full border px-3 py-1.5 text-[0.74rem] font-medium transition-opacity"
                style={band === b.id ? btn() : { borderColor: 'currentColor', opacity: 0.6 }}
              >
                {t(b.label)}
              </button>
            );
          })}
        </div>
      )}
      {/* Both variants now show the same GiftCard, the point of the redesign
          is that the couple's screen and the guest's page look alike. `list`
          only narrows it to one column. Tone is inherited so the card takes
          this site's palette rather than the app's. */}
      {shown.length > 0 && (
        <div className={list ? 'mx-auto max-w-sm space-y-4' : 'grid gap-4 grid-cols-2 lg:grid-cols-3'}>
          {shown.map((it) => {
            const claimed = claimedByItem[it.id] ?? 0;
            const left = Math.max(0, it.quantity - claimed);
            return (
              <GiftCard
                key={it.id}
                item={it}
                reserved={left <= 0}
                tone="inherit"
                titleStyle={display}
                footer={
                  <div className="flex flex-wrap items-center gap-2">
                    {left > 0 && (
                      <button onClick={() => onClaim?.(it)} className="px-3.5 py-1.5 text-[0.72rem] font-semibold" style={btn()}>
                        {t('Reservér gave')}
                      </button>
                    )}
                    {it.product_url && (
                      <a href={it.product_url} target="_blank" rel="noopener noreferrer"
                        className="px-3.5 py-1.5 text-[0.72rem] font-medium" style={{ border: `1px solid ${tone.text}25`, borderRadius: '999px' }}>
                        {t('Se hos {store}', { store: it.store_name || t('butik') })}
                      </a>
                    )}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
      {config.giftsUrl && (
        <div className="mt-6 text-center">
          <a href={config.giftsUrl} target="_blank" rel="noopener noreferrer"
            className="px-6 py-2.5 text-[0.78rem] font-semibold uppercase tracking-[0.14em]" style={btn()}>
            {t('Se ønskelisten')}
          </a>
        </div>
      )}
    </>
  );
}

function PlainText({ text, framed, hairline, radius }: { text: string; framed: boolean; hairline: string; radius: string }) {
  const p = <p className="mx-auto max-w-xl whitespace-pre-line text-center text-[0.98rem] leading-relaxed opacity-80">{text}</p>;
  if (!framed) return p;
  return <div className="mx-auto max-w-xl px-6 py-8" style={{ border: hairline, borderRadius: radius }}>{p}</div>;
}

function HotelSection({ s, config, tone, display, hairline, radius }: {
  s: DesignSection; config: SiteConfig; tone: Tone; display: React.CSSProperties; hairline: string; radius: string;
}) {
  if (s.variant === 'cards') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {config.hotels.map((h) => (
          <div key={h.id} className="px-5 py-5 text-center" style={{ border: hairline, borderRadius: radius }}>
            <p style={{ ...display, fontSize: '1rem' }}>{h.name}</p>
            <p className="text-[0.82rem] opacity-60">{h.dist}</p>
            <p className="mt-2 text-[0.85rem]" style={{ color: tone.accent }}>{h.price}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-md space-y-3">
      {config.hotels.map((h) => (
        <div key={h.id} className="flex items-center justify-between gap-4 px-5 py-4" style={{ border: hairline, borderRadius: radius }}>
          <div>
            <p style={{ ...display, fontSize: '1rem' }}>{h.name}</p>
            <p className="text-[0.82rem] opacity-60">{h.dist}</p>
          </div>
          <span className="shrink-0 text-[0.82rem] opacity-70">{h.price}</span>
        </div>
      ))}
    </div>
  );
}

/** The entries the couple actually filled in. */
function answered(config: SiteConfig) {
  return config.faq.filter((f) => f.a.trim());
}

function FaqSection({ s, config, display, hairline, radius }: {
  s: DesignSection; config: SiteConfig; display: React.CSSProperties; hairline: string; radius: string;
}) {
  if (s.variant === 'two-col') {
    return (
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {answered(config).map((f) => (
          <div key={f.id}>
            <p style={{ ...display, fontSize: '1.02rem' }}>{f.q}</p>
            <p className="mt-2 text-[0.9rem] leading-relaxed opacity-75">{f.a}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl space-y-3">
      {answered(config).map((f) => (
        <details key={f.id} className="px-5 py-4" style={{ border: hairline, borderRadius: radius }}>
          <summary className="cursor-pointer text-[0.98rem]" style={{ ...display, fontSize: '1rem' }}>{f.q}</summary>
          <p className="mt-2 text-[0.9rem] leading-relaxed opacity-75">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

/* ── Decor ─────────────────────────────────────────────────────────────── */

function Divider({ style, color }: { style: string; color: string }) {
  if (style === 'none') return null;
  return (
    <div className="mt-14 flex justify-center" aria-hidden>
      {style === 'stars' ? (
        <span className="text-[0.9rem] tracking-[0.6em]" style={{ color }}>✦ ✦ ✦</span>
      ) : style === 'dots' ? (
        <span className="text-[0.7rem] tracking-[0.8em]" style={{ color }}>● ● ●</span>
      ) : style === 'botanical' ? (
        <svg width="90" height="18" viewBox="0 0 90 18" fill="none" aria-hidden>
          <path d="M2 9h32M56 9h32" stroke={color} strokeWidth="1" />
          <path d="M45 3c-3 2-5 4-5 6s2 4 5 6c3-2 5-4 5-6s-2-4-5-6z" stroke={color} strokeWidth="1" fill="none" />
        </svg>
      ) : (
        <div className="h-px w-24" style={{ background: color }} />
      )}
    </div>
  );
}

function DecorLayer({ style, color }: { style: string; color: string }) {
  if (style === 'grain') {
    return (
      <svg className="pointer-events-none fixed inset-0 z-0 h-full w-full opacity-[0.05]" aria-hidden>
        <filter id="sd-grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" /></filter>
        <rect width="100%" height="100%" filter="url(#sd-grain)" />
      </svg>
    );
  }
  if (style === 'botanical') {
    return (
      <svg className="pointer-events-none absolute right-0 top-0 z-0 opacity-[0.10]" width="260" height="260" viewBox="0 0 260 260" aria-hidden>
        <path d="M250 10c-60 10-110 40-140 90S70 210 10 250" stroke={color} strokeWidth="1.5" fill="none" />
        {[0.2, 0.4, 0.6, 0.8].map((p) => (
          <circle key={p} cx={250 - p * 240} cy={10 + p * 240} r="4" fill={color} />
        ))}
      </svg>
    );
  }
  return null;
}
