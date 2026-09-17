"use client";

/* Overblik: the guest list as the kitchen reads it. Covers, children, who eats
   what, allergies, who stays the night and who is not drinking, and what each
   table needs, with a clean sheet to print or send to the caterer. The counts
   open the list filtered to those guests. */

import { useState } from 'react';
import { motion } from 'motion/react';
import { BedDouble, GlassWater, Printer, Users, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Toggle, cn } from '../../ui';
import { useLang } from '../../i18n';
import { AGE_GROUPS, ageCountLabel } from './household';
import { cateringReport, type GuestNeed } from './catering';
import type { SeatingPlan } from '../seating/model';
import type { GuestRow } from '@/lib/db/types';

function Stat({ icon: Icon, label, value, detail, onClick }: {
  icon: LucideIcon; label: string; value: number; detail?: string; onClick?: () => void;
}) {
  const body = (
    <>
      <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">
        <Icon size={12} aria-hidden /> {label}
      </p>
      <p className="mt-2 font-serif text-[2.2rem] leading-none text-ink tabular-nums">{value}</p>
      {detail && <p className="mt-1.5 text-[0.74rem] text-muted">{detail}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick}
      className="rounded-2xl rule bg-card px-5 py-4 text-left transition-shadow hover:shadow-[0_8px_24px_rgba(36,65,58,0.06)] cursor-pointer">
      {body}
    </button>
  ) : (
    <div className="rounded-2xl rule bg-card px-5 py-4">{body}</div>
  );
}

function Names({ names }: { names: { id: string; name: string }[] }) {
  return <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">{names.map((n) => n.name).join(', ')}</p>;
}

export default function CateringOverview({ guests, plan, title, subtitle, onShowGuests }: {
  guests: GuestRow[];
  plan: SeatingPlan;
  /** "Emma & Frederik", for the printed sheet. */
  title: string;
  subtitle: string;
  onShowGuests: (need: GuestNeed) => void;
}) {
  const { t } = useLang();
  const [includePending, setIncludePending] = useState(false);
  const r = cateringReport(guests, plan, { includePending });
  const ageLine = AGE_GROUPS.filter((a) => r.ages[a.id] > 0).map((a) => t(ageCountLabel(a.id, r.ages[a.id]), { n: r.ages[a.id] })).join(' · ');

  const print = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const list = (names: { name: string }[]) => esc(names.map((n) => n.name).join(', '));
    const section = (heading: string, body: string) => body ? `<h2>${esc(heading)}</h2>${body}` : '';
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t('Til cateringen'))}</title><style>
      * { box-sizing: border-box; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #24413a; padding: 40px; max-width: 760px; margin: 0 auto; }
      h1 { font-weight: 400; font-size: 2rem; margin: 0; }
      .lede { font-family: system-ui, sans-serif; color: #5f6b66; font-size: 0.85rem; margin: 4px 0 24px; }
      .stats { display: flex; gap: 12px; margin-bottom: 8px; }
      .stat { flex: 1; border: 1px solid #dcdfdb; border-radius: 12px; padding: 12px 14px; }
      .stat b { display: block; font-size: 1.8rem; font-weight: 400; }
      .stat span { font-family: system-ui, sans-serif; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #5f6b66; }
      h2 { font-size: 1.1rem; font-weight: 600; margin: 24px 0 8px; border-bottom: 1px solid #dcdfdb; padding-bottom: 4px; }
      .row { display: flex; gap: 12px; font-family: system-ui, sans-serif; font-size: 0.85rem; padding: 4px 0; page-break-inside: avoid; }
      .row .k { width: 170px; flex-shrink: 0; font-weight: 600; }
      .row .v { color: #46574f; }
    </style></head><body>
      <h1>${esc(t('Til cateringen'))}</h1>
      <p class="lede">${esc([title, subtitle].filter(Boolean).join(' · '))}${includePending ? ` · ${esc(t('inkl. gæster uden svar'))}` : ''}</p>
      <div class="stats">
        <div class="stat"><b>${r.counted}</b><span>${esc(t('Kuverter'))}</span></div>
        <div class="stat"><b>${r.withNeeds}</b><span>${esc(t('Kostbehov'))}</span></div>
        <div class="stat"><b>${r.overnight.length}</b><span>${esc(t('Overnatter'))}</span></div>
        <div class="stat"><b>${r.noAlcohol.length}</b><span>${esc(t('Alkoholfri'))}</span></div>
      </div>
      <p class="lede">${esc(ageLine)}</p>
      ${section(t('Kost'), r.diets.map((d) => `<div class="row"><div class="k">${esc(t(d.label))} (${d.guests.length})</div><div class="v">${list(d.guests)}</div></div>`).join(''))}
      ${section(t('Allergier og andet'), r.other.map((o) => `<div class="row"><div class="k">${esc(o.guest.name)}</div><div class="v">${esc(o.text)}</div></div>`).join(''))}
      ${section(t('Pr. bord'), r.tables.map((tb) => `<div class="row"><div class="k">${esc(tb.name)} (${tb.seated})</div><div class="v">${esc([...tb.diets.map((d) => `${d.count} ${t(d.label).toLowerCase()}`), ...tb.other].join(' · ') || '–')}</div></div>`).join(''))}
      ${section(t('Alkoholfri'), r.noAlcohol.length ? `<div class="row"><div class="v">${list(r.noAlcohol)}</div></div>` : '')}
      ${section(t('Overnatter'), r.overnight.length ? `<div class="row"><div class="v">${list(r.overnight)}</div></div>` : '')}
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-lg text-[0.85rem] text-muted">
          {t('Det cateringen og stedet skal bruge, talt op fra gæstelisten. Tryk på et tal for at se gæsterne.')}
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[0.8rem] text-ink-soft">
            <Toggle value={includePending} onChange={setIncludePending} />
            {t('Medregn dem uden svar ({n})', { n: r.pending })}
          </label>
          <button type="button" onClick={print}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[0.78rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer">
            <Printer size={14} /> {t('Print til catering')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label={t('Kuverter')} value={r.counted} detail={ageLine || undefined} />
        <Stat icon={Utensils} label={t('Kostbehov')} value={r.withNeeds} onClick={() => onShowGuests('diet')} />
        <Stat icon={BedDouble} label={t('Overnatter')} value={r.overnight.length} onClick={() => onShowGuests('overnight')} />
        <Stat icon={GlassWater} label={t('Alkoholfri')} value={r.noAlcohol.length} onClick={() => onShowGuests('noAlcohol')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <p className="eyebrow">{t('Kost')}</p>
          {r.diets.length === 0 ? (
            <p className="mt-3 rounded-2xl rule bg-card px-5 py-4 text-[0.82rem] text-muted">{t('Ingen har kostbehov endnu.')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl rule bg-card">
              {r.diets.map((d) => (
                <li key={d.id} className="px-5 py-3.5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-[1.05rem] text-ink">{t(d.label)}</span>
                    <span className="text-[0.95rem] font-semibold text-ink tabular-nums">{d.guests.length}</span>
                  </p>
                  <Names names={d.guests} />
                </li>
              ))}
            </ul>
          )}

          {r.other.length > 0 && (
            <>
              <p className="eyebrow mt-6">{t('Allergier og andet')}</p>
              <ul className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl rule bg-card">
                {r.other.map((o) => (
                  <li key={o.guest.id} className="flex gap-3 px-5 py-3 text-[0.82rem]">
                    <span className="w-36 shrink-0 font-medium text-ink">{o.guest.name}</span>
                    <span className="text-muted">{o.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section>
          <p className="eyebrow">{t('Pr. bord')}</p>
          {r.tables.length === 0 ? (
            <p className="mt-3 rounded-2xl rule bg-card px-5 py-4 text-[0.82rem] text-muted">
              {t('Når gæsterne har en plads på bordplanen, står det her, hvad hvert bord skal have.')}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl rule bg-card">
              {r.tables.map((tb) => (
                <li key={tb.id} className="px-5 py-3.5">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="font-serif text-[1.05rem] text-ink">{tb.name}</span>
                    <span className="text-[0.78rem] text-muted">{t('{n} kuverter', { n: tb.seated })}</span>
                  </p>
                  {tb.diets.length > 0 || tb.other.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {tb.diets.map((d) => (
                        <span key={d.label} className="rounded-full bg-[var(--color-sage-tint)] px-2.5 py-0.5 text-[0.72rem] text-sage-strong">
                          {d.count} {t(d.label).toLowerCase()}
                        </span>
                      ))}
                      {tb.other.map((o) => (
                        <span key={o} className={cn('rounded-full bg-[var(--color-terracotta-tint)] px-2.5 py-0.5 text-[0.72rem] text-[var(--color-terracotta)]')}>{o}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[0.76rem] text-muted">{t('Ingen særlige behov')}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {(r.overnight.length > 0 || r.noAlcohol.length > 0) && (
            <ul className="mt-6 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl rule bg-card">
              {r.overnight.length > 0 && (
                <li className="px-5 py-3.5">
                  <p className="flex items-center gap-1.5 font-serif text-[1.05rem] text-ink"><BedDouble size={14} className="text-sage" /> {t('Overnatter')}</p>
                  <Names names={r.overnight} />
                </li>
              )}
              {r.noAlcohol.length > 0 && (
                <li className="px-5 py-3.5">
                  <p className="flex items-center gap-1.5 font-serif text-[1.05rem] text-ink"><GlassWater size={14} className="text-sage" /> {t('Alkoholfri')}</p>
                  <Names names={r.noAlcohol} />
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
    </motion.div>
  );
}
