'use client';

/* The invitation as a vibe draws it, before Ava has built one: the same
   SiteDesign tokens the website's vibes carry, set as a single card. It is
   what the couple sees the moment they tap a vibe, and what a shared link
   shows if they publish without building.

   One renderer, six compositions (the vibe's hero variant picks one), so a
   vibe looks like itself on the card and on the site. Sizes are in container
   units: the card is designed at phone width and scales to any box it sits
   in, from a gallery thumbnail to the guest's own screen.

   The thank-you card after the day is the same card with `thanks` words:
   the eyebrow looks back, the reply button gives way to their own words and
   a closing, and the caller clears what no longer applies (venue, time). */

import type { CSSProperties, ReactNode } from 'react';
import type { SiteDesign } from '../site/design';
import { fontStack } from '../site/fonts';
import { coupleNames, dateLine, rsvpLine, type InviteContent } from './content';

const NAME_SIZE = { normal: 12.5, large: 14.5, dramatic: 17 } as const;
const TRACK = { tight: '-0.02em', normal: '0em', wide: '0.04em' } as const;

export function InviteCard({ design, content, photoUrl, onRsvp, thanks }: {
  design: SiteDesign;
  content: InviteContent;
  /** Their chosen photo; the photo layouts draw a monogram panel without. */
  photoUrl?: string | null;
  onRsvp?: () => void;
  /** Draw the thank-you instead: content.note, else `line`, stands where
      the reply was. */
  thanks?: { eyebrow: string; line: string; closing: string };
}) {
  const { palette, typography, shape, decor, hero } = design;
  const da = content.language === 'da';

  // Each name keeps to one line, so a long one comes down until it fits:
  // ~132cqw of display type holds one character per cqw of size, with room
  // for wide tracking and a heavy sans. Derived from the string, not
  // measured, so server and client agree.
  const fit = (chars: number, base: number) => Math.min(base, 132 / Math.max(chars, 1));
  const longest = Math.max(content.partnerA.length, content.partnerB.length);
  const nameSize = fit(longest, NAME_SIZE[typography.scale]);

  const display: CSSProperties = {
    fontFamily: fontStack(typography.displayFont),
    fontWeight: typography.displayWeight,
    fontStyle: typography.displayItalic ? 'italic' : 'normal',
    letterSpacing: TRACK[typography.tracking],
    lineHeight: 1.02,
  };
  const eyebrowStyle = (color: string): CSSProperties => ({
    color,
    margin: 0,
    fontSize: '2.7cqw',
    fontWeight: 600,
    letterSpacing: typography.uppercaseEyebrows ? '0.32em' : '0.06em',
    textTransform: typography.uppercaseEyebrows ? 'uppercase' : 'none',
  });
  const radius = shape.radius === 'none' ? '0' : shape.radius === 'soft' ? '1.6cqw' : '999px';
  const hair = (color: string) => (shape.borders === 'bold' ? `2px solid ${color}` : `1px solid ${color}`);

  const eyebrow = thanks ? thanks.eyebrow : da ? 'Vi gifter os' : "We're getting married";
  // Afterwards the words sit where the reply was, so the line under the
  // names has nothing left to say.
  const intro = thanks ? '' : da ? 'og vil elske at fejre dagen med jer' : 'and would love you to celebrate with us';
  const time = content.time && /^\d/.test(content.time) && da ? `Kl. ${content.time}` : content.time;
  const rsvpLabel = da ? 'Svar på invitationen' : 'Reply';
  const initials = [content.partnerA, content.partnerB].map((n) => n.charAt(0).toUpperCase()).filter(Boolean).join(' & ');

  /* The pieces every composition arranges. */
  const names = (color: string, align: 'center' | 'left' = 'center') => (
    <h1 style={{ ...display, color, fontSize: `${nameSize}cqw`, textAlign: align, margin: 0 }}>
      <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{content.partnerA || '—'}</span>
      <span style={{ display: 'block', fontSize: '0.42em', margin: '0.35em 0', opacity: 0.75 }}>&amp;</span>
      <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{content.partnerB || '—'}</span>
    </h1>
  );
  const details = (color: string, muted: string, align: 'center' | 'left' = 'center') => (
    <div style={{ textAlign: align, color }}>
      {dateLine(content) && <p style={{ fontSize: '3.9cqw', lineHeight: 1.45, margin: 0 }}>{dateLine(content)}</p>}
      {time && <p style={{ fontSize: '3.4cqw', margin: '0.6cqw 0 0', color: muted }}>{time}</p>}
      {(content.venue || content.venueDetail) && (
        <p style={{ fontSize: '3.6cqw', lineHeight: 1.45, margin: '3.4cqw 0 0' }}>
          {content.venue}
          {content.venueDetail && <span style={{ display: 'block', color: muted }}>{content.venueDetail}</span>}
        </p>
      )}
    </div>
  );
  const reply = (onBg: { fg: string; bg: string; muted: string }, align: 'center' | 'left' = 'center') => thanks ? (
    <div style={{ textAlign: align }}>
      <p style={{ fontSize: '3.7cqw', lineHeight: 1.55, margin: align === 'center' ? '0 auto' : 0, maxWidth: '76cqw', color: hero.variant === 'full-bleed' ? '#fff' : palette.text }}>
        {content.note || thanks.line}
      </p>
      <p style={{ ...display, fontSize: '4.6cqw', margin: '4cqw 0 0', color: onBg.muted }}>{thanks.closing}</p>
    </div>
  ) : (
    <div style={{ textAlign: align }}>
      <button
        type="button"
        data-kalas="rsvp"
        onClick={onRsvp}
        style={{
          background: onBg.bg, color: onBg.fg, border: 'none', borderRadius: radius,
          padding: '3.2cqw 7cqw', fontFamily: 'inherit', fontSize: '2.9cqw', fontWeight: 600,
          letterSpacing: '0.18em', textTransform: 'uppercase', cursor: onRsvp ? 'pointer' : 'default',
        }}
      >
        {rsvpLabel}
      </button>
      {rsvpLine(content) && <p style={{ fontSize: '2.9cqw', margin: '2.6cqw 0 0', color: onBg.muted }}>{rsvpLine(content)}</p>}
      {content.note && <p style={{ fontSize: '3.1cqw', lineHeight: 1.5, margin: '3.4cqw auto 0', maxWidth: '76cqw', color: onBg.muted }}>{content.note}</p>}
    </div>
  );
  const ornament = (color: string) =>
    decor.dividers ? <Ornament style={decor.style} color={color} /> : <span style={{ display: 'block', width: '10cqw', height: 1, background: color, margin: '0 auto' }} />;

  const photo = (style: CSSProperties) =>
    photoUrl ? (
      <img src={photoUrl} alt="" style={{ ...style, objectFit: 'cover', display: 'block' }} />
    ) : (
      <div style={{ ...style, background: `${palette.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ ...display, fontSize: '11cqw', color: palette.accent, opacity: 0.8 }}>{initials}</span>
      </div>
    );

  const onAccent = { fg: palette.onAccent, bg: palette.accent, muted: palette.muted };
  let body: ReactNode;

  switch (hero.variant) {
    case 'split':
      body = (
        <>
          {photo({ width: '100%', height: '36%', flexShrink: 0 })}
          <Column gap="4.5cqw" style={{ background: palette.surface, flex: 1, padding: '7cqw 8cqw' }}>
            <p style={eyebrowStyle(palette.accent)}>{eyebrow}</p>
            {names(palette.text)}
            {ornament(palette.accent)}
            {details(palette.text, palette.muted)}
            {reply(onAccent)}
          </Column>
        </>
      );
      break;

    case 'arch':
      body = (
        <Column gap="5cqw" style={{ flex: 1, padding: '11cqw 9cqw 10cqw' }}>
          <p style={eyebrowStyle(palette.accent)}>{eyebrow}</p>
          {photo({ width: '54cqw', height: '66cqw', borderRadius: '27cqw 27cqw 0 0', margin: '0 auto' })}
          {names(palette.text)}
          {details(palette.text, palette.muted)}
          {reply(onAccent)}
        </Column>
      );
      break;

    case 'full-bleed': {
      const dark = { fg: palette.text, bg: palette.bg, muted: 'rgba(255,255,255,0.78)' };
      body = (
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', color: '#fff', background: palette.text }}>
          {photoUrl && <img src={photoUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,${palette.heroOverlay * 0.5}) 0%, rgba(0,0,0,${Math.min(0.88, palette.heroOverlay + 0.3)}) 50%, rgba(0,0,0,${Math.min(0.92, palette.heroOverlay + 0.37)}) 100%)` }} />
          <Column gap="5cqw" style={{ position: 'relative', flex: 1, justifyContent: 'flex-end', padding: '12cqw 8cqw' }}>
            <p style={eyebrowStyle('rgba(255,255,255,0.85)')}>{eyebrow}</p>
            {names('#fff')}
            {intro && <p style={{ fontSize: '3.5cqw', margin: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)', fontStyle: 'italic' }}>{intro}</p>}
            {details('#fff', 'rgba(255,255,255,0.78)')}
            {reply(dark)}
          </Column>
        </div>
      );
      break;
    }

    case 'editorial':
      body = (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10cqw 8cqw 9cqw', gap: '6cqw' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <p style={eyebrowStyle(palette.accent)}>{eyebrow}</p>
            {content.date && <p style={{ ...eyebrowStyle(palette.muted), letterSpacing: '0.12em' }}>{content.date.split('-').reverse().join('.')}</p>}
          </div>
          <h1 style={{ ...display, color: palette.text, margin: 0, whiteSpace: 'nowrap',
            fontSize: `${fit(Math.max(content.partnerA.length, content.partnerB.length + 2), NAME_SIZE[typography.scale] * 1.12)}cqw` }}>
            {content.partnerA}<br />
            <span style={{ color: palette.accent }}>&amp;</span> {content.partnerB}
          </h1>
          {intro && <p style={{ fontSize: '3.6cqw', lineHeight: 1.5, margin: 0, color: palette.muted, maxWidth: '70cqw' }}>{intro}.</p>}
          <dl style={{ margin: 0, borderTop: hair(`${palette.text}33`) }}>
            {[
              [da ? 'Dato' : 'Date', dateLine(content)],
              [da ? 'Tid' : 'Time', time],
              [da ? 'Sted' : 'Place', [content.venue, content.venueDetail].filter(Boolean).join(', ')],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '18cqw 1fr', gap: '3cqw', padding: '3.2cqw 0', borderBottom: hair(`${palette.text}33`) }}>
                <dt style={{ ...eyebrowStyle(palette.muted), fontSize: '2.5cqw', paddingTop: '0.6cqw' }}>{k}</dt>
                <dd style={{ margin: 0, fontSize: '3.6cqw', lineHeight: 1.4, color: palette.text }}>{v}</dd>
              </div>
            ))}
          </dl>
          {/* The reply button sits at the foot; their words follow the date. */}
          <div style={{ marginTop: thanks ? '2cqw' : 'auto' }}>{reply(onAccent, 'left')}</div>
        </div>
      );
      break;

    case 'framed':
      body = (
        <div style={{ flex: 1, display: 'flex', padding: '5cqw' }}>
          <div style={{ flex: 1, display: 'flex', border: hair(palette.accent), padding: '1.4cqw' }}>
            <Column gap="5.5cqw" style={{ flex: 1, border: `1px solid ${palette.accent}66`, padding: '10cqw 7cqw' }}>
              <p style={eyebrowStyle(palette.accent)}>{eyebrow}</p>
              {names(palette.text)}
              {intro && <p style={{ fontSize: '3.5cqw', margin: 0, textAlign: 'center', color: palette.muted, fontStyle: 'italic' }}>{intro}</p>}
              {ornament(palette.accent)}
              {details(palette.text, palette.muted)}
              {reply(onAccent)}
            </Column>
          </div>
        </div>
      );
      break;

    case 'minimal':
    default:
      body = (
        <Column gap="7cqw" style={{ flex: 1, padding: '14cqw 9cqw' }}>
          <p style={eyebrowStyle(palette.muted)}>{eyebrow}</p>
          {names(palette.text)}
          {ornament(palette.accent)}
          {details(palette.text, palette.muted)}
          {reply(onAccent)}
        </Column>
      );
  }

  return (
    <div
      aria-label={coupleNames(content)}
      style={{
        containerType: 'inline-size', position: 'relative', overflow: 'hidden',
        width: '100%', height: '100%', minHeight: 'inherit', display: 'flex', flexDirection: 'column',
        background: palette.bg, color: palette.text, fontFamily: fontStack(typography.bodyFont),
      }}
    >
      {/* Texture sits under the words, except over a full-bleed photo,
          where under would mean hidden. */}
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>{body}</div>
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: hero.variant === 'full-bleed' ? 2 : 0 }}>
        <Decor style={decor.style} color={hero.variant === 'full-bleed' ? '#ffffff' : palette.accent} />
      </div>
    </div>
  );
}

function Column({ children, gap, style }: { children: ReactNode; gap: string; style?: CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', gap, ...style }}>
      {children}
    </div>
  );
}

/** A small mark between the names and the details. */
function Ornament({ style, color }: { style: string; color: string }) {
  if (style === 'stars') return <span aria-hidden style={{ color, fontSize: '3cqw', letterSpacing: '0.6em', paddingLeft: '0.6em' }}>✦ ✦ ✦</span>;
  if (style === 'dots') return <span aria-hidden style={{ color, fontSize: '2cqw', letterSpacing: '0.8em', paddingLeft: '0.8em' }}>● ● ●</span>;
  if (style === 'botanical') {
    return (
      <svg aria-hidden viewBox="0 0 90 18" fill="none" style={{ width: '24cqw', margin: '0 auto', display: 'block' }}>
        <path d="M2 9h32M56 9h32" stroke={color} strokeWidth="1" />
        <path d="M45 3c-3 2-5 4-5 6s2 4 5 6c3-2 5-4 5-6s-2-4-5-6z" stroke={color} strokeWidth="1" />
      </svg>
    );
  }
  return <span aria-hidden style={{ display: 'block', width: '16cqw', height: 1, background: color, margin: '0 auto' }} />;
}

/** The vibe's texture, kept to the edges so it never sits under text. */
function Decor({ style, color }: { style: string; color: string }) {
  const layer: CSSProperties = { position: 'absolute', pointerEvents: 'none' };
  if (style === 'botanical') {
    const sprig = (
      <>
        <path d="M4 116C30 84 52 50 110 6" stroke={color} strokeWidth="1.2" fill="none" />
        {[0.25, 0.45, 0.65, 0.85].map((p) => {
          const x = 4 + p * 106, y = 116 - p * 110;
          return <ellipse key={p} cx={x + 7} cy={y + 2} rx="7" ry="2.6" transform={`rotate(-38 ${x + 7} ${y + 2})`} fill={color} />;
        })}
      </>
    );
    return (
      <>
        <svg aria-hidden viewBox="0 0 120 120" style={{ ...layer, top: '-2cqw', right: '-2cqw', width: '30cqw', opacity: 0.28, transform: 'scaleX(-1)' }}>{sprig}</svg>
        <svg aria-hidden viewBox="0 0 120 120" style={{ ...layer, bottom: '-2cqw', left: '-2cqw', width: '30cqw', opacity: 0.28, transform: 'scaleY(-1)' }}>{sprig}</svg>
      </>
    );
  }
  if (style === 'stars') {
    const stars: [number, number, number][] = [[8, 6, 3.4], [88, 9, 2.4], [80, 22, 1.8], [14, 30, 1.6], [92, 60, 2.2], [6, 74, 2.6], [86, 90, 3], [20, 94, 1.8]];
    return (
      <>
        {stars.map(([x, y, s], i) => (
          <span key={i} aria-hidden style={{ ...layer, left: `${x}%`, top: `${y}%`, fontSize: `${s}cqw`, color, opacity: 0.55 }}>✦</span>
        ))}
      </>
    );
  }
  if (style === 'dots') {
    const dots: [number, number, number, number][] = [[6, 5, 2.4, 0.5], [16, 11, 1.4, 0.35], [90, 7, 3, 0.4], [84, 15, 1.6, 0.5], [8, 88, 2.8, 0.4], [92, 92, 2, 0.5], [82, 84, 1.2, 0.35]];
    return (
      <>
        {dots.map(([x, y, s, o], i) => (
          <span key={i} aria-hidden style={{ ...layer, left: `${x}%`, top: `${y}%`, width: `${s}cqw`, height: `${s}cqw`, borderRadius: '50%', background: color, opacity: o }} />
        ))}
      </>
    );
  }
  if (style === 'lines') {
    return (
      <>
        <span aria-hidden style={{ ...layer, left: '8cqw', right: '8cqw', top: '5cqw', height: 1, background: color, opacity: 0.35 }} />
        <span aria-hidden style={{ ...layer, left: '8cqw', right: '8cqw', bottom: '5cqw', height: 1, background: color, opacity: 0.35 }} />
      </>
    );
  }
  if (style === 'grain') {
    return (
      <svg aria-hidden style={{ ...layer, inset: 0, width: '100%', height: '100%', opacity: 0.06 }}>
        <filter id="inv-grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" /></filter>
        <rect width="100%" height="100%" filter="url(#inv-grain)" />
      </svg>
    );
  }
  return null;
}
