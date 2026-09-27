'use client';

/* Taking the card out of Kalas, from the same layout the screen draws:

   - PNG at 300 dpi, the painting, photo and words flattened, to print or send.
   - PowerPoint at the card's exact size, for Canva: the painting as the
     background, the photo as its own picture, and the words in text boxes in
     the same families, so everything stays editable after Canva imports it. */

import { findFormat, printPixels, CARD_UNITS } from './formats';
import { layoutCard, tapeRect, type CardWording, type PhotoItem, type TextItem } from './layout';
import { canvasMeasure, loadCardFonts } from './useCardLayout';
import type { CardSpec } from './spec';
import type { InviteContent } from '../content';

export interface CardExport {
  spec: CardSpec;
  content: InviteContent;
  wording?: CardWording;
  artUrl: string | null;
  /** The couple's photo, for a card with a photo block. */
  photoUrl?: string | null;
  /** Without extension. */
  fileName: string;
}

const TAPE = '#efeadf';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/** Draws `img` to cover the box, cropped about its centre (as the SVG does). */
function drawCover(g: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  g.restore();
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function prepare({ spec, content, wording }: CardExport) {
  await loadCardFonts(spec);
  return layoutCard(spec, content, canvasMeasure, wording);
}

/** One line, centred or from its left edge, with its tracking set glyph by glyph. */
function drawLine(g: CanvasRenderingContext2D, it: TextItem, k: number) {
  g.font = `${it.italic ? 'italic ' : ''}${it.weight} ${it.size * k}px "${it.family}", serif`;
  g.fillStyle = it.color;
  g.textAlign = 'left';
  const spacing = it.spacing * k;
  const chars = [...it.text];
  const total = spacing
    ? chars.reduce((sum, c) => sum + g.measureText(c).width, 0) + spacing * (chars.length - 1)
    : g.measureText(it.text).width;
  let x = it.anchor === 'middle' ? it.x * k - total / 2 : it.x * k;
  if (!spacing) {
    g.fillText(it.text, x, it.baseline * k);
    return;
  }
  for (const c of chars) {
    g.fillText(c, x, it.baseline * k);
    x += g.measureText(c).width + spacing;
  }
}

function drawPhoto(g: CanvasRenderingContext2D, p: PhotoItem, img: HTMLImageElement | null, ink: string, k: number) {
  if (img) {
    g.save();
    if (p.tone === 'bw') g.filter = 'grayscale(1)';
    drawCover(g, img, p.x * k, p.y * k, p.w * k, p.h * k);
    g.restore();
  } else {
    g.fillStyle = ink;
    g.globalAlpha = 0.08;
    g.fillRect(p.x * k, p.y * k, p.w * k, p.h * k);
    g.globalAlpha = 1;
  }
  if (p.tape) {
    const t = tapeRect(p);
    g.save();
    g.translate((t.x + t.w / 2) * k, (t.y + t.h / 2) * k);
    g.rotate((t.angle * Math.PI) / 180);
    g.globalAlpha = 0.82;
    g.fillStyle = TAPE;
    g.fillRect((-t.w / 2) * k, (-t.h / 2) * k, t.w * k, t.h * k);
    g.restore();
  }
}

export async function exportCardPng(job: CardExport): Promise<void> {
  const layout = await prepare(job);
  const { w, h } = printPixels(findFormat(job.spec.format));
  const k = w / CARD_UNITS;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas unavailable');

  g.fillStyle = job.spec.palette.paper;
  g.fillRect(0, 0, w, h);
  if (job.artUrl) drawCover(g, await loadImage(job.artUrl), 0, 0, w, h);
  const photo = job.photoUrl ? await loadImage(job.photoUrl) : null;

  g.textBaseline = 'alphabetic';
  for (const it of layout.blocks.flatMap((b) => b.items)) {
    if (it.kind === 'rule') {
      g.strokeStyle = it.color;
      g.lineWidth = 1.5 * k;
      g.beginPath();
      g.moveTo(it.x1 * k, it.y1 * k);
      g.lineTo(it.x2 * k, it.y2 * k);
      g.stroke();
    } else if (it.kind === 'photo') {
      drawPhoto(g, it, photo, job.spec.palette.ink, k);
    } else {
      drawLine(g, it, k);
    }
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) throw new Error('PNG export failed');
  download(blob, `${job.fileName}.png`);
}

/** An image as a JPEG data URL, cropped to `aspect` and in black and white if
    asked. PowerPoint readers, Canva among them, do not all take WebP (the
    sample paintings) or an SVG filter (the black-and-white photo). */
async function jpegDataUrl(url: string, opts: { aspect?: number; bw?: boolean } = {}): Promise<string> {
  const img = await loadImage(url);
  const aspect = opts.aspect ?? img.naturalWidth / img.naturalHeight;
  const w = Math.min(img.naturalWidth, Math.round(img.naturalHeight * aspect));
  const h = Math.round(w / aspect);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas unavailable');
  if (opts.bw) g.filter = 'grayscale(1)';
  drawCover(g, img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.92);
}

export async function exportCardPptx(job: CardExport): Promise<void> {
  const layout = await prepare(job);
  const format = findFormat(job.spec.format);
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CARD', width: format.widthIn, height: format.heightIn });
  pptx.layout = 'CARD';
  pptx.title = job.fileName;

  const inch = format.widthIn / CARD_UNITS;        // units → inches
  const pt = inch * 72;                             // units → points
  const hex = (c: string) => c.replace('#', '').toUpperCase();
  const slide = pptx.addSlide();
  slide.background = { color: hex(job.spec.palette.paper) };
  if (job.artUrl) {
    // Cropped to the card here, as the screen crops it.
    slide.addImage({
      data: await jpegDataUrl(job.artUrl, { aspect: format.widthIn / format.heightIn }),
      x: 0, y: 0, w: format.widthIn, h: format.heightIn,
    });
  }

  // A box a little wider than its words, so Canva's metrics never rewrap a
  // line the layout set whole, and never off the card.
  const box = (lines: TextItem[]) => {
    const top = Math.min(...lines.map((l) => l.box.y));
    const bottom = Math.max(...lines.map((l) => l.box.y + l.box.h));
    const widest = Math.max(...lines.map((l) => l.box.w));
    const w = Math.min(CARD_UNITS * 0.96, widest * 1.25 + 40);
    const x = lines[0].anchor === 'start'
      ? Math.min(lines[0].x, CARD_UNITS * 0.98 - w)
      : Math.min(Math.max(lines[0].x - w / 2, CARD_UNITS * 0.02), CARD_UNITS * 0.98 - w);
    return { x: x * inch, y: top * inch, w: w * inch, h: (bottom - top) * inch };
  };
  const style = (it: TextItem) => ({
    fontFace: it.family,
    fontSize: Math.round(it.size * pt * 10) / 10,
    color: hex(it.color),
    italic: it.italic,
    bold: it.weight >= 600,
    charSpacing: Math.round(it.spacing * pt * 10) / 10,
    align: (it.anchor === 'start' ? 'left' : 'center') as 'left' | 'center',
    valign: 'top' as const,
    margin: 0,
    fit: 'none' as const,
  });
  const sameStyle = (a: TextItem, b: TextItem) =>
    a.family === b.family && a.size === b.size && a.weight === b.weight && a.italic === b.italic
    && a.color === b.color && a.spacing === b.spacing;

  for (const block of layout.blocks) {
    for (const it of block.items) {
      if (it.kind === 'rule') {
        slide.addShape(pptx.ShapeType.line, {
          x: it.x1 * inch, y: it.y1 * inch, w: (it.x2 - it.x1) * inch, h: 0,
          line: { color: hex(it.color), width: 0.75 },
        });
      } else if (it.kind === 'photo' && job.photoUrl) {
        slide.addImage({
          data: await jpegDataUrl(job.photoUrl, { aspect: it.w / it.h, bw: it.tone === 'bw' }),
          x: it.x * inch, y: it.y * inch, w: it.w * inch, h: it.h * inch,
        });
        if (it.tape) {
          const t = tapeRect(it);
          slide.addShape(pptx.ShapeType.rect, {
            x: t.x * inch, y: t.y * inch, w: t.w * inch, h: t.h * inch, rotate: t.angle,
            fill: { color: hex(TAPE), transparency: 18 }, line: { type: 'none' },
          });
        }
      }
    }
    const texts = block.items.filter((i): i is TextItem => i.kind === 'text');
    if (texts.length === 0) continue;
    // One editable box per block when its lines share a style; a date row, or
    // a block that mixes styles (a script "og" between names in capitals),
    // gets a box per line so each keeps its own.
    if (block.role === 'dateRow' || texts.some((t) => !sameStyle(t, texts[0]))) {
      for (const t of texts) slide.addText(t.text, { ...style(t), ...box([t]), lineSpacingMultiple: 1 });
      continue;
    }
    slide.addText(
      texts.map((t, i) => ({ text: t.text, options: { breakLine: i < texts.length - 1 } })),
      { ...style(texts[0]), ...box(texts), lineSpacingMultiple: texts[0].box.h / texts[0].size },
    );
  }

  await pptx.writeFile({ fileName: `${job.fileName}.pptx` });
}

/** A file name from the couple's names: "invitation-samira-rufus". */
export function cardFileName(content: InviteContent): string {
  const slug = [content.partnerA, content.partnerB].join('-').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `invitation${slug ? `-${slug}` : ''}`;
}
