'use client';

/* Takkekort — the card that goes out after the day.
 *
 * Built on the invitation engine rather than beside it. All twenty templates
 * render from one InvitationData shape, so the couple can send a thank-you in
 * the same design as their invitation, and the only new thing here is the
 * wording (thankCard.ts) and who it is addressed to.
 *
 * Who to thank comes from the same derived list the Takkeliste uses, so the
 * two tabs never disagree about who is outstanding. */

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Mail, PenLine } from 'lucide-react';
import { PhoneFrame, ScaledPhone } from '../../invitations/PhoneFrame';
import { templatesByGroup } from '../../invitations/templates';
import { useInvitationFonts } from '../../invitations/fonts';
import { GROUP_LABELS, GROUP_ORDER } from '../../invitations/types';
import type { Template, TemplateGroup } from '../../invitations/types';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import { cn } from '../../ui';
import { thankCardData, greetingFor, showsNote } from './thankCard';
import { buildThankList } from './thanks';

export default function TakkekortTab() {
  useInvitationFonts();
  const { t, lang } = useLang();
  const { couple, event, guests, registryClaims, registryItems, thankYous } = useWedding();

  const [group, setGroup] = useState<TemplateGroup>('sealed');
  const [picked, setPicked] = useState<Template | null>(null);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => templatesByGroup(), []);
  /* Only some templates lay out the couple's own lines. The moment they write
     one, the gallery narrows to the designs that will actually show it —
     silently dropping what someone just typed is the worst outcome here. */
  const hasNote = note.trim().length > 0;
  const all = groups.find((g) => g.group === group)?.templates ?? [];
  const shown = hasNote ? all.filter(showsNote) : all;
  const hiddenByNote = all.length - shown.length;

  const input = {
    partnerA: couple.a,
    partnerB: couple.b,
    isoDate: event?.event_date ?? couple.dateISO,
    venue: couple.region,
    language: lang,
    personalNote: note,
  };

  /* Still to thank, from the list the Takkeliste derives — one source, so the
     two tabs cannot disagree about who is outstanding. */
  const outstanding = useMemo(
    () => buildThankList(guests, registryClaims, registryItems, thankYous).filter((r) => !r.thankedAt),
    [guests, registryClaims, registryItems, thankYous],
  );

  const copyGreetings = async () => {
    const lines = outstanding.map((r) => greetingFor(r.name, lang));
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the names are on screen anyway */ }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] leading-relaxed text-ink-soft">
          {t('Samme designs som jeres invitation, med teksten vendt om: I inviterede dem, nu takker I dem.')}
        </p>
      </div>

      {/* Their own words. The default is a placeholder for the couple with
          nothing particular to add; anything they write replaces it. */}
      <label className="flex flex-col gap-2">
        <span className="eyebrow flex items-center gap-1.5">
          <PenLine size={12} aria-hidden /> {t('Jeres egen hilsen')}
        </span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={t('Fx: Tak fordi I dansede til den lyse morgen.')}
          className="w-full resize-none rounded-2xl rule bg-card px-4 py-3 text-[0.92rem] text-ink placeholder:text-muted focus:border-ink focus:outline-none"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        {GROUP_ORDER.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup(g)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[0.78rem] font-medium transition-colors cursor-pointer',
              group === g ? 'border-ink bg-ink text-canvas' : 'border-line text-ink-soft hover:border-ink hover:text-ink',
            )}
          >
            {t(GROUP_LABELS[g])}
          </button>
        ))}
      </div>

      {hasNote && hiddenByNote > 0 && (
        <p className="-mt-3 text-[0.78rem] text-muted">
          {t('{n} designs er skjult — de har ikke plads til jeres egen hilsen.', { n: hiddenByNote })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4">
        {shown.map((tpl) => {
          const data = thankCardData(tpl, input);
          const isPicked = picked?.id === tpl.id;
          return (
            <motion.button
              key={tpl.id}
              type="button"
              onClick={() => setPicked(tpl)}
              whileHover={{ y: -3 }}
              className="flex cursor-pointer flex-col items-center gap-2"
            >
              <div className={cn('rounded-[26px] p-1 transition-colors', isPicked ? 'bg-sage-strong' : 'bg-transparent')}>
                <ScaledPhone width={168}>
                  <PhoneFrame>
                    <tpl.Component data={data} />
                  </PhoneFrame>
                </ScaledPhone>
              </div>
              <span className="text-[0.78rem] font-medium text-ink">{tpl.name}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Who has not been thanked yet — the same list the Takkeliste shows,
          here as the addressing side of the card rather than a checklist. */}
      <div className="flex flex-col gap-3 rounded-2xl rule bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.92rem] font-semibold text-ink">
              {outstanding.length > 0
                ? t('{n} mangler stadig en tak', { n: outstanding.length })
                : t('Alle har fået tak')}
            </p>
            <p className="mt-0.5 text-[0.8rem] text-muted">
              {t('Navnene står som de skal skrives på kortet.')}
            </p>
          </div>
          {outstanding.length > 0 && (
            <button
              type="button"
              onClick={copyGreetings}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-[0.78rem] font-semibold text-ink transition-colors hover:border-ink"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t('Kopieret') : t('Kopiér hilsener')}
            </button>
          )}
        </div>

        {outstanding.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {outstanding.slice(0, 12).map((r) => (
              <span key={r.key} className="rounded-full bg-shell px-3 py-1 text-[0.78rem] text-ink-soft">
                {greetingFor(r.name, lang)}
              </span>
            ))}
            {outstanding.length > 12 && (
              <span className="px-2 py-1 text-[0.78rem] text-muted">
                {t('+{n} flere', { n: outstanding.length - 12 })}
              </span>
            )}
          </div>
        )}
      </div>

      {picked && (
        <div className="flex flex-wrap items-center gap-3 rule-t pt-5">
          <p className="text-[0.85rem] text-ink-soft">
            {t('{name} er valgt.', { name: picked.name })}
          </p>
          <a
            href={`mailto:?subject=${encodeURIComponent(t('Tak fordi I kom'))}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[0.8rem] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Mail size={13} /> {t('Send det med mail')}
          </a>
        </div>
      )}
    </div>
  );
}
