import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/* The shared look stays shared. Colours come from the palette's tokens
   (globals.css), confirmations from useConfirm, page titles from PageHeader.
   Each rule exists because the app had drifted from it before: a thousand
   raw hex colours, window.confirm in three places, a page title copied into
   eleven screens. */

const SRC = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// The app, and the settings page that is part of it.
const APP = [...files(join(SRC, 'kalas')), ...files(join(SRC, 'components', 'settings'))]
  .map((path) => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

/** Paint in the couple's own colours, not the app's: the public site, the gift
 *  card it embeds, and the invitation card. */
const COUPLE_COLOURS = [
  'kalas/site/',
  'kalas/registry/GiftCard.tsx',
  'kalas/invitations/card/',
  'kalas/invitations/InviteCard.tsx',
  'kalas/invitations/InvitePreview.tsx',
];

function offenders(pattern: RegExp, skip: (path: string) => boolean = () => false) {
  return APP.flatMap(({ path, text }) =>
    skip(path) ? [] : text.split('\n').flatMap((line, i) => (pattern.test(line) ? [`${path}:${i + 1}`] : [])),
  );
}

describe('design guard', () => {
  it('colours the app from the palette, not raw hex', () => {
    const rawHex = /(?:^|[\s'"`:])(?:[a-z]+:)*(?:bg|text|border(?:-[trblxy])?|ring|fill|stroke|from|via|to|decoration|divide|placeholder|outline)-\[#[0-9a-fA-F]{3,8}\]/;
    expect(offenders(rawHex, (p) => COUPLE_COLOURS.some((c) => p.startsWith(c)))).toEqual([]);
  });

  it('asks through the app’s own dialog, not the browser’s', () => {
    // ui/Dialog falls back to window.confirm outside a ConfirmProvider.
    expect(offenders(/window\.(confirm|prompt|alert)\(/, (p) => p === 'kalas/ui/Dialog.tsx')).toEqual([]);
  });

  it('titles pages with PageHeader', () => {
    expect(offenders(/text-\[clamp\(2rem,4vw,2\.4rem\)\]/)).toEqual([]);
  });
});
