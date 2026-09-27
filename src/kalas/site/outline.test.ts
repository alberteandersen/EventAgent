import { describe, expect, it } from 'vitest';
import { contentKey, INIT_SECTIONS, parseConfig, type SiteConfig } from './config';
import { CONTENT_STEPS, outlineSummary, sectionStatus, stepSummary } from './outline';

const withOn = (config: SiteConfig, ...ids: string[]): SiteConfig => ({
  ...config,
  sections: config.sections.map((s) => (ids.includes(s.id) ? { ...s, enabled: true } : s)),
});

describe('CONTENT_STEPS', () => {
  it('puts every section in exactly one step', () => {
    const all = CONTENT_STEPS.flatMap((s) => s.sections);
    expect([...all].sort()).toEqual(INIT_SECTIONS.map((s) => s.id).sort());
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('sectionStatus', () => {
  const blank = parseConfig({});

  it('calls a switched-off section off, whatever is in it', () => {
    expect(sectionStatus('transport', blank).state).toBe('off');
    expect(sectionStatus('faq', { ...blank, faq: [] }).state).toBe('off');
  });

  it('treats the hero as always on', () => {
    expect(sectionStatus('hero', blank).state).toBe('ready');
  });

  it('asks for the story and the RSVP deadline until they are there', () => {
    expect(sectionStatus('story', blank)).toEqual({ state: 'todo', note: 'Mangler jeres historie' });
    expect(sectionStatus('story', { ...blank, storyText: '  Vi mødtes i Aarhus.' }).state).toBe('ready');
    expect(sectionStatus('rsvp', blank).note).toBe('Mangler svarfrist');
    expect(sectionStatus('rsvp', { ...blank, rsvpDeadline: '2027-06-01' }).state).toBe('ready');
  });

  it('counts FAQ questions still waiting for an answer', () => {
    const c = withOn(blank, 'faq');
    const s = sectionStatus('faq', c);
    expect(s).toMatchObject({ state: 'todo', n: 3 });
    const answered = { ...c, faq: c.faq.map((f, i) => (i === 0 ? f : { ...f, a: 'Ja' })) };
    expect(sectionStatus('faq', answered)).toMatchObject({ state: 'todo', n: 1, one: 'Ét svar mangler' });
    expect(sectionStatus('faq', { ...c, faq: [] }).note).toBe('Ingen spørgsmål');
  });

  it('flags programme rows missing a time or a name, and ignores empty rows', () => {
    const c = { ...blank, program: [
      { id: 'a', time: '14:00', label: 'Vielse', sublabel: '' },
      { id: 'b', time: '', label: 'Middag', sublabel: '' },
      { id: 'c', time: '', label: '', sublabel: '' },
    ] };
    expect(sectionStatus('program', c)).toMatchObject({ state: 'todo', n: 1 });
    expect(sectionStatus('program', { ...c, program: [c.program[2]] }).note).toBe('Ingen programpunkter');
  });

  it('lets a registry stand in for the gifts text', () => {
    const c = withOn(blank, 'gifts');
    expect(sectionStatus('gifts', c).state).toBe('todo');
    expect(sectionStatus('gifts', c, { hasRegistry: true }).state).toBe('ready');
  });

  it('needs a name and a way to reach the contact', () => {
    const c = withOn(blank, 'contact');
    expect(sectionStatus('contact', c).state).toBe('todo');
    const named = { ...c, contact: { name: 'Sofie', role: 'Toastmaster', phone: '', email: '' } };
    expect(sectionStatus('contact', named).state).toBe('todo');
    expect(sectionStatus('contact', { ...named, contact: { ...named.contact, phone: '20 30 40 50' } }).state).toBe('ready');
  });
});

describe('summaries', () => {
  it('counts sections on and missing per step and overall', () => {
    const c = parseConfig({});
    const welcome = CONTENT_STEPS.find((s) => s.id === 'welcome')!;
    expect(stepSummary(welcome, c)).toEqual({ on: 2, todo: 1 });
    const hub = CONTENT_STEPS.find((s) => s.id === 'hub')!;
    expect(stepSummary(hub, c)).toEqual({ on: 0, todo: 0 });
    // Default site: hero, story, program, rsvp, gallery, photos on;
    // story and rsvp miss something.
    expect(outlineSummary(c)).toEqual({ on: 6, todo: 2 });
  });
});

describe('contentKey', () => {
  it('changes with the words guests would see, and nothing else', () => {
    const c = parseConfig({});
    const key = contentKey(c);
    expect(contentKey(parseConfig({}))).toBe(key);
    expect(contentKey({ ...c, storyText: 'Vi mødtes i Aarhus.' })).not.toBe(key);
    expect(contentKey(withOn(c, 'dresscode'))).not.toBe(key);
    // Settings that are not content leave it alone.
    expect(contentKey({ ...c, pwProtected: true, hideBranding: true })).toBe(key);
    // So do the blocks Kalas draws itself.
    expect(contentKey(withOn(c, 'seat', 'guestbook'))).toBe(key);
  });
});
