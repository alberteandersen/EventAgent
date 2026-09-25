"use client";

/* One guest, opened up — used both to add a new one and to edit an existing
   one, so there is a single place a guest is described rather than a
   four-field add row and a three-field inline editor that disagree.

   Everything a couple has to plan around lives here: what the guest eats,
   whether they are staying the night, whether they drink, who they are to
   the couple, how old they are, which household they come with, where they
   sit, and the note that used to have no interface at all.

   Edits are a draft until "Gem": nothing calls the parent until Save, so
   Escape, the backdrop and Annuller all discard cleanly. Same contract as
   BudgetLineDetail, which this borrows its chrome from. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, UserRound, CircleCheck, HeartHandshake, House, Armchair, Utensils, NotebookPen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Eyebrow, SelectPill, Toggle, cn } from '../ui';
import { useLang } from '../i18n';
import { DIETARY_TAGS, parseLegacyDietary } from './guests/dietary';
import { AGE_GROUPS, ageGroupOf, householdHeadOptions, householdMembers } from './guests/household';
import type { AgeGroup, GuestRow, RsvpStatus } from '@/lib/db/types';

/** A labeled field wrapper, so every input in the panel lines up the same way. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
    </label>
  );
}

/** A section heading with its icon, so a long form can be scanned by shape. */
function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <Eyebrow className="flex items-center gap-2">
      <Icon size={13} strokeWidth={2} aria-hidden className="text-sage" />
      {children}
    </Eyebrow>
  );
}

const fieldCls =
  'w-full rule rounded-xl bg-shell px-3.5 py-2.5 text-[0.9rem] text-ink placeholder:text-muted/60 focus:outline-none focus:border-[var(--color-sage-strong)]';

const RSVP_CHOICES: { value: RsvpStatus; label: string }[] = [
  { value: 'ja', label: 'Accepteret' },
  { value: 'nej', label: 'Afslået' },
  { value: 'afventer', label: 'Afventer' },
];

/** Suggestions, not a closed list — relation stays free text. */
const RELATIONS = ['Familie', 'Ven', 'Kollega', 'Barn', 'Partner'];

export interface GuestDraft {
  name: string;
  email: string | null;
  phone: string | null;
  side: string;
  relation: string | null;
  rsvp: RsvpStatus;
  dietary_tags: string[];
  dietary: string | null;
  overnight: boolean;
  no_alcohol: boolean;
  notes: string | null;
  age_group: AgeGroup;
  household_head: string | null;
  /** Not a guest column: the table on the seating plan, applied by the caller.
   *  Null takes the guest off the plan. */
  table_id: string | null;
}

export type TableChoice = { id: string; name: string; free: number };

export default function GuestDialog({
  guest,
  sides,
  guests = [],
  tables = [],
  tableId = null,
  onClose,
  onSave,
  onDelete,
}: {
  /** null when adding — the dialog is the add form and the editor both. */
  guest: GuestRow | null;
  /** ['Fælles', partner A, partner B] — built by the guest screen. */
  sides: string[];
  /** The whole list, for the household picker. */
  guests?: GuestRow[];
  /** Tables on the seating plan this guest could sit at, from `tableOptions`. */
  tables?: TableChoice[];
  /** The table they sit at now, if any. */
  tableId?: string | null;
  onClose: () => void;
  onSave: (draft: GuestDraft) => void;
  onDelete?: () => void;
}) {
  const { t } = useLang();

  // Seeded once, on open. An existing guest's hand-typed dietary text is read
  // for chips it already names, so "vegetar" arrives as a lit chip instead of
  // something the couple has to enter twice.
  const legacy = parseLegacyDietary(guest?.dietary);
  const [dName, setDName] = useState(guest?.name ?? '');
  const [dEmail, setDEmail] = useState(guest?.email ?? '');
  const [dPhone, setDPhone] = useState(guest?.phone ?? '');
  const [dSide, setDSide] = useState(guest?.side ?? sides[0] ?? 'Fælles');
  const [dRelation, setDRelation] = useState(guest?.relation ?? '');
  const [dRsvp, setDRsvp] = useState<RsvpStatus>(guest?.rsvp ?? 'afventer');
  const [dTags, setDTags] = useState<string[]>(
    guest?.dietary_tags?.length ? guest.dietary_tags : legacy.tags,
  );
  const [dDietary, setDDietary] = useState(guest?.dietary_tags?.length ? (guest?.dietary ?? '') : legacy.rest);
  const [dOvernight, setDOvernight] = useState(guest?.overnight ?? false);
  const [dNoAlcohol, setDNoAlcohol] = useState(guest?.no_alcohol ?? false);
  const [dNotes, setDNotes] = useState(guest?.notes ?? '');
  const [dAge, setDAge] = useState<AgeGroup>(ageGroupOf(guest ?? {}));
  const [dHousehold, setDHousehold] = useState<string | null>(guest?.household_head ?? null);
  const [dTable, setDTable] = useState<string | null>(tableId);

  const members = guest ? householdMembers(guests, guest.id) : [];
  const heads = householdHeadOptions(guests, guest?.id ?? null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleTag = (id: string) =>
    setDTags((tags) => (tags.includes(id) ? tags.filter((x) => x !== id) : [...tags, id]));

  const name = dName.trim();
  const save = () => {
    if (!name) return;
    onSave({
      name,
      email: dEmail.trim() || null,
      phone: dPhone.trim() || null,
      side: dSide,
      relation: dRelation.trim() || null,
      rsvp: dRsvp,
      dietary_tags: dTags,
      dietary: dDietary.trim() || null,
      overnight: dOvernight,
      no_alcohol: dNoAlcohol,
      notes: dNotes.trim() || null,
      age_group: dAge,
      household_head: dHousehold,
      table_id: dTable,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-[0_32px_80px_-16px_rgba(24,32,24,0.28)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-tint" aria-hidden>
              <UserRound size={17} className="text-sage-strong" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <Eyebrow>{t('Gæst')}</Eyebrow>
              <h2 className="mt-0.5 truncate font-serif text-[1.35rem] text-ink">
                {name || (guest ? guest.name : t('Tilføj gæst'))}
              </h2>
            </div>
          </div>
          <button
            type="button" onClick={onClose} aria-label={t('Luk')}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-shell hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
          {/* Grundlæggende */}
          <section>
            <SectionTitle icon={UserRound}>{t('Grundlæggende')}</SectionTitle>
            <div className="mt-3 space-y-3">
              <Field label={t('Fulde navn')}>
                <input
                  autoFocus={!guest}
                  value={dName}
                  onChange={(e) => setDName(e.target.value)}
                  placeholder={t('Fulde navn')}
                  className={fieldCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('E-mail')}>
                  <input
                    type="email" value={dEmail} onChange={(e) => setDEmail(e.target.value)}
                    placeholder="navn@eksempel.dk" className={fieldCls}
                  />
                </Field>
                <Field label={t('Telefon')}>
                  <input
                    type="tel" value={dPhone} onChange={(e) => setDPhone(e.target.value)}
                    placeholder="+45 12 34 56 78" className={fieldCls}
                  />
                </Field>
              </div>
              <div>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{t('Alderskategori')}</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {AGE_GROUPS.map((a) => (
                    <SelectPill key={a.id} active={dAge === a.id} onClick={() => setDAge(a.id)}>
                      {t(a.label)}
                    </SelectPill>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Svar */}
          <section>
            <SectionTitle icon={CircleCheck}>{t('Svar')}</SectionTitle>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {RSVP_CHOICES.map((choice) => (
                <SelectPill
                  key={choice.value}
                  active={dRsvp === choice.value}
                  onClick={() => setDRsvp(choice.value)}
                >
                  {t(choice.label)}
                </SelectPill>
              ))}
            </div>
            {guest && !guest.responded_at && (
              <p className="mt-2 text-[0.72rem] text-muted">
                {t('Gæsten har ikke selv svaret endnu — det her er jeres egen note om status.')}
              </p>
            )}
          </section>

          {/* Hører til */}
          <section>
            <SectionTitle icon={HeartHandshake}>{t('Hører til')}</SectionTitle>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label={t('Side')}>
                <select value={dSide} onChange={(e) => setDSide(e.target.value)} className={fieldCls}>
                  {sides.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label={t('Relation')}>
                <input
                  value={dRelation} onChange={(e) => setDRelation(e.target.value)}
                  placeholder={t('Fx brudens moster')} className={fieldCls}
                />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RELATIONS.map((r) => (
                <SelectPill key={r} active={dRelation === r} onClick={() => setDRelation(dRelation === r ? '' : r)}>
                  {t(r)}
                </SelectPill>
              ))}
            </div>
          </section>

          {/* Husstand — one invitation, one envelope. One level deep: see
              guests/household.ts for why a head cannot join another one. */}
          <section>
            <SectionTitle icon={House}>{t('Husstand')}</SectionTitle>
            {members.length > 0 ? (
              <p className="mt-3 rounded-xl bg-shell px-3.5 py-3 text-[0.82rem] leading-relaxed text-ink-soft">
                {t('{name} er husstandens overhoved for {members}.', {
                  name: guest?.name ?? '',
                  members: members.map((m) => m.name).join(', '),
                })}
              </p>
            ) : heads.length > 0 ? (
              <>
                <select
                  value={dHousehold ?? ''}
                  onChange={(e) => setDHousehold(e.target.value || null)}
                  aria-label={t('Husstand')}
                  className={cn(fieldCls, 'mt-3')}
                >
                  <option value="">{t('Egen husstand')}</option>
                  {heads.map((h) => (
                    <option key={h.id} value={h.id}>{t('Sammen med {name}', { name: h.name })}</option>
                  ))}
                </select>
                <p className="mt-2 text-[0.72rem] text-muted">
                  {t('Gæster i samme husstand får én invitation og står samlet på listen.')}
                </p>
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-shell px-3.5 py-3 text-[0.82rem] leading-relaxed text-muted">
                {t('Der er ingen andre gæster at samle i en husstand endnu.')}
              </p>
            )}
          </section>

          {/* Bordplacering — the table only; the chair is the seating plan's
              business, so a guest lands in the first free one. */}
          <section>
            <SectionTitle icon={Armchair}>{t('Bordplacering')}</SectionTitle>
            {tables.length > 0 ? (
              <select
                value={dTable ?? ''}
                onChange={(e) => setDTable(e.target.value || null)}
                aria-label={t('Bord')}
                className={cn(fieldCls, 'mt-3')}
              >
                <option value="">{t('Ikke placeret')}</option>
                {tables.map((tb) => (
                  <option key={tb.id} value={tb.id}>
                    {tb.id === tableId
                      ? tb.name
                      : t('{table} · {n} ledige', { table: tb.name, n: tb.free })}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-3 rounded-xl bg-shell px-3.5 py-3 text-[0.82rem] leading-relaxed text-muted">
                {t('Når I har sat borde op i bordplanen, kan I placere gæsten her.')}
              </p>
            )}
          </section>

          {/* Kost og catering */}
          <section>
            <SectionTitle icon={Utensils}>{t('Kost og catering')}</SectionTitle>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {DIETARY_TAGS.map((tag) => (
                <SelectPill key={tag.id} active={dTags.includes(tag.id)} onClick={() => toggleTag(tag.id)}>
                  {t(tag.label)}
                </SelectPill>
              ))}
            </div>
            <input
              value={dDietary}
              onChange={(e) => setDDietary(e.target.value)}
              placeholder={t('Andet — allergier, ting der ikke er en knap for')}
              aria-label={t('Andre kostbehov')}
              className={cn(fieldCls, 'mt-3')}
            />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl bg-shell px-3.5 py-2.5">
                <span className="text-[0.85rem] text-ink">{t('Overnatning')}</span>
                <Toggle value={dOvernight} onChange={setDOvernight} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-shell px-3.5 py-2.5">
                <span className="text-[0.85rem] text-ink">{t('Drikker ikke alkohol')}</span>
                <Toggle value={dNoAlcohol} onChange={setDNoAlcohol} />
              </div>
            </div>
          </section>

          {/* Noter */}
          <section>
            <SectionTitle icon={NotebookPen}>{t('Noter')}</SectionTitle>
            <textarea
              rows={3}
              value={dNotes}
              onChange={(e) => setDNotes(e.target.value)}
              placeholder={t('Fx kører med nogen, skal sidde tæt på scenen…')}
              aria-label={t('Noter')}
              className={cn(fieldCls, 'mt-3 resize-none text-[0.85rem]')}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-4">
          {onDelete && guest ? (
            confirmingDelete ? (
              <div className="flex items-center gap-3 text-[0.82rem]">
                <span className="text-muted">{t('Fjern {name}?', { name: guest.name })}</span>
                <button type="button" onClick={onDelete}
                  className="font-semibold text-[var(--color-terracotta)] hover:opacity-80 cursor-pointer">
                  {t('Ja, fjern')}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)}
                  className="text-muted hover:text-ink cursor-pointer">
                  {t('Behold')}
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => setConfirmingDelete(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[0.82rem] font-medium text-[var(--color-terracotta)] transition-colors hover:bg-[var(--color-terracotta-tint)] cursor-pointer"
              >
                <Trash2 size={14} /> {t('Fjern')}
              </button>
            )
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              type="button" onClick={onClose}
              className="rounded-full px-4 py-2 text-[0.82rem] font-medium text-muted transition-colors hover:text-ink cursor-pointer"
            >
              {t('Annuller')}
            </button>
            <button
              type="button" onClick={save} disabled={!name}
              className="rounded-full bg-ink px-5 py-2 text-[0.82rem] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {guest ? t('Gem ændringer') : t('Tilføj gæst')}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
