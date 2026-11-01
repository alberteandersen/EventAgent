"use client";

/* Settings, in the app's own look and language. The server page gathers what
   only it can read (the admin mailbox, the partner's name) and hands it here,
   so everything the couple reads goes through t() and the shared primitives. */

import { ArrowLeft } from "lucide-react";
import { LanguageProvider, useLang } from "@/kalas/i18n";
import { Button, Card, ConfirmProvider, Page, PageHeader, SectionTitle } from "@/kalas/ui";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { AppLanguage } from "@/lib/db/types";
import { EmailNotificationsSetting } from "./EmailNotificationsSetting";
import { LanguageSetting } from "./LanguageSetting";
import { PlanTogetherSetting, type CoupleMember } from "./PlanTogetherSetting";
import { RedoOnboardingButton } from "./RedoOnboardingButton";
import { WeddingDetailsSetting } from "./WeddingDetailsSetting";

type WeddingDetails = React.ComponentProps<typeof WeddingDetailsSetting>["initial"];

export interface SettingsProps {
  lang: AppLanguage;
  email: string | null;
  notifications: boolean;
  wedding: WeddingDetails | null;
  members: CoupleMember[];
  pendingEmail: string | null;
  /** Only for the platform admins who connect the outreach mailbox. */
  platform: { connected: boolean; email: string | null } | null;
  flash: { connected?: boolean; gmailError?: string };
}

export function SettingsScreen(props: SettingsProps) {
  return (
    <LanguageProvider initialLang={props.lang}>
      <ConfirmProvider>
        <main className="theme-kalas min-h-screen w-full bg-canvas font-sans text-ink">
          <Settings {...props} />
        </main>
      </ConfirmProvider>
    </LanguageProvider>
  );
}

function Row({ title, children, action }: { title: string; children: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-meta text-muted">{children}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function Settings({ lang, email, notifications, wedding, members, pendingEmail, platform, flash }: SettingsProps) {
  const { t } = useLang();
  return (
    <Page narrow>
      <PageHeader
        title={t("Indstillinger")}
        actions={<Button variant="secondary" icon={ArrowLeft} href="/home">{t("Tilbage til Kalas")}</Button>}
      />

      {flash.connected && (
        <p role="status" className="rounded-xl bg-sage-wash px-4 py-3 text-sm text-success">
          {t("Kalas-postkassen er forbundet.")}
        </p>
      )}
      {flash.gmailError && (
        <p role="alert" className="rounded-xl bg-terracotta-wash px-4 py-3 text-sm text-terracotta">
          {t("Postkassen blev ikke forbundet ({error}). Prøv igen.", { error: flash.gmailError })}
        </p>
      )}

      {wedding && <WeddingDetailsSetting lang={lang} initial={wedding} />}

      {wedding && (
        <div id="partner" className="scroll-mt-6">
          <PlanTogetherSetting lang={lang} members={members} pendingEmail={pendingEmail} />
        </div>
      )}

      <Card className="flex flex-col gap-5">
        <SectionTitle
          title={t("Henvendelser til leverandører")}
          subtitle={t("Juno skriver til steder og leverandører fra sin egen Kalas-postkasse; intet sendes fra jeres egen mail. Hver samtale lander under Henvendelser, og I godkender hvert svar, før det går af sted.")}
        />
        <div className="border-t border-line pt-5">
          <Row title={t("Mails om nye svar")} action={<EmailNotificationsSetting initial={notifications} />}>
            {t("Juno skriver til dig, når en leverandør har svaret, så du ikke skal holde øje med indbakken.")}
          </Row>
        </div>
      </Card>

      {platform && (
        <Card className="flex flex-col gap-4">
          <SectionTitle
            title={t("Kalas-postkassen")}
            subtitle={t("Kun for administratorer: den Gmail-konto, Juno sender fra og læser svar i.")}
          />
          <div className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-ink">
              <span aria-hidden className={`size-2 rounded-full ${platform.connected ? "bg-success" : "bg-line-strong"}`} />
              {platform.connected
                ? platform.email ? t("Forbundet som {email}", { email: platform.email }) : t("Forbundet")
                : t("Ikke forbundet")}
            </span>
            <Button size="sm" variant={platform.connected ? "secondary" : "primary"} href="/api/admin/gmail/connect">
              {platform.connected ? t("Forbind igen") : t("Forbind postkassen")}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <Row title={t("Sprog")} action={<LanguageSetting initial={lang} />}>
          {t("Sproget i appen og i Junos svar.")}
        </Row>
      </Card>

      <Card className="flex flex-col gap-5">
        <Row title={t("Onboarding")} action={<RedoOnboardingButton />}>
          {t("Kør interviewet helt forfra, fx for at skifte stil. Navne, dato og sted kan I rette under Bryllupet ovenfor.")}
        </Row>
        <div className="border-t border-line pt-5">
          <Row title={t("Rundvisning")} action={<Button variant="secondary" href="/home?walkthrough=1">{t("Vis mig rundt igen")}</Button>}>
            {t("Juno viser jer rundt på siderne igen. Intet bliver nulstillet.")}
          </Row>
        </div>
      </Card>

      <Card>
        <Row title={t("Konto")} action={
          <SignOutButton className="inline-flex h-9 cursor-pointer items-center rounded-full border border-line bg-card px-4 text-meta font-semibold text-ink transition-colors hover:bg-shell disabled:opacity-50">
            {t("Log ud")}
          </SignOutButton>
        }>
          {email ? t("Logget ind som {email}", { email }) : t("Logget ind")}
        </Row>
      </Card>
    </Page>
  );
}
