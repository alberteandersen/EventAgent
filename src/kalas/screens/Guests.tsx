import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ChevronDown, Trash2, Search, X, Check, Link2, Mail, Phone, Pencil, Utensils, BedDouble, GlassWater, Baby, ShieldAlert } from 'lucide-react';
import { Pill, cn } from '../ui';
import GuestDialog, { type GuestDraft } from './GuestDialog';
import { dietarySummary } from './guests/dietary';
import { ageCountLabel, ageCounts, ageGroupOf, AGE_GROUPS, orderByHousehold } from './guests/household';
import { placeAtTable, readPlan, seatOf, tableOptions } from './seating/model';
import CateringOverview from './guests/CateringOverview';
import { hasNeed, type GuestNeed } from './guests/catering';
import AnimateNumber from '../AnimateNumber';
import { useLang } from '../i18n';
import { GuideLink } from './guides/GuideLink';
import { useWedding } from '../useWedding';
import { useRemoveWithUndo, useWithoutPending } from '../undo';
import type { GuestRow as GuestRecord, RsvpStatus } from '@/lib/db/types';

/** The three states a couple can set by hand, in the order they think about
 *  them. 'nej' reads as "Afbud" everywhere in the UI. */
const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'ja', label: 'Ja' },
  { value: 'afventer', label: 'Afventer' },
  { value: 'nej', label: 'Afbud' },
];

type Tab = 'gæsteliste' | 'overblik';
type Filter = 'alle' | 'ja' | 'afventer' | 'afbud';

const TAB_LABELS: Record<Tab, string> = { gæsteliste: 'Gæsteliste', overblik: 'Overblik' };

/* The quick filters on the list, the same needs the Overblik tab counts.
   Combined with each other and with the RSVP tabs: "Afventer" + "Overnatning"
   is who still has to say whether they need a room. */
const NEED_FILTERS: { id: GuestNeed; label: string; Icon: typeof Utensils }[] = [
  { id: 'allergy', label: 'Allergier', Icon: ShieldAlert },
  { id: 'diet', label: 'Kostbehov', Icon: Utensils },
  { id: 'overnight', label: 'Overnatning', Icon: BedDouble },
  { id: 'noAlcohol', label: 'Alkoholfri', Icon: GlassWater },
  { id: 'children', label: 'Børn', Icon: Baby },
];
const FILTER_LABELS: Record<Filter, string> = { alle: 'Alle', ja: 'Ja', afventer: 'Afventer', afbud: 'Afbud' };

export default function Guests({ initialTab = 'gæsteliste' }: {
  /** Which tab opens first; the app always opens the list, harnesses may not. */
  initialTab?: Tab;
} = {}) {
  const { t, tn } = useLang();
  const { couple, guests: allGuests, weddingSite, seatingPlan, saveSeating, addGuest: addGuestRow, updateGuest, deleteGuest } = useWedding();
  const siteBase = weddingSite?.published && weddingSite.domain
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/w/${weddingSite.domain}`
    : null;
  // A guest removed a moment ago stays gone while Fortryd is still on offer.
  const guestList = useWithoutPending(allGuests);
  const removeWithUndo = useRemoveWithUndo();
  const guestLink = (token: string) => (siteBase ? `${siteBase}?rsvp=${token}` : null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [filter, setFilter] = useState<Filter>('alle');
  const [query, setQuery] = useState('');
  const [needs, setNeeds] = useState<Set<GuestNeed>>(new Set());
  const toggleNeed = (need: GuestNeed) =>
    setNeeds((prev) => {
      const next = new Set(prev);
      if (next.has(need)) next.delete(need); else next.add(need);
      return next;
    });
  // null = closed, 'new' = the add form, otherwise the guest being edited.
  // One dialog for both, so a guest is described in a single place.
  const [dialog, setDialog] = useState<'new' | GuestRecord | null>(null);

  const rsvpStats = useMemo(() => ({
    invited: guestList.length,
    ja: guestList.filter((g) => g.rsvp === 'ja').length,
    afventer: guestList.filter((g) => g.rsvp === 'afventer').length,
    nej: guestList.filter((g) => g.rsvp === 'nej').length,
  }), [guestList]);

  const rsvpFilter = filter === 'afbud' ? 'nej' : filter;
  const list = guestList
    .filter((g) => filter === 'alle' || g.rsvp === rsvpFilter)
    .filter((g) => [...needs].every((need) => hasNeed(g, need)))
    .filter((g) => !query.trim() || g.name.toLowerCase().includes(query.trim().toLowerCase()));

  const startAdding = () => setDialog('new');

  const plan = useMemo(() => readPlan(seatingPlan?.data), [seatingPlan]);
  const ages = useMemo(() => ageCounts(guestList), [guestList]);

  const saveDialog = async (draft: GuestDraft) => {
    // The table is the seating plan's, not a guest column.
    const { table_id: tableId, ...fields } = draft;
    const target = dialog;
    let id: string | null = null;
    if (target === 'new') id = (await addGuestRow(fields))?.id ?? null;
    else if (target) { void updateGuest(target.id, fields); id = target.id; }
    if (!id || (seatOf(plan, id)?.tableId ?? null) === tableId) return;
    void saveSeating(placeAtTable(plan, id, tableId) as unknown as Record<string, unknown>);
  };

  const removeGuest = (g: GuestRecord) => removeWithUndo(g.id, g.name, () => deleteGuest(g.id));
  const setRsvp = (g: GuestRecord, rsvp: RsvpStatus) => void updateGuest(g.id, { rsvp });

  const sides = ['Fælles', couple.a || 'Partner 1', couple.b || 'Partner 2'].filter(Boolean);

  return (
    <div className="px-6 py-8 sm:px-9 lg:px-12 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[clamp(2rem,4vw,2.4rem)] leading-[1.1] tracking-[-0.02em] text-ink">
            {t('Gæster')}
          </h1>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
            {t('Hold styr på jeres gæsteliste og RSVP, og send invitationer, når I er klar.')}
          </p>
          <GuideLink screen="guests" />
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Pill arrow onClick={startAdding}><Plus size={15} /> {t('Tilføj')}</Pill>
        </div>
      </div>

      {/* RSVP rings */}
      <div className="mt-6 grid gap-10 sm:grid-cols-3">
        <Ring value={rsvpStats.ja}       total={rsvpStats.invited} label={t('Bekræftet')}    color="var(--color-sage)" />
        <Ring value={rsvpStats.afventer} total={rsvpStats.invited} label={t('Mangler svar')} color="var(--color-line-strong)" track />
        <Ring value={rsvpStats.nej}      total={rsvpStats.invited} label={t('Afbud')}        color="var(--color-clay)" />
      </div>

      {/* Section tabs */}
      <div className="mt-10 flex gap-1 border-b border-[var(--color-line)]">
        {(['gæsteliste', 'overblik'] as Tab[]).map((tabId) => (
          <button key={tabId} onClick={() => setTab(tabId)}
            className={cn('relative px-5 py-3 text-[0.85rem] capitalize transition-colors cursor-pointer',
              tab === tabId ? 'text-ink' : 'text-muted hover:text-ink')}>
            {t(TAB_LABELS[tabId])}
            {tab === tabId && (
              <motion.span layoutId="guest-section-tab"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'gæsteliste' ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* RSVP reminder */}
            {rsvpStats.afventer > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-6 flex items-center justify-between gap-4 rounded-2xl rule bg-card px-5 py-4">
                <div>
                  <p className="text-[0.88rem] font-medium text-ink">
                    {tn(rsvpStats.afventer, 'Én gæst mangler stadig svar', '{n} gæster mangler stadig svar')}
                  </p>
                  <p className="mt-0.5 text-[0.76rem] text-muted">
                    {t('De svarer på jeres hjemmeside, når I har delt den.')}
                  </p>
                </div>
                {filter !== 'afventer' && (
                  <button
                    onClick={() => { setNeeds(new Set()); setQuery(''); setFilter('afventer'); }}
                    className="shrink-0 h-8 rounded-full bg-ink px-3 text-xs font-semibold uppercase tracking-[0.12em] text-canvas hover:bg-ink/80 transition-colors cursor-pointer">
                    {t('Vis hvem')}
                  </button>
                )}
              </motion.div>
            )}

            {/* Search + mobile add */}
            <div className="mt-6 flex items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-full rule bg-card px-4 py-2.5">
                <Search size={14} className="shrink-0 text-muted" />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Søg i gæstelisten…')} aria-label={t('Søg gæster')}
                  className="flex-1 bg-transparent text-[0.85rem] text-ink placeholder:text-muted focus:outline-none" />
                {query && (
                  <button onClick={() => setQuery('')} aria-label={t('Ryd søgning')}
                    className="shrink-0 text-muted hover:text-ink cursor-pointer"><X size={13} /></button>
                )}
              </div>
              <button onClick={startAdding}
                className="sm:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-canvas cursor-pointer"
                style={{ background: 'var(--color-ink)' }} aria-label={t('Tilføj gæst')}>
                <Plus size={16} />
              </button>
            </div>

            {/* Filter tabs */}
            <div className="mt-2 flex gap-1 rule-b">
              {(['alle', 'ja', 'afventer', 'afbud'] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn('relative px-4 py-3 text-[0.85rem] capitalize transition-colors cursor-pointer',
                    filter === f ? 'text-ink' : 'text-muted hover:text-ink')}>
                  {t(FILTER_LABELS[f])}
                  {filter === f && (
                    <motion.span layoutId="guest-tab"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sage" />
                  )}
                </button>
              ))}
            </div>

            {/* Needs, on top of the RSVP tab. */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {NEED_FILTERS.map(({ id, label, Icon }) => {
                const on = needs.has(id);
                return (
                  <button key={id} type="button" onClick={() => toggleNeed(id)} aria-pressed={on}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] transition-colors cursor-pointer',
                      on ? 'border-[var(--color-sage-strong)] bg-[var(--color-sage-tint)] text-sage-strong'
                        : 'border-[var(--color-line)] bg-card text-muted hover:border-ink hover:text-ink',
                    )}>
                    <Icon size={13} aria-hidden /> {t(label)}
                  </button>
                );
              })}
              {needs.size > 0 && (
                <button type="button" onClick={() => setNeeds(new Set())}
                  className="inline-flex items-center gap-1 px-2 text-[0.74rem] text-muted hover:text-ink cursor-pointer">
                  <X size={12} /> {t('Ryd filtre')}
                </button>
              )}
            </div>

            {/* Who is coming, by age: what catering and the venue ask first. */}
            {guestList.length > 0 && (ages.child > 0 || ages.baby > 0) && (
              <p className="mt-4 text-[0.78rem] text-muted">
                {AGE_GROUPS.filter((a) => ages[a.id] > 0)
                  .map((a) => t(ageCountLabel(a.id, ages[a.id]), { n: ages[a.id] }))
                  .join(' · ')}
              </p>
            )}

            {/* Table header */}
            <div className="mt-4 grid items-center gap-4 pb-3 rule-b"
              style={{ gridTemplateColumns: '1fr 90px 90px 20px' }}>
              <span className="text-[0.62rem] font-semibold tracking-[0.2em] uppercase text-muted">{t('Navn')}</span>
              <span className="text-[0.62rem] font-semibold tracking-[0.2em] uppercase text-muted">{t('RSVP')}</span>
              <span className="text-[0.62rem] font-semibold tracking-[0.2em] uppercase text-muted">{t('Måltid')}</span>
              <span className="text-[0.62rem] font-semibold tracking-[0.2em] uppercase text-muted">-</span>
            </div>
            <div className="divide-y divide-[var(--color-line)]">
              {orderByHousehold(list).map(({ guest: g, member }, i) => <GuestRow key={g.id} g={g} i={i} member={member} link={guestLink(g.rsvp_token)} onRemove={() => removeGuest(g)} onSetRsvp={(v) => setRsvp(g, v)} onEdit={() => setDialog(g)} />)}
            </div>
            {list.length === 0 && (
              <p className="py-10 text-center font-serif text-[1.1rem] italic text-muted">
                {query ? t('Ingen gæster matcher "{query}"', { query }) : t('Ingen gæster i dette filter endnu.')}
              </p>
            )}
          </motion.div>
        ) : (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CateringOverview
              guests={guestList}
              plan={plan}
              title={[couple.a, couple.b].filter(Boolean).join(' & ')}
              subtitle={couple.dateLabel}
              onShowGuests={(need) => {
                if (need === 'pending') { setNeeds(new Set()); setFilter('afventer'); }
                else { setNeeds(new Set([need])); setFilter('alle'); }
                setQuery('');
                setTab('gæsteliste');
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {dialog && (
        <GuestDialog
          guest={dialog === 'new' ? null : dialog}
          sides={sides}
          guests={guestList}
          tables={tableOptions(plan, dialog === 'new' ? null : dialog.id)}
          tableId={dialog === 'new' ? null : (seatOf(plan, dialog.id)?.tableId ?? null)}
          onClose={() => setDialog(null)}
          onSave={saveDialog}
          onDelete={dialog === 'new' ? undefined : () => { removeGuest(dialog); setDialog(null); }}
        />
      )}
    </div>
  );
}

/* The status as a dropdown, not a chip you click through. Cycling meant two
   wrong states on the way to the right one, on a list where most rows only
   ever get set once. A native select so it is keyboard-reachable and opens
   the system picker on a phone; the pill styling is the Chip's, since it has
   to keep reading as a status at a glance. */
function RsvpSelect({ value, name, onChange }: { value: RsvpStatus; name: string; onChange: (v: RsvpStatus) => void }) {
  const { t } = useLang();
  const tone =
    value === 'ja' ? 'bg-[#dde7d6] text-success'
    : value === 'afventer' ? 'bg-[#ecdcd0] text-[#7a543c]'
    : 'rule text-muted';
  return (
    <span className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RsvpStatus)}
        aria-label={t('Svar for {name}', { name })}
        className={cn(
          'cursor-pointer appearance-none rounded-full py-1 pl-2.5 pr-6 text-[0.65rem] font-medium uppercase tracking-[0.14em] focus:outline-none',
          tone,
        )}
      >
        {RSVP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{t(o.label)}</option>
        ))}
      </select>
      <ChevronDown size={11} aria-hidden
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 opacity-50" />
    </span>
  );
}

function GuestRow({ g, i, member, link, onRemove, onSetRsvp, onEdit }: { g: GuestRecord; i: number; member: boolean; link: string | null; onRemove: () => void; onSetRsvp: (v: RsvpStatus) => void; onEdit: () => void }) {
  const { t } = useLang();
  const isAfbud = g.rsvp === 'nej';
  const [copied, setCopied] = useState(false);
  const detail = [
    g.plus_one_name && `+ ${g.plus_one_name}`,
    dietarySummary(g.dietary_tags, g.dietary) || null,
  ].filter(Boolean).join(' · ');

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.25) }}
      // A household member sits indented under its head, so one envelope
      // reads as one block on the list.
      className={cn('py-4', member && 'ml-6 border-l-2 border-l-[var(--color-sage-tint)] pl-4')}
    >
      <div className="grid items-center gap-4" style={{ gridTemplateColumns: '1fr 90px 90px 66px' }}>
        <div className="min-w-0">
          <div className={cn('flex items-center gap-1.5 font-serif text-[1.05rem] text-ink', isAfbud && 'opacity-40')}>
            <span className="truncate">{g.name}</span>
            {g.responded_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" title={t('Har svaret')} />}
            {ageGroupOf(g) !== 'adult' && (
              <span className="shrink-0 rounded-full bg-[var(--color-sage-tint)] px-2 py-0.5 font-sans text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-sage-strong">
                {t(AGE_GROUPS.find((a) => a.id === ageGroupOf(g))!.label)}
              </span>
            )}
          </div>
          <div className="text-[0.76rem] text-muted truncate">{t(g.side)}{detail && ` · ${detail}`}</div>
          {(g.email || g.phone) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.72rem] text-muted">
              {g.email && <span className="flex items-center gap-1 truncate"><Mail size={11} className="shrink-0" />{g.email}</span>}
              {g.phone && <span className="flex items-center gap-1 truncate"><Phone size={11} className="shrink-0" />{g.phone}</span>}
            </div>
          )}
        </div>

        <RsvpSelect value={g.rsvp} name={g.name} onChange={onSetRsvp} />

        <div>
          {g.meal ? (
            <span className="text-[0.82rem] text-ink-soft capitalize">{g.meal}</span>
          ) : (
            <span className="text-[0.82rem] text-muted">-</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onEdit} aria-label={t('Rediger {name}', { name: g.name })} title={t('Rediger gæsten')}
            className="text-muted/50 transition-colors hover:text-ink cursor-pointer">
            <Pencil size={13} />
          </button>
          {link && (
            <button onClick={copyLink} aria-label={t('Kopiér svar-link til {name}', { name: g.name })} title={t('Kopiér personligt svar-link')}
              className="text-muted/50 hover:text-ink transition-colors cursor-pointer">
              {copied ? <Check size={13} className="text-success" /> : <Link2 size={13} />}
            </button>
          )}
          <button onClick={onRemove} aria-label={t('Fjern {name}', { name: g.name })}
            className="text-muted/50 hover:text-[var(--color-terracotta)] transition-colors cursor-pointer">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

    </motion.div>
  );
}

function Ring({ value, total, label, color, track }: {
  value: number; total: number; label: string; color: string; track?: boolean;
}) {
  const r   = 52;
  const c   = 2 * Math.PI * r;
  const pct = total > 0 ? value / total : 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[120px] w-[120px] shrink-0">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-line)" strokeWidth="1.5" />
          <motion.circle
            cx="60" cy="60" r={r} fill="none" stroke={color}
            strokeWidth={track ? 1.5 : 2} strokeLinecap="round" strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            whileInView={{ strokeDashoffset: c * (1 - pct) }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
      </div>
      <div>
        <div className="font-serif text-[2.6rem] leading-none text-ink">
          <AnimateNumber value={value} />
        </div>
        <div className="eyebrow mt-2">{label}</div>
      </div>
    </div>
  );
}
