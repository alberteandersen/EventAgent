"use client";

/* Overblik: the guest list as the kitchen reads it. Covers, children, who eats
   what, allergies, who stays the night and who is not drinking, and what each
   table needs, with a clean sheet to print or send to the caterer. The counts
   open the list filtered to those guests. */

import { useState } from 'react';
import { motion } from 'motion/react';
import { Baby, BedDouble, ChefHat, Clock, GlassWater, Printer, ShieldAlert, Users, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Toggle, cn } from '../../ui';
import { useLang } from '../../i18n';
import { AGE_GROUPS, ageCountLabel } from './household';
import { cateringReport, type GuestNeed } from './catering';
import type { SeatingPlan } from '../seating/model';
import type { GuestRow } from '@/lib/db/types';

function Stat({ icon: Icon, label, value, detail, tone, onClick }: {
  icon: LucideIcon; label: string; value: number; detail?: string;
  /** Terracotta for the one number a kitchen must never get wrong. */
  tone?: 'alert';
  onClick?: () => void;
}) {
  const alert = tone === 'alert' && value > 0;
  const cls = cn(
    'flex flex-col items-start justify-start rounded-2xl rule px-5 py-4 text-left',
    alert ? 'bg-terracotta-tint' : 'bg-card',
  );
  const body = (
    <>
      <p className={cn('flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.16em]', alert ? 'text-terracotta' : 'text-muted')}>
        <Icon size={12} aria-hidden /> {label}
      </p>
      <p className={cn('mt-2 font-serif text-[2.2rem] leading-none tabular-nums', alert ? 'text-terracotta' : 'text-ink')}>{value}</p>
      <p className="mt-1.5 min-h-[1.1rem] text-[0.74rem] text-muted">{detail ?? ''}</p>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick}
      className={cn(cls, 'transition-shadow hover:shadow-[0_8px_24px_rgba(36,65,58,0.06)] cursor-pointer')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Card({ title, icon: Icon, children, tone }: { title: string; icon?: LucideIcon; children: React.ReactNode; tone?: 'alert' }) {
  return (
    <section>
      <p className={cn('eyebrow flex items-center gap-1.5', tone === 'alert' && 'text-terracotta')}>
        {Icon && <Icon size={12} aria-hidden />} {title}
      </p>
      <div className="mt-3 overflow-hidden rounded-2xl rule bg-card">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-4 text-[0.82rem] text-muted">{children}</p>;
}

function CountRow({ label, names }: { label: string; names: { id: string; name: string }[] }) {
  return (
    <li className="px-5 py-3.5">
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-[1.05rem] text-ink">{label}</span>
        <span className="text-[0.95rem] font-semibold text-ink tabular-nums">{names.length}</span>
      </p>
      <Names names={names} />
    </li>
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
  onShowGuests: (need: GuestNeed | 'pending') => void;
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
        <div class="stat"><b>${r.withAllergies}</b><span>${esc(t('Allergier'))}</span></div>
        <div class="stat"><b>${r.withDiets}</b><span>${esc(t('Særlig kost'))}</span></div>
        <div class="stat"><b>${r.noAlcohol.length}</b><span>${esc(t('Alkoholfri'))}</span></div>
      </div>
      <p class="lede">${esc(ageLine)}${r.ages.baby > 0 ? ` · ${esc(t('{n} høje stole', { n: r.ages.baby }))}` : ''}</p>
      ${section(t('Allergier og intolerancer'), [
        ...r.allergies.map((d) => `<div class="row"><div class="k">${esc(t(d.label))} (${d.guests.length})</div><div class="v">${list(d.guests)}</div></div>`),
        ...r.other.map((o) => `<div class="row"><div class="k">${esc(o.guest.name)}</div><div class="v">${esc(o.text)}</div></div>`),
      ].join(''))}
      ${section(t('Særlig kost'), r.diets.map((d) => `<div class="row"><div class="k">${esc(t(d.label))} (${d.guests.length})</div><div class="v">${list(d.guests)}</div></div>`).join(''))}
      ${section(t('Menuvalg'), r.meals.map((m) => `<div class="row"><div class="k">${esc(m.label)} (${m.guests.length})</div><div class="v">${list(m.guests)}</div></div>`).join(''))}
      ${section(t('Pr. bord'), r.tables.map((tb) => `<div class="row"><div class="k">${esc(tb.name)} (${tb.seated})</div><div class="v">${esc([...tb.allergies, ...tb.diets].map((d) => `${d.count} ${t(d.label).toLowerCase()}`).concat(tb.other).join(' · ') || '–')}</div></div>`).join(''))}
      ${section(t('Børn'), r.children.map((c) => `<div class="row"><div class="k">${esc(c.name)}</div><div class="v">${esc(t(c.age === 'baby' ? 'Baby, høj stol' : 'Barn'))}</div></div>`).join(''))}
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
            <Toggle value={includePending} onChange={setIncludePending} label={t('Medregn dem uden svar ({n})', { n: r.pending })} />
            {t('Medregn dem uden svar ({n})', { n: r.pending })}
          </label>
          <button type="button" onClick={print}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[0.78rem] font-semibold text-canvas transition-opacity hover:opacity-90 cursor-pointer">
            <Printer size={14} /> {t('Print til catering')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat icon={Users} label={t('Kuverter')} value={r.counted} detail={ageLine || undefined} />
        <Stat icon={ShieldAlert} label={t('Allergier')} value={r.withAllergies} tone="alert"
          detail={r.withAllergies > 0 ? t('Skal med til køkkenet') : undefined} onClick={() => onShowGuests('allergy')} />
        <Stat icon={Utensils} label={t('Særlig kost')} value={r.withDiets}
          detail={r.diets.map((d) => `${d.guests.length} ${t(d.label).toLowerCase()}`).join(' · ') || undefined} onClick={() => onShowGuests('diet')} />
        <Stat icon={GlassWater} label={t('Alkoholfri')} value={r.noAlcohol.length} onClick={() => onShowGuests('noAlcohol')} />
        <Stat icon={BedDouble} label={t('Overnatter')} value={r.overnight.length}
          detail={r.overnight.length > 0 ? t('Morgenmad til {n}', { n: r.overnight.length }) : undefined} onClick={() => onShowGuests('overnight')} />
        <Stat icon={Clock} label={t('Mangler svar')} value={r.pending}
          detail={r.pending > 0 && !includePending ? t('Ikke talt med endnu') : undefined} onClick={() => onShowGuests('pending')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title={t('Allergier og intolerancer')} icon={ShieldAlert} tone={r.allergies.length + r.other.length > 0 ? 'alert' : undefined}>
            {r.allergies.length === 0 && r.other.length === 0 ? (
              <Empty>{t('Ingen allergier på listen.')}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {r.allergies.map((d) => <CountRow key={d.id} label={t(d.label)} names={d.guests} />)}
                {r.other.map((o) => (
                  <li key={o.guest.id} className="flex gap-3 px-5 py-3 text-[0.82rem]">
                    <span className="w-36 shrink-0 font-medium text-ink">{o.guest.name}</span>
                    <span className="text-muted">{o.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={t('Særlig kost')} icon={Utensils}>
            {r.diets.length === 0 ? (
              <Empty>{t('Ingen har valgt en særlig kost.')}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {r.diets.map((d) => <CountRow key={d.id} label={t(d.label)} names={d.guests} />)}
              </ul>
            )}
          </Card>

          {r.meals.length > 0 && (
            <Card title={t('Menuvalg')} icon={ChefHat}>
              <ul className="divide-y divide-line">
                {r.meals.map((m) => <CountRow key={m.label} label={m.label} names={m.guests} />)}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title={t('Pr. bord')}>
            {r.tables.length === 0 ? (
              <Empty>{t('Når gæsterne har en plads på bordplanen, står det her, hvad hvert bord skal have.')}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {r.tables.map((tb) => (
                  <li key={tb.id} className="px-5 py-3.5">
                    <p className="flex items-baseline justify-between gap-3">
                      <span className="font-serif text-[1.05rem] text-ink">{tb.name}</span>
                      <span className="text-[0.78rem] text-muted">{t('{n} kuverter', { n: tb.seated })}</span>
                    </p>
                    {tb.allergies.length + tb.diets.length + tb.other.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[...tb.allergies.map((d) => ({ ...d, alert: true })), ...tb.diets.map((d) => ({ ...d, alert: false }))].map((d) => (
                          <span key={d.label} className={cn('rounded-full px-2.5 py-0.5 text-[0.72rem]',
                            d.alert ? 'bg-terracotta-tint text-terracotta' : 'bg-sage-tint text-sage-strong')}>
                            {d.count} {t(d.label).toLowerCase()}
                          </span>
                        ))}
                        {tb.other.map((o) => (
                          <span key={o} className="rounded-full bg-terracotta-tint px-2.5 py-0.5 text-[0.72rem] text-terracotta">{o}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[0.76rem] text-muted">{t('Ingen særlige behov')}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {r.children.length > 0 && (
            <Card title={t('Børn')} icon={Baby}>
              <ul className="divide-y divide-line">
                {r.children.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-[0.85rem]">
                    <span className="text-ink">{c.name}</span>
                    <span className="text-[0.76rem] text-muted">{t(c.age === 'baby' ? 'Baby, høj stol' : 'Barn')}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {(r.overnight.length > 0 || r.noAlcohol.length > 0) && (
            <Card title={t('Drikkevarer og overnatning')}>
              <ul className="divide-y divide-line">
                {r.noAlcohol.length > 0 && <CountRow label={t('Alkoholfri')} names={r.noAlcohol} />}
                {r.overnight.length > 0 && <CountRow label={t('Overnatter')} names={r.overnight} />}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}
