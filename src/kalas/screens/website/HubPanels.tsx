"use client";

/* The guest hub's side of the website builder: an overview of how the site is
   doing, real QR codes, the guest contact, the seat finder's reach, and the
   guestbook's messages. Kept out of Website.tsx, which is long enough, and
   each panel reads what it needs from the wedding itself. */

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Eye, EyeOff, Globe, Loader2, Printer, Users } from 'lucide-react';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import { readPlan, seatedIds } from '../seating/model';
import { createClient } from '@/lib/supabase/client';
import type { GuestContact } from '../../site/config';
import type { GuestbookEntryRow } from '@/lib/db/types';

const fieldCls =
  'w-full rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.85rem] text-ink placeholder:text-muted/60 focus:outline-none';

/* ── Overview ─────────────────────────────────────────────────────────── */

export function SiteOverview({ published, onTogglePublished, previewHref }: {
  published: boolean;
  onTogglePublished: () => void;
  previewHref: string;
}) {
  const { t } = useLang();
  const { weddingSite, guests } = useWedding();
  const views = weddingSite?.view_count ?? 0;
  const answered = guests.filter((g) => g.responded_at).length;

  return (
    <section className="rule rounded-2xl bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-[1.35rem] leading-tight text-ink">
            {published ? t('Siden er live') : t('Kladde')}
          </p>
          <p className="mt-1 text-[0.8rem] text-muted">
            {published
              ? t('Gæster med linket kan se siden, svare og finde deres plads.')
              : t('Kun I kan se den. Udgiv, når I er klar til at sende linket.')}
          </p>
        </div>
        <span className={cn(
          'shrink-0 rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.14em]',
          published ? 'bg-sage-tint text-sage-strong' : 'bg-shell text-muted',
        )}>
          {published ? t('Live') : t('Kladde')}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-shell px-4 py-3">
          <p className="font-serif text-[1.6rem] leading-none text-ink tabular-nums">{views}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-muted"><Eye size={12} /> {t('Sidevisninger')}</p>
        </div>
        <div className="rounded-xl bg-shell px-4 py-3">
          <p className="font-serif text-[1.6rem] leading-none text-ink tabular-nums">{answered}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[0.72rem] text-muted"><Users size={12} /> {t('RSVP-svar')}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={previewHref} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-[0.78rem] font-semibold text-ink transition-colors hover:border-ink">
          <Eye size={13} /> {t('Forhåndsvis')}
        </a>
        <button type="button" onClick={onTogglePublished}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.78rem] font-semibold transition-colors cursor-pointer',
            published ? 'bg-shell text-ink hover:bg-line' : 'bg-ink text-canvas hover:bg-ink/85',
          )}>
          <Globe size={13} /> {published ? t('Gør privat igen') : t('Udgiv nu')}
        </button>
      </div>
    </section>
  );
}

/* ── QR codes ─────────────────────────────────────────────────────────── */

/** A real, scannable QR code for `url`, and a sheet to print it on. */
export function QrBlock({ url, caption, size = 96, printable = true }: {
  url: string;
  caption: string;
  size?: number;
  /** A code meant for a screen, not a table card, has nothing to print. */
  printable?: boolean;
}) {
  const { t } = useLang();
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#24413a', light: '#ffffff' } })
      .then((s) => { if (alive) setSvg(s); })
      .catch(() => { if (alive) setSvg(null); });
    return () => { alive = false; };
  }, [url]);

  const print = () => {
    if (!svg) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(caption)}</title><style>
      body { font-family: Georgia, serif; color: #24413a; display: flex; min-height: 90vh; align-items: center; justify-content: center; margin: 0; }
      .card { text-align: center; border: 1px solid #dcdfdb; border-radius: 24px; padding: 40px 48px; }
      .qr svg { width: 260px; height: 260px; }
      h1 { font-weight: 400; font-size: 1.8rem; margin: 20px 0 6px; }
      p { font-family: system-ui, sans-serif; font-size: 0.8rem; color: #5f6b66; margin: 0; }
    </style></head><body><div class="card"><div class="qr">${svg}</div><h1>${esc(caption)}</h1><p>${esc(url.replace(/^https?:\/\//, ''))}</p></div></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        className="rule rounded-xl bg-white p-2"
        style={{ width: size, height: size }}
        aria-label={t('QR-kode til {url}', { url })}
        role="img"
        // Generated locally from the URL by the qrcode library, never from input markup.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      {printable && (
        <button type="button" onClick={print} disabled={!svg}
          className="inline-flex items-center gap-1 text-[0.68rem] text-muted transition-colors hover:text-ink disabled:opacity-40 cursor-pointer">
          <Printer size={11} /> {t('Print')}
        </button>
      )}
    </div>
  );
}

/* ── Guest contact ────────────────────────────────────────────────────── */

export function ContactEditor({ value, onChange }: { value: GuestContact; onChange: (v: GuestContact) => void }) {
  const { t } = useLang();
  const set = (k: keyof GuestContact) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="space-y-2">
      <p className="text-[0.8rem] text-muted">
        {t('Én person gæsterne kan ringe til på dagen, fx toastmasteren, så I ikke selv skal tage telefonen.')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={value.name} onChange={set('name')} placeholder={t('Navn')} aria-label={t('Navn')} className={fieldCls} />
        <input value={value.role} onChange={set('role')} placeholder={t('Rolle, fx toastmaster')} aria-label={t('Rolle')} className={fieldCls} />
        <input value={value.phone} onChange={set('phone')} type="tel" placeholder="+45 12 34 56 78" aria-label={t('Telefon')} className={fieldCls} />
        <input value={value.email} onChange={set('email')} type="email" placeholder={t('E-mail')} aria-label={t('E-mail')} className={fieldCls} />
      </div>
    </div>
  );
}

/* ── Find my seat ─────────────────────────────────────────────────────── */

export function SeatFinderInfo() {
  const { t } = useLang();
  const { guests, seatingPlan } = useWedding();
  const seated = useMemo(() => {
    const ids = seatedIds(readPlan(seatingPlan?.data));
    return guests.filter((g) => ids.has(g.id)).length;
  }, [guests, seatingPlan]);

  return (
    <div className="space-y-2">
      <p className="text-[0.84rem] leading-relaxed text-muted">
        {t('Gæsterne skriver deres navn og får deres bord at vide. De ser kun deres eget bord, aldrig hvem der ellers sidder der.')}
      </p>
      <p className="rule rounded-xl bg-shell px-4 py-3 text-[0.8rem] text-ink">
        {guests.length === 0
          ? t('Tilføj gæster og lav en bordplan først.')
          : t('{n} af {total} gæster har en plads på bordplanen.', { n: seated, total: guests.length })}
      </p>
    </div>
  );
}

/* ── Guestbook ────────────────────────────────────────────────────────── */

type Entry = Pick<GuestbookEntryRow, 'id' | 'name' | 'message' | 'hidden' | 'created_at'>;

export function GuestbookModeration() {
  const { t } = useLang();
  const { event } = useWedding();
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const eventId = event?.id ?? null;

  useEffect(() => {
    if (!eventId) return;
    let alive = true;
    void supabase
      .from('guestbook_entries')
      .select('id, name, message, hidden, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (alive) setEntries((data as Entry[] | null) ?? []); });
    return () => { alive = false; };
  }, [supabase, eventId]);

  const toggle = async (entry: Entry) => {
    setEntries((list) => list?.map((e) => (e.id === entry.id ? { ...e, hidden: !e.hidden } : e)) ?? null);
    await supabase.from('guestbook_entries').update({ hidden: !entry.hidden }).eq('id', entry.id);
  };

  return (
    <div className="space-y-3">
      <p className="text-[0.84rem] leading-relaxed text-muted">
        {t('Gæsterne kan skrive en hilsen på siden. Skjul en, så forsvinder den fra siden, men I kan altid vise den igen.')}
      </p>
      {entries === null ? (
        <p className="flex items-center gap-2 text-[0.8rem] text-muted"><Loader2 size={13} className="animate-spin" /> {t('Henter hilsner…')}</p>
      ) : entries.length === 0 ? (
        <p className="rule rounded-xl bg-shell px-4 py-3 text-[0.8rem] text-muted">{t('Ingen hilsner endnu.')}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className={cn('flex items-start gap-3 rule rounded-xl bg-shell px-4 py-3', e.hidden && 'opacity-50')}>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line text-[0.85rem] text-ink">{e.message}</p>
                <p className="mt-1 text-[0.7rem] text-muted">{e.name}</p>
              </div>
              <button type="button" onClick={() => void toggle(e)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] text-muted transition-colors hover:bg-card hover:text-ink cursor-pointer">
                {e.hidden ? <><Eye size={12} /> {t('Vis')}</> : <><EyeOff size={12} /> {t('Skjul')}</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
