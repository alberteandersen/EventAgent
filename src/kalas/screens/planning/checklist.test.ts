import { describe, it, expect } from 'vitest';
import { defaultTimeline as MOCK_TIMELINE } from './defaultTimeline';
import { EN } from '../../strings';
import { DEFAULT_CHECKLIST, PHASES, currentPhase, defaultChecklist, missingChecklistItems, phaseOf } from './checklist-data';
import {
  CHECKLIST_AREAS, kindOf, areaOf, hasArea, nextSort, statusOf,
  PRIORITIES, priorityOf, assigneeName, assigneeInitials,
} from './shared';
import { defaultMilestones } from './milestones';

const AREA_IDS = new Set(CHECKLIST_AREAS.map((a) => a.id));

describe('DEFAULT_CHECKLIST', () => {
  it('holds a usable number of items', () => {
    expect(DEFAULT_CHECKLIST.length).toBeGreaterThanOrEqual(180);
    expect(DEFAULT_CHECKLIST.length).toBeLessThanOrEqual(260);
  });

  it('covers every area with a meaningful block', () => {
    for (const { id } of CHECKLIST_AREAS) {
      const n = DEFAULT_CHECKLIST.filter((c) => c.area === id).length;
      // 'ovrigt' is the catch-all for user/Ava additions — seeded empty.
      if (id === 'ovrigt') expect(n).toBe(0);
      else expect(n, `area "${id}" has only ${n} items`).toBeGreaterThanOrEqual(7);
    }
  });

  it('has no duplicate titles', () => {
    const titles = DEFAULT_CHECKLIST.map((c) => c.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('never restates a milestone title', () => {
    // Duplicate Danish keys are a TS1117 build error in strings.ts, and the
    // two layers must stay conceptually disjoint.
    const milestones = new Set(MOCK_TIMELINE.map((t) => t.title));
    for (const item of DEFAULT_CHECKLIST) {
      expect(milestones.has(item.title), `"${item.title}" collides with a milestone`).toBe(false);
    }
  });

  it('only uses known areas', () => {
    for (const item of DEFAULT_CHECKLIST) expect(AREA_IDS.has(item.area)).toBe(true);
  });

  it('translates every title and area label', () => {
    // TaskRow renders stored titles through t(), so a missing entry shows up
    // as Danish text inside an otherwise English list.
    for (const item of DEFAULT_CHECKLIST) {
      expect(EN[item.title], `"${item.title}" has no English translation`).toBeTruthy();
    }
    for (const { label } of CHECKLIST_AREAS) {
      expect(EN[label], `area label "${label}" has no English translation`).toBeTruthy();
    }
  });

  it('seeds dateless check rows with contiguous sort values', () => {
    const seeded = defaultChecklist();
    expect(seeded).toHaveLength(DEFAULT_CHECKLIST.length);
    seeded.forEach((row, i) => {
      expect(row.kind).toBe('check');
      expect(row.due_date).toBeNull();
      expect(row.done).toBe(false);
      expect(row.sort).toBe(i);
    });
  });
});

describe('missingChecklistItems', () => {
  it('returns nothing when the couple already has the full list', () => {
    const existing = defaultChecklist().map((r) => ({ title: r.title, sort: r.sort }));
    expect(missingChecklistItems(existing)).toEqual([]);
  });

  it('returns only the titles the couple is missing, appended after their rows', () => {
    const existing = defaultChecklist()
      .slice(0, 5)
      .map((r) => ({ title: r.title, sort: r.sort }))
      .concat([{ title: 'Noget vi selv fandt på', sort: 42 }]);
    const missing = missingChecklistItems(existing);

    expect(missing).toHaveLength(DEFAULT_CHECKLIST.length - 5);
    expect(missing.map((r) => r.title)).not.toContain(DEFAULT_CHECKLIST[0].title);
    // Their own item survives — it is simply not part of the defaults.
    expect(missing.map((r) => r.title)).not.toContain('Noget vi selv fandt på');
    expect(missing[0].sort).toBe(43);
    expect(missing.every((r) => r.kind === 'check' && r.due_date === null)).toBe(true);
  });
});

describe('kindOf', () => {
  it('treats anything that is not "check" as a milestone', () => {
    // A client running ahead of migration 0020 sees undefined here.
    expect(kindOf({ kind: 'check' })).toBe('check');
    expect(kindOf({ kind: 'milestone' })).toBe('milestone');
    expect(kindOf({ kind: null })).toBe('milestone');
    expect(kindOf({ kind: undefined })).toBe('milestone');
  });
});

describe('hasArea', () => {
  it('is true only for a real area id', () => {
    expect(hasArea({ category: 'mad' })).toBe(true);
    expect(hasArea({ category: 'ovrigt' })).toBe(true);
  });

  it('keeps the wedding day and uncategorised rows off the checklist', () => {
    expect(hasArea({ category: null })).toBe(false);
    expect(hasArea({ category: 'wedding_day' })).toBe(false);
    // Ava writes free-text categories; those must not pile up under Øvrigt.
    expect(hasArea({ category: 'catering' })).toBe(false);
  });
});

describe('defaultMilestones', () => {
  const seeded = defaultMilestones('2026-09-12');

  it('gives every milestone an area, except the wedding day', () => {
    const weddingDay = seeded.filter((m) => m.category === 'wedding_day');
    expect(weddingDay).toHaveLength(1);
    for (const m of seeded) {
      if (m.category === 'wedding_day') continue;
      expect(hasArea(m), `"${m.title}" has no area`).toBe(true);
    }
  });

  it('stays milestones with dates', () => {
    for (const m of seeded) {
      expect(m.kind).toBe('milestone');
      expect(m.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('areaOf', () => {
  it('maps known categories and falls back to ovrigt', () => {
    expect(areaOf({ category: 'mad' })).toBe('mad');
    expect(areaOf({ category: 'wedding_day' })).toBe('ovrigt');
    expect(areaOf({ category: null })).toBe('ovrigt');
  });
});

describe('nextSort', () => {
  it('appends after the highest existing sort', () => {
    expect(nextSort([])).toBe(0);
    expect(nextSort([{ sort: 0 }, { sort: 4 }, { sort: 2 }])).toBe(5);
  });
});

describe('statusOf', () => {
  it('reports undated instead of pinning a task to the wedding day', () => {
    expect(statusOf({ done: false, dateISO: null, weddingDay: false })).toBe('undated');
    expect(statusOf({ done: true, dateISO: null, weddingDay: false })).toBe('done');
    expect(statusOf({ done: false, dateISO: '2000-01-01', weddingDay: false })).toBe('overdue');
    expect(statusOf({ done: false, dateISO: '2000-01-01', weddingDay: true })).toBe('wedding');
  });
});

describe('task detail', () => {
  const couple = { a: 'Emma', b: 'Frederik' };

  it('reads an unknown or missing priority as none', () => {
    expect(priorityOf({ priority: 'high' })).toBe('high');
    expect(priorityOf({ priority: null })).toBeNull();
    expect(priorityOf({})).toBeNull();
    expect(priorityOf({ priority: 'urgent' as never })).toBeNull();
  });

  it('names who has a task from the couple, not from what was stored', () => {
    expect(assigneeName('a', couple)).toBe('Emma');
    expect(assigneeName('b', couple)).toBe('Frederik');
    expect(assigneeName('both', couple)).toBe('Begge');
    expect(assigneeName(null, couple)).toBeNull();
    // Renamed in Settings: the same stored 'a' follows the new name.
    expect(assigneeName('a', { a: 'Emilie', b: 'Frederik' })).toBe('Emilie');
  });

  it('falls back to a word, never a blank chip, when a name is missing', () => {
    expect(assigneeName('b', { a: 'Emma', b: '' })).toBe('Din partner');
    expect(assigneeInitials('b', { a: 'Emma', b: '' })).toBe('P');
  });

  it('draws both halves of the couple as two letters', () => {
    expect(assigneeInitials('a', couple)).toBe('E');
    expect(assigneeInitials('both', couple)).toBe('EF');
    expect(assigneeInitials(undefined, couple)).toBeNull();
  });

  it('has English for every word the task dialog shows', () => {
    for (const { label } of PRIORITIES) expect(EN[label], label).toBeTruthy();
    for (const word of ['Begge', 'Dig', 'Din partner']) expect(EN[word], word).toBeTruthy();
  });
});

describe('checklist phases', () => {
  it('runs from earliest to latest, with no day left out', () => {
    const starts = PHASES.map((p) => p.minDays);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeLessThan(starts[i - 1]);
    expect(starts.at(-1)).toBe(-Infinity);
  });

  it('places a couple by the days they have left', () => {
    expect(currentPhase(600)).toBe('12-18');
    expect(currentPhase(365)).toBe('12-18');
    expect(currentPhase(351)).toBe('9-12');
    expect(currentPhase(120)).toBe('3-6');
    expect(currentPhase(30)).toBe('maaned');
    expect(currentPhase(7)).toBe('uge');
    expect(currentPhase(0)).toBe('dagen');
    expect(currentPhase(-3)).toBe('efter');
  });

  it('gives every default item a phase, and uses every phase', () => {
    for (const item of DEFAULT_CHECKLIST) expect(phaseOf(item.title), item.title).not.toBeNull();
    const used = new Set(DEFAULT_CHECKLIST.map((i) => i.phase));
    for (const p of PHASES) expect(used.has(p.id), p.id).toBe(true);
  });

  it('has an English label for every phase', () => {
    for (const p of PHASES) expect(EN[p.label], p.label).toBeTruthy();
  });

  it('keeps an item nobody seeded out of it', () => {
    expect(phaseOf('Vores helt egen opgave')).toBeNull();
  });

  it('files the paperwork where the guide does: inside the four months a prøvelsesattest lasts', () => {
    expect(phaseOf('Bestil prøvelsesattest hos kommunen')).toBe('1-3');
    expect(phaseOf('Find og book lokalet')).toBeNull();
  });
});
