'use client';

/* Every shared primitive on one page (src/kalas/ui), to check them against
   each other and at phone width. ?dialog=1 opens the dialog on load. */

import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck, Globe, Heart, Inbox, Plus, Trash2, Users } from 'lucide-react';
import { LanguageProvider } from '@/kalas/i18n';
import {
  Button, Card, ConfirmProvider, Dialog, EmptyState, ErrorState, Field, IconButton, Loader, Page,
  PageHeader, SectionTitle, Skeleton, Stat, Tabs, inputClass, textareaClass, useConfirm,
} from '@/kalas/ui';

function Gallery() {
  const params = useSearchParams();
  const [tab, setTab] = useState<'explore' | 'shortlist' | 'booked'>('explore');
  const [open, setOpen] = useState(params.get('dialog') === '1');
  const [answer, setAnswer] = useState<string | null>(null);
  const confirm = useConfirm();

  return (
    <Page>
      <PageHeader
        title="Venue & leverandører"
        subtitle="Find, gem og book stederne. Ava skriver til dem for jer."
        guide="team"
        actions={<><Button variant="secondary" icon={Users}>Invitér</Button><Button icon={Plus}>Tilføj</Button></>}
      >
        <Tabs
          label="Leverandører"
          value={tab}
          onChange={setTab}
          items={[
            { id: 'explore', label: 'Udforsk', icon: Globe },
            { id: 'shortlist', label: 'Favoritter', icon: Heart, badge: 4 },
            { id: 'booked', label: 'Booket', icon: CalendarCheck, alert: 'Noget mangler' },
          ]}
        />
      </PageHeader>

      <section className="flex flex-col gap-4">
        <SectionTitle title="Knapper" subtitle="Primær, sekundær, diskret og farlig, i to størrelser." />
        <div className="flex flex-wrap items-center gap-2">
          <Button>Gem ændringer</Button>
          <Button variant="secondary">Annuller</Button>
          <Button variant="ghost">Spring over</Button>
          <Button variant="danger" icon={Trash2}>Slet</Button>
          <Button disabled>Deaktiveret</Button>
          <IconButton icon={Trash2} label="Slet" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Gem</Button>
          <Button size="sm" variant="secondary">Annuller</Button>
          <Button size="sm" variant="ghost">Mere</Button>
          <Button size="sm" variant="danger">Slet</Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card><Stat label="Gæster" value="84" hint="12 mangler svar" /></Card>
        <Card><Stat label="Budget brugt" value="62%" /></Card>
        <Card><Stat label="Dage tilbage" value="118" /></Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <SectionTitle title="Felter" />
          <Field label="Navn"><input className={inputClass} placeholder="Fx Emma Hansen" /></Field>
          <Field label="E-mail" error="Den adresse ser forkert ud"><input className={inputClass} defaultValue="emma@" /></Field>
          <Field label="Note" hint="Kun I kan se den."><textarea className={textareaClass} rows={3} /></Field>
        </Card>
        <Card className="flex flex-col gap-4">
          <SectionTitle title="Ventetid" />
          <Loader />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </Card>
      </section>

      <EmptyState icon={Inbox} title="Ingen svar endnu" action={<Button variant="secondary">Find steder</Button>}>
        Når Ava har skrevet til et sted, lander svaret her.
      </EmptyState>
      <ErrorState onRetry={() => setAnswer('retry')} />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setOpen(true)}>Åbn dialog</Button>
        <Button
          variant="secondary"
          onClick={async () => setAnswer(String(await confirm({ title: 'Slet gæsten?', body: 'Det kan ikke fortrydes.', confirmLabel: 'Slet', danger: true })))}
        >
          Bekræft
        </Button>
        {answer && <span data-testid="answer" className="self-center text-meta text-muted">{answer}</span>}
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Opgave"
        title="Book fotograf"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Annuller</Button><Button onClick={() => setOpen(false)}>Gem ændringer</Button></>}
      >
        <div className="flex flex-col gap-4">
          <Field label="Titel"><input className={inputClass} defaultValue="Book fotograf" data-autofocus /></Field>
          <Field label="Noter"><textarea className={textareaClass} rows={4} /></Field>
        </div>
      </Dialog>
    </Page>
  );
}

function Harness() {
  return (
    <LanguageProvider initialLang="da" lock>
      <ConfirmProvider>
        <div className="theme-kalas min-h-screen bg-canvas font-sans text-ink">
          <Suspense><Gallery /></Suspense>
        </div>
      </ConfirmProvider>
    </LanguageProvider>
  );
}

export default dynamic(() => Promise.resolve(Harness), { ssr: false });
