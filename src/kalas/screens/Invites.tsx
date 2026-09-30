'use client';

/* Invitationer — a printed card, designed with Ava. Pick a vibe (its own
   painting and typography, instantly), write what the card says, pick the
   paper, tell Ava how it should feel, and she paints and sets a card of
   their own. Change it by asking, step back through versions, and take it
   to Canva as an editable file, or as a print-ready PNG.

   The look is invitation_designs (a CardSpec per version); what the card
   says is the invitation row's data, autosaved as the couple types. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWedding } from '../useWedding';
import { useLang } from '../i18n';
import { PageHeader, PageLoader, useConfirm } from '../ui';
import { createClient } from '@/lib/supabase/client';
import { settleJob } from '@/lib/jobs/client';
import { normalizeImage } from '../site/normalizeImage';
import type { SitePhotoRow } from '@/lib/db/types';
import { parseInviteContent, type InviteContent } from '../invitations/content';
import { CardView } from '../invitations/card/CardView';
import { findFormat, type CardFormatId } from '../invitations/card/formats';
import { findVibe, starterSpec } from '../invitations/card/vibes';
import { parseCardSpec, type CardSpec } from '../invitations/card/spec';
import { cardFileName, exportCardPng, exportCardPptx } from '../invitations/card/exportCard';
import CardSteps, { type CardStep } from '../invitations/CardSteps';

export default function Invites() {
  const { t } = useLang();
  const confirm = useConfirm();
  const {
    loading, couple, profile, event, venues, invitations, saveInvitation,
    invitationDesigns, invitationDesign, websitePaid, refresh, sitePhotos,
  } = useWedding();

  const invitation = invitations[0] ?? null;
  const venue = venues.find((v) => v.id === event?.chosen_venue_id) ?? null;

  /* ── What the card says ─────────────────────────────────────────────── */
  const fallback = useMemo<Partial<InviteContent>>(() => ({
    partnerA: couple.a,
    partnerB: couple.b,
    date: couple.dateISO ?? '',
    venue: venue?.name ?? '',
    language: profile?.language === 'en' ? 'en' : 'da',
  }), [couple.a, couple.b, couple.dateISO, venue?.name, profile?.language]);

  // What is saved, read over the wedding's own facts, until the couple types;
  // from their first edit on, their copy is the one shown and saved.
  const saved = useMemo(
    () => (loading ? null : parseInviteContent(invitation?.data, fallback)),
    [loading, invitation?.data, fallback],
  );
  const [edits, setEdits] = useState<InviteContent | null>(null);
  const content = edits ?? saved;

  const idRef = useRef<string | undefined>(invitation?.id);
  useEffect(() => {
    if (invitation?.id) idRef.current = invitation.id;
  }, [invitation?.id]);
  const saveContent = useCallback(async (c: InviteContent) => {
    const row = await saveInvitation({ id: idRef.current, data: { ...c } });
    if (row) idRef.current = row.id;
  }, [saveInvitation]);
  // Autosave, debounced; only their edits, never the read.
  useEffect(() => {
    if (!edits) return;
    const id = setTimeout(() => { void saveContent(edits); }, 700);
    return () => clearTimeout(id);
  }, [edits, saveContent]);
  const patchContent = useCallback((patch: Partial<InviteContent>) => {
    setEdits((c) => {
      const base = c ?? saved;
      return base ? { ...base, ...patch } : c;
    });
  }, [saved]);

  /* ── The design ─────────────────────────────────────────────────────── */
  const language = content?.language ?? 'da';
  const spec: CardSpec | null = useMemo(() => {
    if (!invitationDesign) return null;
    const raw = invitationDesign.design as { vibe?: string; format?: string };
    return parseCardSpec(raw, starterSpec(findVibe(raw.vibe), findFormat(raw.format), language));
  }, [invitationDesign, language]);
  const designs = useMemo(
    () => [...invitationDesigns].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [invitationDesigns],
  );

  // Ava's painting lives in private storage; a member can sign it.
  const supabase = useMemo(() => createClient(), []);
  const [signed, setSigned] = useState<{ path: string; url: string } | null>(null);
  const artPath = spec?.art.path ?? null;
  useEffect(() => {
    if (!artPath) return;
    let alive = true;
    void supabase.storage.from('invite-designs').createSignedUrl(artPath, 3600).then(({ data }) => {
      if (alive && data?.signedUrl) setSigned({ path: artPath, url: data.signedUrl });
    });
    return () => { alive = false; };
  }, [artPath, supabase]);
  const artUrl = artPath ? (signed?.path === artPath ? signed.url : null) : spec?.art.sample ?? null;

  /* ── Their photos, for a card with one (shared with the website) ───── */
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const photoKey = sitePhotos.map((p) => p.id).join(',');
  useEffect(() => {
    if (!event) return;
    let alive = true;
    fetch(`/api/website/photos?eventId=${event.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { photos?: (SitePhotoRow & { url: string | null })[] } | null) => {
        if (!alive || !d?.photos) return;
        setPhotoUrls(Object.fromEntries(d.photos.filter((p) => p.url).map((p) => [p.id, p.url as string])));
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, photoKey]);
  const photos = sitePhotos
    .filter((p) => p.role !== 'section' && photoUrls[p.id])
    .map((p) => ({ id: p.id, url: photoUrls[p.id] }));
  const photoUrl = content?.photoId ? photoUrls[content.photoId] ?? null : null;

  const [uploading, setUploading] = useState(false);
  const uploadPhotos = async (files: FileList | File[]) => {
    if (!event) return;
    setUploading(true);
    try {
      for (const raw of Array.from(files)) {
        // HEIC (iPhone) and oversized photos are re-encoded in the browser.
        const file = await normalizeImage(raw);
        if (!file) { setGenError(t('Billedet kunne ikke uploades. Prøv et andet format.')); continue; }
        const form = new FormData();
        form.append('file', file);
        form.append('eventId', event.id);
        const res = await fetch('/api/website/photos', { method: 'POST', body: form }).catch(() => null);
        // The card takes the photo they just added.
        const row = res?.ok ? ((await res.json().catch(() => null)) as { photo?: { id?: string } } | null) : null;
        if (row?.photo?.id) patchContent({ photoId: row.photo.id });
      }
      await refresh();
    } finally {
      setUploading(false);
    }
  };

  const [step, setStep] = useState<CardStep | null>(null);
  const [briefDraft, setBriefDraft] = useState<string | null>(null);
  const savedBrief = useMemo(
    () => designs.map((d) => (d.brief as { styleDirection?: string } | null)?.styleDirection)
      .find((s): s is string => Boolean(s)) ?? '',
    [designs],
  );

  const [working, setWorking] = useState<null | 'generate' | 'refine'>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [needsPayment, setNeedsPayment] = useState(false);

  /** Resolves true when Ava's card landed and the wedding reloaded. */
  const callAva = async (path: string, body: Record<string, unknown>, kind: 'generate' | 'refine') => {
    if (!event) return false;
    setWorking(kind);
    setGenError(null);
    try {
      // Ava reads the saved words, so an edit still waiting to save goes first.
      if (edits) await saveContent(edits);
      const res = await fetch(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, ...body }),
      });
      if (res.status === 402) { setNeedsPayment(true); return false; }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        setGenError(data.message ?? data.error ?? 'Noget gik galt. Prøv igen.');
        return false;
      }
      // In production the card is made as a background job; wait for it.
      const outcome = await settleJob(res);
      if (!outcome.ok) {
        setGenError(outcome.error ?? 'Noget gik galt. Prøv igen.');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setGenError('Noget gik galt. Prøv igen.');
      return false;
    } finally {
      setWorking(null);
    }
  };

  const [applying, setApplying] = useState<string | null>(null);
  const applyVibe = async (vibe: string, format: CardFormatId) => {
    if (!event || applying) return;
    setApplying(vibe);
    setGenError(null);
    try {
      await fetch('/api/invitations/design/preset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id, vibe, format }),
      });
      await refresh();
    } finally {
      setApplying(null);
    }
  };

  const activate = async (designId: string) => {
    await fetch('/api/invitations/design/activate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designId }),
    }).catch(() => {});
    await refresh();
  };

  const [restarting, setRestarting] = useState(false);
  const restart = async () => {
    if (!event || restarting) return;
    if (!(await confirm({
      title: t('Start forfra?'),
      body: t('Alle versioner af kortet og Avas malerier slettes. Kortets ord beholdes.'),
      confirmLabel: t('Start forfra'),
      danger: true,
    }))) return;
    setRestarting(true);
    setGenError(null);
    try {
      const res = await fetch('/api/invitations/design/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: event.id }),
      });
      if (!res.ok) { setGenError('Kunne ikke starte forfra. Prøv igen.'); return; }
      setStep('vibe');
      await refresh();
    } finally {
      setRestarting(false);
    }
  };

  const checkout = async () => {
    if (!event) return;
    const res = await fetch('/api/website/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: event.id }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { url?: string; error?: string }) : {};
    if (data.url) { window.location.href = data.url; return; }
    // Paid already: the webhook beat us here, so just pick the order up.
    if (res?.status === 409) { await refresh(); setNeedsPayment(false); return; }
    setGenError(t('Betalingen kunne ikke startes. Prøv igen om lidt.'));
  };

  const [exporting, setExporting] = useState<null | 'pptx' | 'png'>(null);
  const exportCard = async (kind: 'pptx' | 'png') => {
    if (!spec || !content || exporting) return;
    setExporting(kind);
    setGenError(null);
    try {
      const job = { spec, content, artUrl, photoUrl, fileName: cardFileName(content) };
      await (kind === 'pptx' ? exportCardPptx(job) : exportCardPng(job));
      if (invitation?.status !== 'published') {
        const row = await saveInvitation({ id: idRef.current, data: { ...content }, publish: true });
        if (row) idRef.current = row.id;
      }
    } catch {
      setGenError('Kortet kunne ikke hentes. Prøv igen.');
    } finally {
      setExporting(null);
    }
  };

  if (loading || !content) return <PageLoader />;

  const landscape = spec?.format === '7x5';

  return (
    <div className="min-h-full">
      {/* The card and the steps run edge to edge below, so the header carries
          the page's gutters itself. */}
      <div className="px-6 pt-8 sm:px-9 lg:px-12">
        <PageHeader
          title={t('Invitationer')}
          subtitle={t('Vælg en stemning, skriv jeres ord, og lad Ava male et kort kun til jer. Hent det til Canva, hvor alt kan rettes.')}
          guide="invites"
        />
      </div>

    <div className="grid lg:grid-cols-[1fr_440px]">
      {/* The card, as it prints */}
      <div className="px-6 sm:px-9 lg:rule-r lg:px-12">
        <div className="sticky top-6 flex justify-center py-8 lg:py-12">
          <div className={landscape ? 'w-full max-w-[620px]' : 'w-full max-w-[440px]'}>
            {spec ? (
              <div className="overflow-hidden rounded-[3px] shadow-[0_30px_60px_-28px_rgba(40,30,20,0.45),0_2px_6px_rgba(40,30,20,0.08)]">
                <CardView spec={spec} content={content} artUrl={artUrl} photoUrl={photoUrl}
                  photoHint={t('Vælg et billede under Indhold')} title={t('Jeres invitationskort')} />
              </div>
            ) : (
              <div className="flex aspect-[5/7] items-center justify-center rounded-[3px] rule bg-shell px-10 text-center text-[0.85rem] leading-relaxed text-muted">
                {t('Vælg en stemning, så står jeres kort her.')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ava, one step at a time */}
      <div className="border-t-[0.5px] border-line px-6 py-10 sm:px-9 lg:border-t-0 lg:py-12">
        <CardSteps
          step={step}
          onStep={setStep}
          brief={briefDraft ?? savedBrief}
          onBrief={setBriefDraft}
          content={content}
          onContent={patchContent}
          spec={spec}
          designs={designs}
          activeId={invitationDesign?.id ?? null}
          working={working}
          applying={applying}
          restarting={restarting}
          exporting={exporting}
          genError={genError}
          needsPayment={needsPayment}
          websitePaid={websitePaid}
          onVibe={(vibe, format) => void applyVibe(vibe, format)}
          onBuild={(brief, format) => callAva('/api/invitations/design', { styleDirection: brief, format: format ?? spec?.format }, 'generate')}
          onRefine={(instruction) => void callAva('/api/invitations/design/refine', { instruction }, 'refine')}
          onActivate={(id) => void activate(id)}
          onRestart={() => void restart()}
          onCheckout={() => void checkout()}
          onExport={(kind) => void exportCard(kind)}
          photos={photos}
          photoUrl={photoUrl}
          uploading={uploading}
          onUpload={uploadPhotos}
        />
      </div>
    </div>
    </div>
  );
}
