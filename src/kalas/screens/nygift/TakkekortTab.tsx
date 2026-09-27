'use client';

/* Takkekort — the card that goes out after the day.
 *
 * The same card as their invitation, drawn by the invitation's renderer in
 * the couple's active invitation design, with the words turned around
 * (thankCard.ts): they invited the guests, now they thank them. Without an
 * invitation design it borrows the website's vibe, so it still matches
 * something they chose.
 *
 * Ava's built invitation is not reused: its HTML carries the invitation's
 * own words (the reply button, the venue). The vibe tokens it was built from
 * are the same, and those are what the thank-you is drawn with.
 *
 * Who to thank comes from the same derived list the Takkeliste uses, so the
 * two tabs never disagree about who is outstanding. */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Mail, PenLine } from 'lucide-react';
import { InvitePreview } from '../../invitations/InvitePreview';
import { parseInviteContent } from '../../invitations/content';
import { parseSiteDesign, DEFAULT_DESIGN } from '../../site/design';
import { useWedding } from '../../useWedding';
import { useLang } from '../../i18n';
import type { SitePhotoRow } from '@/lib/db/types';
import { greetingFor, thankContent, thankMailBody, thankWords } from './thankCard';
import { buildThankList } from './thanks';

export default function TakkekortTab() {
  const { t, lang } = useLang();
  const {
    couple, event, guests, invitations, invitationDesign, websiteDesign, sitePhotos,
    registryClaims, registryItems, thankYous,
  } = useWedding();

  /* The look: their invitation's, else their website's. */
  const source = invitationDesign ? 'invitation' : websiteDesign ? 'website' : null;
  const design = useMemo(() => {
    const row = invitationDesign ?? websiteDesign;
    return row ? parseSiteDesign(row.design) : DEFAULT_DESIGN;
  }, [invitationDesign, websiteDesign]);

  /* The facts: the invitation's, over the wedding's own. */
  const [note, setNote] = useState('');
  const invitation = useMemo(() => parseInviteContent(invitations[0]?.data, {
    partnerA: couple.a,
    partnerB: couple.b,
    date: event?.event_date ?? couple.dateISO ?? '',
    language: lang,
  }), [invitations, couple.a, couple.b, couple.dateISO, event?.event_date, lang]);
  const content = thankContent(invitation, note);
  const words = thankWords(content.language);

  /* Their favourite photo, as the invitation shows it. */
  const favourite = sitePhotos.find((p) => p.role === 'hero') ?? sitePhotos.find((p) => p.role !== 'section') ?? null;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!event || !favourite) { setPhotoUrl(null); return; }
    let alive = true;
    fetch(`/api/website/photos?eventId=${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { photos?: (SitePhotoRow & { url: string | null })[] } | null) => {
        if (alive) setPhotoUrl(d?.photos?.find((p) => p.id === favourite.id)?.url ?? null);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [event, favourite]);

  const [copied, setCopied] = useState(false);

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

  const mailto = `mailto:?subject=${encodeURIComponent(words.eyebrow)}&body=${encodeURIComponent(thankMailBody(content))}`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
    >
      {/* The card, as a guest's phone shows it */}
      <div className="flex min-w-0 flex-col items-center gap-4 rounded-[28px] border border-[#dcdfdb] bg-[#ffffff] px-5 py-8 sm:px-7">
        <InvitePreview
          html={null}
          htmlFontsHref={null}
          design={design}
          content={content}
          photoUrl={photoUrl}
          width={280}
          title={t('Forhåndsvisning af takkekortet')}
          thanks={words}
        />
        <p className="max-w-sm text-center text-[12px] leading-relaxed text-[#9a9686]">
          {source === 'invitation'
            ? t('I samme stemning som jeres invitation: {name}.', { name: design.concept.name })
            : source === 'website'
              ? t('I samme stemning som jeres hjemmeside: {name}. Laver I en invitation, følger kortet den.', { name: design.concept.name })
              : t('Laver I en invitation, får takkekortet samme udtryk.')}
        </p>
      </div>

      <aside className="flex flex-col gap-5 rounded-[28px] border border-[#dcdfdb] bg-[#ffffff] p-6 lg:sticky lg:top-6">
        {/* Their own words. The default is a placeholder for the couple with
            nothing particular to add; anything they write replaces it. */}
        <label className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9a9686]">
            <PenLine size={12} aria-hidden /> {t('Jeres egen hilsen')}
          </span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={400}
            placeholder={t('Fx: Tak fordi I dansede til den lyse morgen.')}
            className="w-full resize-none rounded-[14px] border border-[#e6e9e5] bg-[#f8f9f8] px-4 py-3 text-sm leading-relaxed text-[#24413a] placeholder:text-[#9a9686] focus:border-[#24413a] focus:outline-none"
          />
        </label>

        <a
          href={mailto}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#12332b] px-4 text-[0.8rem] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Mail size={14} /> {t('Send det med mail')}
        </a>

        {/* Who has not been thanked yet — the same list the Takkeliste shows,
            here as the addressing side of the card rather than a checklist. */}
        <div className="flex flex-col gap-3 border-t border-[#e6e9e5] pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#24413a]">
                {outstanding.length > 0
                  ? t('{n} mangler stadig en tak', { n: outstanding.length })
                  : t('Alle har fået tak')}
              </p>
              {outstanding.length > 0 && (
                <p className="mt-0.5 text-[12px] text-[#9a9686]">
                  {t('Navnene står som de skal skrives på kortet.')}
                </p>
              )}
            </div>
            {outstanding.length > 0 && (
              <button
                type="button"
                onClick={copyGreetings}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#d9ded9] px-3 py-1.5 text-[0.74rem] font-semibold text-[#24413a] transition-colors hover:border-[#24413a]"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? t('Kopieret') : t('Kopiér')}
              </button>
            )}
          </div>

          {outstanding.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {outstanding.slice(0, 8).map((r) => (
                <span key={r.key} className="rounded-full bg-[#f4f5f3] px-2.5 py-1 text-[0.74rem] text-[#5f6b66]">
                  {greetingFor(r.name, lang)}
                </span>
              ))}
              {outstanding.length > 8 && (
                <span className="px-1.5 py-1 text-[0.74rem] text-[#9a9686]">
                  {t('+{n} flere', { n: outstanding.length - 8 })}
                </span>
              )}
            </div>
          )}
        </div>
      </aside>
    </motion.section>
  );
}
