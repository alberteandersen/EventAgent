import { describe, expect, it } from 'vitest';
import { parseConfig, type SiteConfig } from '@/kalas/site/config';
import { buildStamp, fillSlots, needsRebuild, slotKeysIn, structureKey } from './slots';

const base = (): SiteConfig => ({
  ...parseConfig({}),
  storyText: 'Vi mødtes i Aarhus.',
  rsvpDeadline: '2027-06-01',
  program: [{ id: 'e1', time: '14:00', label: 'Vielse', sublabel: 'Kapellet' }],
  faq: [{ id: 'f1', q: 'Parkering?', a: 'Ja, ved slottet.' }],
});

const HTML = [
  '<section><h1>Emma &amp; Frederik</h1><p class="t" data-kalas="text:heroTagline">Kom og fejr dagen med os</p></section>',
  '<section><p data-kalas="text:storyText" style="white-space:pre-line">Vi mødtes i Aarhus.</p></section>',
  '<ol><li><time data-kalas="text:program:e1:time">14:00</time> <span data-kalas="text:program:e1:label">Vielse</span>',
  '<small data-kalas="text:program:e1:sublabel">Kapellet</small></li></ol>',
  '<dl><dt data-kalas="text:faq:f1:q">Parkering?</dt><dd data-kalas="text:faq:f1:a">Ja, ved slottet.</dd></dl>',
].join('');

describe('fillSlots', () => {
  it('pours the current words into their slots and leaves the rest alone', () => {
    const c = { ...base(), storyText: 'Vi mødtes på en bænk.\nResten er historie.', program: [{ id: 'e1', time: '14:30', label: 'Vielse', sublabel: 'Kapellet' }] };
    const out = fillSlots(HTML, c);
    expect(out).toContain('style="white-space:pre-line">Vi mødtes på en bænk.\nResten er historie.</p>');
    expect(out).toContain('<time data-kalas="text:program:e1:time">14:30</time>');
    expect(out).toContain('<h1>Emma &amp; Frederik</h1>');
  });

  it('escapes what the couple typed', () => {
    const out = fillSlots(HTML, { ...base(), storyText: '<img src=x onerror=alert(1)> & "os"' });
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;os&quot;');
    expect(out).not.toContain('<img');
  });

  it('keeps a slot whose row is gone, and one with markup inside', () => {
    const html = '<span data-kalas="text:faq:gone:q">Gammelt</span><p data-kalas="text:storyText"><em>Os</em></p>';
    expect(fillSlots(html, base())).toBe(html);
  });

  it('lists the slots a build carries', () => {
    expect([...slotKeysIn(HTML)].sort()).toEqual([
      'faq:f1:a', 'faq:f1:q', 'heroTagline', 'program:e1:label', 'program:e1:sublabel', 'program:e1:time', 'storyText',
    ]);
  });
});

describe('structureKey', () => {
  it('ignores rewording and notices new rows, sections and dates', () => {
    const c = base();
    const key = structureKey(c);
    expect(structureKey({ ...c, storyText: 'Noget andet', faq: [{ id: 'f1', q: 'Hvor?', a: 'Her' }] })).toBe(key);
    expect(structureKey({ ...c, faq: [...c.faq, { id: 'f2', q: 'Børn?', a: '' }] })).not.toBe(key);
    expect(structureKey({ ...c, rsvpDeadline: '2027-07-01' })).not.toBe(key);
    expect(structureKey({ ...c, sections: c.sections.map((s) => (s.id === 'dresscode' ? { ...s, enabled: true } : s)) })).not.toBe(key);
  });
});

describe('needsRebuild', () => {
  it('says nothing for a build that recorded nothing', () => {
    expect(needsRebuild(HTML, null, { ...base(), storyText: 'Nyt' })).toBe(false);
  });

  it('treats any change as stale for a build without slots', () => {
    const stamp = { contentKey: buildStamp(base()).contentKey };
    expect(needsRebuild(HTML, stamp, base())).toBe(false);
    expect(needsRebuild(HTML, stamp, { ...base(), storyText: 'Nyt' })).toBe(true);
  });

  it('lets slots carry a rewording, but not a new row', () => {
    const stamp = buildStamp(base());
    expect(needsRebuild(HTML, stamp, { ...base(), storyText: 'Nyt', faq: [{ id: 'f1', q: 'P?', a: 'Nej' }] })).toBe(false);
    expect(needsRebuild(HTML, stamp, { ...base(), faq: [...base().faq, { id: 'f2', q: 'Børn?', a: 'Ja' }] })).toBe(true);
  });

  it('asks for Ava when a text that shows has no slot to go in', () => {
    const noStory = HTML.replace(/<p data-kalas="text:storyText"[^<]*<\/p>/, '<p>Vi mødtes i Aarhus.</p>');
    const stamp = buildStamp(base());
    expect(needsRebuild(noStory, stamp, { ...base(), storyText: 'Nyt' })).toBe(true);
    // The dresscode section is off, so its text going nowhere is fine.
    expect(needsRebuild(HTML, stamp, { ...base(), storyText: 'Nyt', dresscode: 'Festligt' })).toBe(false);
  });
});
