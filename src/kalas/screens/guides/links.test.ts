import { describe, expect, it } from 'vitest';
import { getArticle } from '@/content/guide';
import { NAV } from '../../Shell';
import { MILESTONE_ACTIONS } from '../planning/shared';
import { SCREEN_GUIDE, guideHref } from './links';

const screens = new Set<string>(NAV.map((n) => n.id));

describe('guide links in the app', () => {
  it('only links screens to articles that exist', () => {
    for (const [screen, link] of Object.entries(SCREEN_GUIDE)) {
      expect(screens.has(screen), screen).toBe(true);
      expect(getArticle(link!.slug), link!.slug).toBeDefined();
    }
  });

  it('only sends a milestone to an article that exists', () => {
    for (const act of Object.values(MILESTONE_ACTIONS)) {
      if (act.kind === 'guide') expect(getArticle(act.slug), act.slug).toBeDefined();
    }
  });

  it('links to the article on the website', () => {
    expect(guideHref('bryllup-tjekliste')).toBe('/guide/bryllup-tjekliste');
  });
});
