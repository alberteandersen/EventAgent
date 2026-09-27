/* The couple's site versions, as they would describe them: Ava's first
   build, a change they asked for, new words poured in, or just a template
   they tried. Every build or change is a row in website_designs, newest
   first; this reads what each one was from its brief. Shared by the
   builder's versions view and Ava's chat tools. */

import type { WebsiteDesignRow } from '@/lib/db/types';

export type VersionKind = 'build' | 'adjust' | 'text' | 'template';

export interface VersionInfo {
  id: string;
  kind: VersionKind;
  /** The couple's own words behind it: their change request or brief. */
  words: string;
  /** 1 for the oldest built version, counting built versions only. */
  number: number | null;
  active: boolean;
  createdAt: string;
}

export function versionKind(row: Pick<WebsiteDesignRow, 'html' | 'brief'>): VersionKind {
  const b = (row.brief ?? {}) as { instruction?: string | null; contentSync?: boolean };
  if (!row.html) return 'template';
  if (b.contentSync) return 'text';
  if (b.instruction) return 'adjust';
  return 'build';
}

/** Newest first, as the rows come; built versions numbered from the oldest. */
export function describeVersions(rows: WebsiteDesignRow[]): VersionInfo[] {
  const built = rows.filter((r) => r.html);
  return rows.map((r) => {
    const b = (r.brief ?? {}) as { instruction?: string | null; styleDirection?: string };
    const kind = versionKind(r);
    const idx = built.indexOf(r);
    return {
      id: r.id,
      kind,
      words: kind === 'adjust' ? b.instruction ?? '' : kind === 'build' ? b.styleDirection ?? '' : '',
      number: idx === -1 ? null : built.length - idx,
      active: r.active,
      createdAt: r.created_at,
    };
  });
}
