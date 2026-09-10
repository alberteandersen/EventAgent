"use client";

/* One guest, opened up — used both to add a new one and to edit an existing
   one, so there is a single place a guest is described rather than a
   four-field add row and a three-field inline editor that disagree.

   Everything a couple has to plan around lives here: what the guest eats,
   whether they are staying the night, whether they drink, who they are to
   the couple, and the note that used to have no interface at all.

   Edits are a draft until "Gem": nothing calls the parent until Save, so
   Escape, the backdrop and Annuller all discard cleanly. Same contract as
   BudgetLineDetail, which this borrows its chrome from. */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trash2, UserRound } from 'lucide-react';
import { Eyebrow, SelectPill, Toggle, cn } from '../ui';
import { useLang } from '../i18n';
import { DIETARY_TAGS, parseLegacyDietary } from './guests/dietary';
import type { GuestRow, RsvpStatus } from '@/lib/db/types';

/** A labeled field wrapper, so every input in the panel lines up the same way. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted">{label}</span>
      {children}
    </label>
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
  plus_one: boolean;
  plus_one_name: string | null;
  dietary_tags: string[];
  dietary: string | null;
  overnight: boolean;
  no_alcohol: boolean;
  notes: string | null;
}

export default function GuestDialog({
  guest,
  sides,
  onClose,
  onSave,
  onDelete,
}: {
  /** null when adding — the dialog is the add form and the editor both. */
  guest: GuestRow | null;
  /** ['Fælles', partner A, partner B] — built by the guest screen. */
  sides: string[];
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
  const [dPlusOne, setDPlusOne] = useState(guest?.plus_one ?? false);
  const [dPlusOneName, setDPlusOneName] = useState(guest?.plus_one_name ?? '');
  const [dTags, setDTags] = useState<string[]>(
    guest?.dietary_tags?.length ? guest.dietary_tags : legacy.tags,
  );
  const [dDietary, setDDietary] = useState(guest?.dietary_tags?.length ? (guest?.dietary ?? '') : legacy.rest);
  const [dOvernight, setDOvernight] = useState(guest?.overnight ?? false);
  const [dNoAlcohol, setDNoAlcohol] = useState(guest?.no_alcohol ?? false);
  const [dNotes, setDNotes] = useState(guest?.notes ?? '');
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
      plus_one: dPlusOne,
      plus_one_name: dPlusOne ? (dPlusOneName.trim() || null) : null,
      dietary_tags: dTags,
      dietary: dDietary.trim() || null,
      overnight: dOvernight,
      no_alcohol: dNoAlcohol,
      notes: dNotes.trim() || null,
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
            <Eyebrow>{t('Grundlæggende')}</Eyebrow>
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
            </div>
          </section>

          {/* Svar */}
          <section>
            <Eyebrow>{t('Svar')}</Eyebrow>
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
            <Eyebrow>{t('Hører til')}</Eyebrow>
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

          {/* Ledsager */}
          <section>
            <Eyebrow>{t('Ledsager')}</Eyebrow>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-shell px-3.5 py-2.5">
              <span className="text-[0.85rem] text-ink">{t('Har en ledsager med')}</span>
              <Toggle value={dPlusOne} onChange={setDPlusOne} />
            </div>
            {dPlusOne && (
              <input
                value={dPlusOneName}
                onChange={(e) => setDPlusOneName(e.target.value)}
                placeholder={t('Ledsagerens navn')}
                aria-label={t('Ledsagerens navn')}
                className={cn(fieldCls, 'mt-2')}
              />
            )}
          </section>

          {/* Kost og catering */}
          <section>
            <Eyebrow>{t('Kost og catering')}</Eyebrow>
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
            <Eyebrow>{t('Noter')}</Eyebrow>
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
                  {t('Fortryd')}
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
