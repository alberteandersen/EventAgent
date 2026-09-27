'use client';

/* The card as a guest's phone shows it: a 390×800 screen, scaled into a
   plain phone frame. Ava's build renders in a sandboxed iframe (no script
   can run in it, as with the website preview); before a build, the vibe's
   token card renders directly. */

import type { ComponentProps } from 'react';
import { InviteCard } from './InviteCard';
import { googleFontsHref } from '../site/fonts';
import type { SiteDesign } from '../site/design';
import type { InviteContent } from './content';

const VIEW_W = 390;
const VIEW_H = 800;

export function InvitePreview({ html, htmlFontsHref, design, content, photoUrl, width = 300, title, thanks }: {
  /** Ava's build, aliases already resolved; null shows the token card. */
  html: string | null;
  htmlFontsHref: string | null;
  design: SiteDesign;
  content: InviteContent;
  photoUrl: string | null;
  width?: number;
  title: string;
  /** The thank-you after the day; see InviteCard. */
  thanks?: ComponentProps<typeof InviteCard>['thanks'];
}) {
  const scale = width / VIEW_W;
  return (
    <div
      className="shrink-0 overflow-hidden rounded-[2.4rem] border-[7px] border-[#1d1c1a] bg-[#1d1c1a] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)]"
      style={{ width: width + 14 }}
    >
      <div className="relative overflow-hidden rounded-[1.9rem]" style={{ width, height: VIEW_H * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: VIEW_W, height: VIEW_H, transform: `scale(${scale})` }}>
          {html ? (
            <iframe
              title={title}
              sandbox=""
              srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${htmlFontsHref ? `<link rel="stylesheet" href="${htmlFontsHref}">` : ''}<style>html,body{margin:0;padding:0}</style></head><body><div id="kalas-site">${html}</div></body></html>`}
              className="h-full w-full border-0"
            />
          ) : (
            <>
              <link rel="stylesheet" href={googleFontsHref([design.typography.displayFont, design.typography.bodyFont])} />
              <InviteCard design={design} content={content} photoUrl={photoUrl} thanks={thanks} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
