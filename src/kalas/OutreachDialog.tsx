"use client";

/* Contact ONE vendor. Ava composes the email in the vendor's own language,
   the couple reads and edits it, and only then does it go out, the same
   approve-before-send contract as the bulk flow, minus the batch. */

import { useEffect, useState } from 'react';
import { Check, Languages, Mail } from 'lucide-react';
import { Button, Dialog, Field, inputClass, textareaClass } from './ui';
import { useLang } from './i18n';
import { kalasSignatureHtml } from '@/lib/gmail/signature';

interface Prepared {
  toEmail: string;
  subject: string;
  body: string;
  language: { code: string; name: string; source: string };
}

/** Danish names for the languages Ava writes in; the English name rides along
 *  on prepared.language.name, so the badge is localized without a second map. */
const LANG_DA: Record<string, string> = {
  en: 'engelsk', da: 'dansk', sv: 'svensk', nb: 'norsk', fi: 'finsk',
  is: 'islandsk', de: 'tysk', fr: 'fransk', it: 'italiensk', es: 'spansk',
  pt: 'portugisisk', nl: 'hollandsk', pl: 'polsk', cs: 'tjekkisk',
  el: 'græsk', hu: 'ungarsk', hr: 'kroatisk', ro: 'rumænsk', tr: 'tyrkisk',
  et: 'estisk', lv: 'lettisk', lt: 'litauisk', sl: 'slovensk',
  sk: 'slovakisk', bg: 'bulgarsk',
};

/** Server error codes → a Danish source string t() can localize. Keeps the
 *  API language-agnostic: it returns a stable code, the client translates. */
const ERROR_BY_CODE: Record<string, string> = {
  no_contact_email:
    'Ava kunne ikke finde en mailadresse til leverandøren. Tilføj den manuelt og prøv igen.',
  already_contacted: 'Ava har allerede skrevet til denne leverandør.',
  outreach_unavailable: 'Avas postkasse er ved at blive sat op, prøv igen om lidt.',
};

export default function OutreachDialog({
  venueId,
  venueName,
  onClose,
  onSent,
}: {
  venueId: string;
  venueName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t, lang } = useLang();
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefer our own localized copy for known error codes; fall back to the
  // server's message, then a generic line.
  const messageForError = (data: { error?: string; message?: string }, fallback: string) => {
    const known = data.error && ERROR_BY_CODE[data.error];
    if (known) return t(known);
    return data.message ?? t(fallback);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/venues/${venueId}/outreach/prepare`, { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(messageForError(data, 'Ava kunne ikke skrive henvendelsen.'));
          return;
        }
        setPrepared(data as Prepared);
        setSubject(data.subject);
        setBody(data.body);
      } catch {
        if (!cancelled) setError(t('Noget gik galt, prøv igen.'));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/venues/${venueId}/outreach/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(messageForError(data, 'Kunne ikke sende, prøv igen.'));
        return;
      }
      setSent(true);
      onSent();
      setTimeout(onClose, 1400);
    } catch {
      setError(t('Kunne ikke sende, prøv igen.'));
    } finally {
      setSending(false);
    }
  };

  // Language the email was written in, named in the app's language: the Danish
  // map in DA, the canonical English name (already on the payload) in EN.
  const langLabel = prepared
    ? lang === 'da'
      ? LANG_DA[prepared.language.code] ?? prepared.language.name.toLowerCase()
      : prepared.language.name
    : null;

  const errorBox = error && (
    <p role="alert" className="rounded-[14px] bg-terracotta-tint/60 px-4 py-3 text-sm text-terracotta">{error}</p>
  );

  return (
    <Dialog
      open
      // Nothing closes it while the email is on its way.
      onClose={() => { if (!sending) onClose(); }}
      size="lg"
      eyebrow={t('Ava skriver til')}
      title={venueName}
      description={prepared && (
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5"><Mail size={12} aria-hidden /> {prepared.toEmail}</span>
          {langLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage-wash px-2 py-0.5 text-ink">
              <Languages size={12} aria-hidden /> {t('Skrevet på {sprog}', { sprog: langLabel })}
            </span>
          )}
        </span>
      )}
      footer={
        <>
          <p className="mr-auto text-xs text-muted">{t('Svar lander i jeres henvendelser.')}</p>
          <Button variant="ghost" onClick={onClose} disabled={sending}>{t('Annuller')}</Button>
          <Button
            variant={sent ? 'secondary' : 'primary'}
            icon={sent ? Check : undefined}
            onClick={() => void send()}
            disabled={!prepared || sending || sent || !subject.trim() || !body.trim()}
          >
            {sent ? t('Sendt') : sending ? t('Sender…') : t('Godkend & send')}
          </Button>
        </>
      }
    >
      {!prepared && !error && (
        <div className="space-y-3 py-8 text-center">
          <div className="mx-auto h-1.5 w-24 animate-pulse rounded-full bg-line-soft" />
          <p className="text-sm text-muted">{t('Ava skriver henvendelsen…')}</p>
        </div>
      )}

      {!prepared && errorBox}

      {prepared && (
        <div className="space-y-4">
          <Field label={t('Emne')}>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} disabled={sending || sent} className={inputClass} />
          </Field>
          <Field label={t('Besked')}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={sending || sent} rows={14}
              className={`${textareaClass} resize-y`} />
          </Field>
          {/* Appended at send time, so it can't be edited away by accident.
              Rendered from the same constant the mail is built from. */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-soft">{t('Signatur · tilføjes automatisk')}</span>
            <div
              className="rounded-xl border border-dashed border-line bg-card px-3 py-3"
              dangerouslySetInnerHTML={{ __html: kalasSignatureHtml() }}
            />
          </div>
          {errorBox}
        </div>
      )}
    </Dialog>
  );
}
