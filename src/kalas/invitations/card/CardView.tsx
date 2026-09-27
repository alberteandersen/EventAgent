'use client';

/* The card on screen: an SVG the size of the card in units, so it scales to
   any box without re-laying out. The painting fills the paper (cropped to the
   card, as the print is), and every line sits where layoutCard put it. */

import { useId, useState } from 'react';
import { tapeRect, type CardLayout, type PhotoItem, type TextItem } from './layout';
import { useCardLayout } from './useCardLayout';
import { CARD_UNITS, cardHeight, findFormat } from './formats';
import type { CardSpec } from './spec';
import type { CardWording } from './layout';
import type { InviteContent } from '../content';

export function CardView({ spec, content, wording, artUrl, photoUrl, photoHint, title, className }: {
  spec: CardSpec;
  content: InviteContent;
  wording?: CardWording;
  /** The painting to show: Ava's (signed) or the vibe's sample. */
  artUrl: string | null;
  /** The couple's photo, for a card with a photo block. */
  photoUrl?: string | null;
  /** Words in an empty photo frame, e.g. "Vælg et billede". */
  photoHint?: string;
  title: string;
  className?: string;
}) {
  const layout = useCardLayout(spec, content, wording);
  const h = cardHeight(findFormat(spec.format));
  // A painting that will not load leaves the paper, not a broken-image mark.
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <svg
      viewBox={`0 0 ${CARD_UNITS} ${h}`}
      role="img"
      aria-label={title}
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', background: spec.palette.paper }}
    >
      <rect width={CARD_UNITS} height={h} fill={spec.palette.paper} />
      {artUrl && failed !== artUrl && (
        <image href={artUrl} x={0} y={0} width={CARD_UNITS} height={h} preserveAspectRatio="xMidYMid slice"
          onError={() => setFailed(artUrl)} />
      )}
      {layout && <CardItems layout={layout} spec={spec} photoUrl={photoUrl ?? null} photoHint={photoHint} />}
    </svg>
  );
}

function CardItems({ layout, spec, photoUrl, photoHint }: {
  layout: CardLayout; spec: CardSpec; photoUrl: string | null; photoHint?: string;
}) {
  return (
    <g>
      {layout.blocks.flatMap((b) => b.items).map((it, i) => {
        if (it.kind === 'rule') return <line key={i} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke={it.color} strokeWidth={1.5} />;
        if (it.kind === 'photo') return <SvgPhoto key={i} item={it} url={photoUrl} hint={photoHint} ink={spec.palette.ink} />;
        return <SvgLine key={i} item={it} />;
      })}
    </g>
  );
}

function SvgLine({ item }: { item: TextItem }) {
  // SVG spaces after every glyph, the last one too, so a centred line with
  // tracking sits half a space left of centre unless nudged back.
  return (
    <text
      x={item.anchor === 'middle' ? item.x + item.spacing / 2 : item.x}
      y={item.baseline}
      textAnchor={item.anchor}
      fill={item.color}
      style={{
        fontFamily: `"${item.family}", serif`,
        fontSize: item.size,
        fontWeight: item.weight,
        fontStyle: item.italic ? 'italic' : 'normal',
        letterSpacing: item.spacing,
        whiteSpace: 'pre',
      }}
    >
      {item.text}
    </text>
  );
}

/** The couple's photo in its frame, black and white if the design says so,
    with a strip of tape when it is stuck on. */
function SvgPhoto({ item, url, hint, ink }: { item: PhotoItem; url: string | null; hint?: string; ink: string }) {
  const id = useId().replace(/:/g, '');
  const tape = tapeRect(item);
  return (
    <g>
      <defs>
        <clipPath id={`clip-${id}`}><rect x={item.x} y={item.y} width={item.w} height={item.h} /></clipPath>
        <filter id={`bw-${id}`}><feColorMatrix type="saturate" values="0" /></filter>
      </defs>
      {url ? (
        <image href={url} x={item.x} y={item.y} width={item.w} height={item.h} preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#clip-${id})`} filter={item.tone === 'bw' ? `url(#bw-${id})` : undefined} />
      ) : (
        <>
          <rect x={item.x} y={item.y} width={item.w} height={item.h} fill={ink} fillOpacity={0.08} />
          {hint && (
            <text x={item.x + item.w / 2} y={item.y + item.h / 2} textAnchor="middle" fill={ink} fillOpacity={0.55}
              style={{ fontFamily: 'system-ui, sans-serif', fontSize: Math.max(18, item.w * 0.06) }}>{hint}</text>
          )}
        </>
      )}
      {item.tape && (
        <rect x={tape.x} y={tape.y} width={tape.w} height={tape.h} fill="#efeadf" fillOpacity={0.82}
          transform={`rotate(${tape.angle} ${tape.x + tape.w / 2} ${tape.y + tape.h / 2})`} />
      )}
    </g>
  );
}
