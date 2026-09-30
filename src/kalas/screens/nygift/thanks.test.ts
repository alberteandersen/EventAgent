import { describe, it, expect } from 'vitest';
import { buildThankList, thankProgress } from './thanks';
import type { GuestRow, RegistryClaimRow, RegistryItemRow, ThankYouRow } from '@/lib/db/types';

type G = Pick<GuestRow, 'id' | 'name' | 'email' | 'rsvp' | 'rsvp_token'>;
type C = Pick<RegistryClaimRow, 'id' | 'item_id' | 'guest_name' | 'guest_email' | 'message' | 'quantity'>;
type I = Pick<RegistryItemRow, 'id' | 'title'>;
type O = Pick<ThankYouRow, 'subject_key' | 'label' | 'gift' | 'thanked_at' | 'method' | 'note'>;

const guest = (id: string, name: string, rsvp: GuestRow['rsvp'] = 'ja', email: string | null = null): G =>
  ({ id, name, email, rsvp, rsvp_token: `tok-${id}` });

const claim = (id: string, guest_name: string, item_id = 'i1', over: Partial<C> = {}): C =>
  ({ id, item_id, guest_name, guest_email: null, message: null, quantity: 1, ...over });

const items: I[] = [{ id: 'i1', title: 'Stelton kande' }, { id: 'i2', title: 'Dyner' }];

const overlay = (subject_key: string, over: Partial<O> = {}): O =>
  ({ subject_key, label: 'Ukendt', gift: null, thanked_at: null, method: null, note: null, ...over });

describe('buildThankList', () => {
  it('lists everyone who attended, gift or not', () => {
    const list = buildThankList([guest('g1', 'Anna'), guest('g2', 'Bo')], [], items, []);
    expect(list.map((e) => e.name)).toEqual(['Anna', 'Bo']);
    expect(list.every((e) => e.attended)).toBe(true);
  });

  it('leaves out guests who declined or have not answered', () => {
    const list = buildThankList(
      [guest('g1', 'Anna'), guest('g2', 'Bo', 'nej'), guest('g3', 'Cecilie', 'afventer')],
      [], items, []
    );
    expect(list.map((e) => e.name)).toEqual(['Anna']);
  });

  it('merges a gift into the matching guest rather than duplicating the person', () => {
    const list = buildThankList([guest('g1', 'Anna')], [claim('c1', 'Anna')], items, []);
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('guest:g1');
    expect(list[0].gift).toBe('Stelton kande');
  });

  it('matches on email before name', () => {
    const guests = [guest('g1', 'Anna Hansen', 'ja', 'anna@example.com')];
    const list = buildThankList(
      guests,
      [claim('c1', 'A. Hansen', 'i1', { guest_email: 'ANNA@example.com' })],
      items, []
    );
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('guest:g1');
  });

  it('combines several gifts from the same person onto one line', () => {
    const list = buildThankList(
      [guest('g1', 'Anna')],
      [claim('c1', 'Anna'), claim('c2', 'Anna', 'i2', { quantity: 2 })],
      items, []
    );
    expect(list).toHaveLength(1);
    expect(list[0].gift).toBe('Stelton kande, Dyner × 2');
  });

  it('gives an unmatched gift-giver their own entry', () => {
    const list = buildThankList([guest('g1', 'Anna')], [claim('c1', 'Fars kollega')], items, []);
    expect(list.map((e) => e.key).sort()).toEqual(['claim:c1', 'guest:g1']);
  });

  it('includes a guest who sent a gift but did not attend', () => {
    const list = buildThankList([guest('g1', 'Bo', 'nej')], [claim('c1', 'Bo')], items, []);
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('guest:g1');
    expect(list[0].attended).toBe(false);
    expect(list[0].gift).toBe('Stelton kande');
  });

  it('keeps the gift message the guest wrote', () => {
    const list = buildThankList([], [claim('c1', 'Bo', 'i1', { message: 'Tillykke!' })], items, []);
    expect(list[0].message).toBe('Tillykke!');
  });

  it('applies the couple annotations onto a derived entry', () => {
    const list = buildThankList(
      [guest('g1', 'Anna')], [], items,
      [overlay('guest:g1', { thanked_at: '2026-09-20T10:00:00Z', method: 'kort', note: 'sendt med posten' })]
    );
    expect(list[0].thankedAt).toBe('2026-09-20T10:00:00Z');
    expect(list[0].method).toBe('kort');
    expect(list[0].note).toBe('sendt med posten');
  });

  it('keeps an annotated entry alive after the guest row is deleted', () => {
    const list = buildThankList(
      [], [], items,
      [overlay('guest:gone', { label: 'Mormor', gift: 'Kagefad', thanked_at: '2026-09-20T10:00:00Z' })]
    );
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Mormor');
    expect(list[0].gift).toBe('Kagefad');
  });

  it('revives manually added people', () => {
    const list = buildThankList([], [], items, [overlay('manual:m1', { label: 'Nabo Jens' })]);
    expect(list.map((e) => e.name)).toEqual(['Nabo Jens']);
  });

  it('sorts un-thanked first, then gift-givers, then Danish alphabetical', () => {
    const list = buildThankList(
      [guest('g1', 'Åse'), guest('g2', 'Bo'), guest('g3', 'Anna'), guest('g4', 'Zara')],
      [claim('c1', 'Bo')],
      items,
      [overlay('guest:g3', { thanked_at: '2026-09-20T10:00:00Z' })]
    );
    // Bo has a gift → first. Zara and Åse un-thanked, æ/ø/å sort last in Danish.
    // Anna is already thanked → last.
    expect(list.map((e) => e.name)).toEqual(['Bo', 'Zara', 'Åse', 'Anna']);
  });

  it('falls back to a generic gift label when the item is gone', () => {
    const list = buildThankList([], [claim('c1', 'Bo', 'deleted-item')], items, []);
    expect(list[0].gift).toBe('Gave');
  });
});

describe('thankProgress', () => {
  it('counts only annotated-as-thanked entries', () => {
    const list = buildThankList(
      [guest('g1', 'Anna'), guest('g2', 'Bo')], [], items,
      [overlay('guest:g1', { thanked_at: '2026-09-20T10:00:00Z' })]
    );
    expect(thankProgress(list)).toEqual({ done: 1, total: 2 });
  });

  it('handles an empty list', () => {
    expect(thankProgress([])).toEqual({ done: 0, total: 0 });
  });
});
