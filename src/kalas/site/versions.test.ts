import { describe, expect, it } from 'vitest';
import { describeVersions } from './versions';
import type { WebsiteDesignRow } from '@/lib/db/types';

const row = (id: string, patch: Partial<WebsiteDesignRow>): WebsiteDesignRow => ({
  id, event_id: 'e', user_id: 'u', brief: {}, design: {}, html: '<p>x</p>', active: false, created_at: `2027-01-0${id.length}`, ...patch,
});

describe('describeVersions', () => {
  it('names each version by what happened, and numbers the built ones from the oldest', () => {
    const rows = [
      row('text', { brief: { contentSync: true }, active: true }),
      row('adj', { brief: { instruction: 'Mørkere' } }),
      row('b', { brief: { styleDirection: 'Varme farver' } }),
      row('tpl', { html: null, brief: { preset: 'nordisk' } }),
    ];
    expect(describeVersions(rows).map(({ id, kind, words, number, active }) => ({ id, kind, words, number, active }))).toEqual([
      { id: 'text', kind: 'text', words: '', number: 3, active: true },
      { id: 'adj', kind: 'adjust', words: 'Mørkere', number: 2, active: false },
      { id: 'b', kind: 'build', words: 'Varme farver', number: 1, active: false },
      { id: 'tpl', kind: 'template', words: '', number: null, active: false },
    ]);
  });
});
