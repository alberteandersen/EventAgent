import { describe, expect, it } from 'vitest';
import { ARTICLES, getArticle } from '@/content/guide';
import { NAV } from '../../Shell';
import { GUIDE_ACTION, SCREEN_GUIDE } from './links';

const screens = new Set<string>([...NAV.map((n) => n.id), 'venues', 'vendors']);

describe('guide links in the app', () => {
  it('gives every article a screen to act on', () => {
    for (const a of ARTICLES) {
      const action = GUIDE_ACTION[a.slug];
      expect(action, a.slug).toBeDefined();
      expect(screens.has(action.target), action.target).toBe(true);
    }
  });

  it('only links screens to articles that exist', () => {
    for (const [screen, link] of Object.entries(SCREEN_GUIDE)) {
      expect(screens.has(screen), screen).toBe(true);
      expect(getArticle(link!.slug), link!.slug).toBeDefined();
    }
  });

  it('puts the guide in the menu', () => {
    expect(NAV.some((n) => n.id === 'guides')).toBe(true);
  });
});
