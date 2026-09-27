/* Setting the card: every line of every block placed at exact coordinates,
   from the design (how things look) and the content (what they say). The
   screen, the PNG and the Canva file all draw from this one result, so what
   the couple approves is what they print.

   Pure, given a way to measure text: the browser passes canvas measureText
   once the fonts have loaded, tests pass a stand-in. Blocks stack down the
   text area, centred in it or set flush left, and the stack centres
   vertically; a long name comes down in size to fit its line, and if the
   whole stack is taller than the area, every size and gap comes down
   together until it fits. */

import { CARD_UNITS, cardHeight, findFormat } from './formats';
import { findCardFont, nearestWeight } from './fonts';
import type { CardBlock, CardSpec, TextStyle, WordingRole } from './spec';
import { dateLine, rsvpLine, type InviteContent } from '../content';

/** Words the couple typed over the design's own. */
export type CardWording = Partial<Record<WordingRole, string>>;

export interface Measure {
  /** Width in units of `text` set at `size` units, before tracking. */
  (text: string, font: { family: string; size: number; weight: number; italic: boolean }): number;
}

export interface TextItem {
  kind: 'text';
  role: CardBlock['role'];
  text: string;
  /** Where the line hangs from: its centre, or its left edge. */
  anchor: 'middle' | 'start';
  x: number;
  baseline: number;
  family: string;
  fontId: string;
  size: number;
  weight: number;
  italic: boolean;
  /** Letter spacing in units (already size × em). */
  spacing: number;
  color: string;
  /** The line's box: left, top, width, height. */
  box: { x: number; y: number; w: number; h: number };
}

export interface RuleItem { kind: 'rule'; x1: number; y1: number; x2: number; y2: number; color: string }

export interface PhotoItem {
  kind: 'photo';
  x: number; y: number; w: number; h: number;
  tone: 'bw' | 'color';
  tape: boolean;
}

export type CardItem = TextItem | RuleItem | PhotoItem;

/** Where the tape sits over a stuck-on photo's top edge, for every renderer. */
export function tapeRect(p: PhotoItem) {
  const w = p.w * 0.34;
  const h = p.w * 0.075;
  return { x: p.x + (p.w - w) / 2, y: p.y - h * 0.45, w, h, angle: -2.5 };
}

export interface LaidBlock {
  role: CardBlock['role'];
  items: CardItem[];
}

export interface CardLayout {
  width: number;
  height: number;
  blocks: LaidBlock[];
}

/** Ascent as a share of the size: where a line's baseline sits in its box. */
const ASCENT = 0.8;
/** Smallest a name may shrink to, as a share of its set size. */
const MIN_NAME_SCALE = 0.5;

const locale = (lang: string) => (lang === 'en' ? 'en-GB' : 'da-DK');

/** A line to set, in the style it is set in. */
interface Line { text: string; style: TextStyle }

export function layoutCard(spec: CardSpec, content: InviteContent, measure: Measure, wording: CardWording = content.wording ?? {}): CardLayout {
  const format = findFormat(spec.format);
  const width = CARD_UNITS;
  const height = cardHeight(format);
  const area = {
    x: spec.textArea.left * width,
    y: spec.textArea.top * height,
    w: (1 - spec.textArea.left - spec.textArea.right) * width,
    h: (1 - spec.textArea.top - spec.textArea.bottom) * height,
  };
  const left = spec.align === 'left';
  const anchorX = left ? area.x : area.x + area.w / 2;
  const color = (c: TextStyle['color']) => (c === 'accent' ? spec.palette.accent : spec.palette.ink);
  const lang = content.language;

  const cased = (text: string, st: TextStyle) =>
    st.caps ? text.toLocaleUpperCase(locale(lang)) : st.lower ? text.toLocaleLowerCase(locale(lang)) : text;

  const widthOf = (text: string, st: TextStyle, size: number) => {
    const f = findCardFont(st.font);
    return measure(text, { family: f.family, size, weight: nearestWeight(f, st.weight), italic: st.italic && f.italics })
      + st.tracking * size * Math.max(0, [...text].length - 1);
  };

  /** A line of text as an item, its top at `top`, hung from `x`. */
  const item = (role: CardBlock['role'], text: string, st: TextStyle, size: number, x: number, top: number, anchor: TextItem['anchor']): TextItem => {
    const f = findCardFont(st.font);
    const w = widthOf(text, st, size);
    const h = size * st.lineHeight;
    return {
      kind: 'text', role, text, anchor, x,
      baseline: top + (h - size) / 2 + size * ASCENT,
      family: f.family, fontId: f.id, size,
      weight: nearestWeight(f, st.weight), italic: st.italic && f.italics,
      spacing: st.tracking * size, color: color(st.color),
      box: { x: anchor === 'middle' ? x - w / 2 : x, y: top, w, h },
    };
  };

  /** Greedy word wrap of one paragraph into lines no wider than `max`. */
  const wrap = (text: string, st: TextStyle, size: number, max: number): string[] => {
    const out: string[] = [];
    for (const para of text.split('\n')) {
      let cur = '';
      for (const word of para.split(/[ \t]+/).filter(Boolean)) {
        const next = cur ? `${cur} ${word}` : word;
        if (cur && widthOf(next, st, size) > max) { out.push(cur); cur = word; } else cur = next;
      }
      if (cur) out.push(cur);
    }
    return out;
  };

  const timeText = () => {
    const time = content.time.trim();
    return time && lang === 'da' && /^\d/.test(time) ? `kl. ${time}` : time;
  };

  const dateText = (b: CardBlock): string => {
    if (!content.date) return '';
    const d = new Date(`${content.date}T12:00:00`);
    switch (b.dateStyle) {
      case 'numeric': {
        const two = (n: number) => String(n).padStart(2, '0');
        return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
      }
      case 'short':
        return lang === 'en'
          ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
          : `${d.getDate()}. ${d.toLocaleDateString('da-DK', { month: 'long' })} ${d.getFullYear()}`;
      default:
        return dateLine(content);
    }
  };

  const joinerText = (b: CardBlock) =>
    b.joiner === 'plus' ? '+' : b.joiner === 'word' ? (lang === 'en' ? 'and' : 'og') : '&';

  /** A block's lines, each in its own style, or none when it has nothing to say. */
  const linesOf = (b: CardBlock): Line[] => {
    const words = (w: WordingRole) => (wording[w]?.trim() || b.text).trim();
    const sub = b.sub ?? b;
    const main = (t: string): Line => ({ text: t, style: b });
    switch (b.role) {
      case 'eyebrow': case 'invite': case 'closing': return words(b.role) ? [main(words(b.role))] : [];
      case 'names': {
        const [a, c] = [content.partnerA.trim(), content.partnerB.trim()];
        if (!a || !c) return [a || c].filter(Boolean).map(main);
        return b.stack
          ? [main(a), { text: joinerText(b), style: b.joinerStyle ?? b }, main(c)]
          : [main(`${a} ${joinerText(b)} ${c}`)];
      }
      case 'date': case 'dateRow': {
        // A date row cannot hang from a left edge; there it is a date.
        const d = dateText(b.role === 'dateRow' ? { ...b, dateStyle: 'long' } : b);
        return d ? [main(d), ...(timeText() ? [{ text: timeText(), style: sub }] : [])] : [];
      }
      case 'venue': return [
        ...(content.venue.trim() ? [main(content.venue.trim())] : []),
        ...(content.venueDetail.trim() ? [{ text: content.venueDetail.trim(), style: sub }] : []),
      ];
      case 'note': return content.note.trim() ? [main(content.note.trim())] : [];
      case 'rsvp': return rsvpLine(content) ? [main(rsvpLine(content))] : [];
      case 'divider': return b.text ? [main(b.text)] : [];
      case 'photo': return [];
    }
  };

  /** Blocks with something to show. A photo block always has its frame, so the
      couple sees where their photo goes before they pick one. */
  const blocks = spec.blocks.filter((b) =>
    b.role === 'photo' || (b.role === 'divider' && !b.text) || (b.role === 'dateRow' ? Boolean(content.date) : linesOf(b).length > 0));

  /** Lay every block out at scale `s`, top at `y0`. */
  const setAt = (s: number, y0: number) => {
    const laid: LaidBlock[] = [];
    let y = y0;
    blocks.forEach((b, i) => {
      if (i > 0) y += b.gap * s;

      if (b.role === 'dateRow' && !left) {
        const row = dateRow(b, s, y);
        laid.push(row.block);
        y += row.height;
        return;
      }
      if (b.role === 'photo') {
        const ph = b.photo ?? { width: 0.8, aspect: 1.1, tone: 'color', tape: false };
        const w = area.w * ph.width * s;
        const h = w / ph.aspect;
        laid.push({ role: 'photo', items: [{ kind: 'photo', x: left ? area.x : anchorX - w / 2, y, w, h, tone: ph.tone, tape: ph.tape }] });
        y += h;
        return;
      }
      if (b.role === 'divider' && !b.text) {
        // A short hairline: the block's size is its length.
        const len = b.size * 2.2 * s;
        const mid = y + (b.size * s * 0.5);
        const x1 = left ? area.x : anchorX - len / 2;
        laid.push({ role: 'divider', items: [{ kind: 'rule', x1, x2: x1 + len, y1: mid, y2: mid, color: color(b.color) }] });
        y += b.size * s;
        return;
      }

      let lines = linesOf(b).map((l) => ({ ...l, text: cased(l.text, l.style) }));
      let scale = s;
      if (b.role === 'names') {
        // 2% short of the full width, so rounding never tips a fitted line into a wrap.
        const fit = (ls: Line[]) => Math.min(1, (area.w * 0.98) / Math.max(...ls.map((l) => widthOf(l.text, l.style, l.style.size * s))));
        // On one line if it fits at a readable size; otherwise one name per
        // line with the joiner between, as a stacked design would have it.
        if (lines.length === 1 && fit(lines) < MIN_NAME_SCALE) {
          const stacked = linesOf({ ...b, stack: true });
          if (stacked.length === 3) lines = stacked.map((l) => ({ ...l, text: cased(l.text, l.style) }));
        }
        scale = s * Math.max(MIN_NAME_SCALE, fit(lines));
      }
      const items: TextItem[] = [];
      for (const l of lines) {
        const size = l.style.size * scale;
        for (const t of wrap(l.text, l.style, size, area.w)) {
          const it = item(b.role, t, l.style, size, anchorX, y, left ? 'start' : 'middle');
          items.push(it);
          y += it.box.h;
        }
      }
      laid.push({ role: b.role, items });
    });
    return { laid, bottom: y };
  };

  /** Weekday | month · DAY · year | time, with hairlines, like fine stationery. */
  const dateRow = (b: CardBlock, s: number, top: number): { block: LaidBlock; height: number } => {
    const sub = b.sub ?? b;
    const big = b.size * s;
    const small = sub.size * s;
    const d = new Date(`${content.date}T12:00:00`);
    const cap = (t: string) => cased(t, sub);
    const weekday = cap(d.toLocaleDateString(locale(lang), { weekday: 'long' }));
    const month = cap(d.toLocaleDateString(locale(lang), { month: 'long' }));
    const year = String(d.getFullYear());
    const time = timeText() ? cap(timeText()) : '';
    const day = String(d.getDate()).padStart(2, '0');
    const cx = anchorX;

    // With a time: month above the day and the year below, the weekday and
    // the time either side. Without one, the year takes the time's place.
    const [right, below] = time ? [time, year] : [year, ''];
    const subH = small * sub.lineHeight;
    const bigH = big * b.lineHeight;
    const height = subH + bigH + (below ? subH : 0);
    const items: CardItem[] = [
      item('dateRow', month, sub, small, cx, top, 'middle'),
      item('dateRow', day, b, big, cx, top + subH, 'middle'),
    ];
    if (below) items.push(item('dateRow', below, sub, small, cx, top + subH + bigH, 'middle'));

    const centreW = Math.max(...items.map((it) => (it as TextItem).box.w));
    const gutter = small * 1.4;
    const sideW = Math.max(small * 4, Math.min(area.w * 0.3, (area.w - centreW) / 2 - gutter));
    const mid = top + subH + bigH / 2;
    const rule = color(sub.color);
    for (const [text, sideX] of [[weekday, cx - centreW / 2 - gutter - sideW / 2], [right, cx + centreW / 2 + gutter + sideW / 2]] as const) {
      items.push(item('dateRow', text, sub, small, sideX, mid - subH / 2, 'middle'));
      const x1 = sideX - sideW / 2;
      const x2 = sideX + sideW / 2;
      items.push({ kind: 'rule', x1, x2, y1: mid - subH * 0.85, y2: mid - subH * 0.85, color: rule });
      items.push({ kind: 'rule', x1, x2, y1: mid + subH * 0.85, y2: mid + subH * 0.85, color: rule });
    }
    return { block: { role: 'dateRow', items }, height };
  };

  // Fit: shrink everything together until the stack fits the area.
  let s = 1;
  let set = setAt(s, 0);
  for (let i = 0; i < 6 && set.bottom > area.h; i++) {
    s *= (area.h / set.bottom) * 0.98;
    set = setAt(s, 0);
  }
  // Centre the stack vertically in the area.
  const offset = area.y + Math.max(0, (area.h - set.bottom) / 2);
  return { width, height, blocks: setAt(s, offset).laid };
}
