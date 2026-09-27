"use client";

/* Every site Ava has built for the couple, side by side under the preview:
   a live thumbnail of each, what it was (the first build, a change they
   asked for, new words), and which one guests see. Picking one shows it in
   the big preview without changing anything; from there they can make it
   the live one, or ask Ava to change it further. */

import { Check, Eye } from 'lucide-react';
import { cn } from '../../ui';
import { useLang } from '../../i18n';
import type { VersionInfo } from '../../site/versions';

const THUMB_W = 184;
const THUMB_H = 118;
const SITE_W = 1180;

export interface VersionThumb {
  info: VersionInfo;
  /** The version's HTML with today's words and fresh image URLs. */
  html: string;
  fontsHref: string | null;
}

export function versionWhat(info: VersionInfo, t: (s: string, p?: Record<string, string | number>) => string): string {
  switch (info.kind) {
    case 'adjust': return info.words ? `“${info.words}”` : t('En justering');
    case 'text': return t('Ny tekst sat ind');
    case 'build': return info.words ? t('Bygget ud fra “{words}”', { words: info.words }) : t('Bygget af Ava');
    default: return t('Skabelon');
  }
}

export function DesignVersions({ versions, viewingId, published, onView }: {
  versions: VersionThumb[];
  /** The version in the big preview; the live one when null. */
  viewingId: string | null;
  published: boolean;
  onView: (id: string | null) => void;
}) {
  const { t } = useLang();
  if (versions.length === 0) return null;
  const scale = THUMB_W / SITE_W;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="eyebrow">{t('Jeres designs · {n}', { n: versions.length })}</p>
        <p className="text-[0.7rem] text-muted">{t('Tryk på et for at se det. Intet skifter, før I vælger det.')}</p>
      </div>
      <ol className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {versions.map(({ info, html, fontsHref }) => {
          const shown = viewingId ? info.id === viewingId : info.active;
          return (
            <li key={info.id} className="shrink-0" style={{ width: THUMB_W }}>
              <button type="button" onClick={() => onView(info.active ? null : info.id)}
                aria-pressed={shown}
                aria-label={t('Vis version {n}', { n: info.number ?? '' })}
                className={cn('group block w-full text-left cursor-pointer')}>
                <span className={cn(
                  'relative block overflow-hidden rounded-xl bg-card transition-all',
                  shown ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : 'rule group-hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.3)]',
                )} style={{ height: THUMB_H }}>
                  {/* Sandboxed like the big preview; pointer-events off so the
                      whole card is the button. */}
                  <iframe
                    title={t('Version {n}', { n: info.number ?? '' })}
                    sandbox=""
                    loading="lazy"
                    tabIndex={-1}
                    srcDoc={`<!doctype html><html><head>${fontsHref ? `<link rel="stylesheet" href="${fontsHref}">` : ''}<style>html,body{margin:0;padding:0;overflow:hidden}</style></head><body><div id="kalas-site">${html}</div></body></html>`}
                    className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                    style={{ width: SITE_W, height: THUMB_H / scale, transform: `scale(${scale})` }}
                  />
                  {info.active && (
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-canvas">
                      <Check size={8} /> {published ? t('Live') : t('Aktiv')}
                    </span>
                  )}
                  {shown && !info.active && (
                    <span className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-canvas/90 px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-ink">
                      <Eye size={8} /> {t('Vises')}
                    </span>
                  )}
                </span>
                <span className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-[0.76rem] font-medium text-ink">{t('Version {n}', { n: info.number ?? '' })}</span>
                  <span className="shrink-0 text-[0.64rem] text-muted">
                    {new Date(info.createdAt).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })}
                    {' · '}
                    {new Date(info.createdAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[0.7rem] text-muted">{versionWhat(info, t)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
