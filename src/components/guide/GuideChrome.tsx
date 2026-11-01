import Link from "next/link";
import { ARTICLES, CATEGORIES } from "@/content/guide";
import { PRIVACY_POLICY_LIVE } from "@/lib/legal";
import { CtaLink, Eyebrow, SIGNUP_HREF, Wordmark } from "./kalas";

export function GuideNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" aria-label="Kalas forside">
          <Wordmark />
        </Link>
        <nav aria-label="Guide" className="flex items-center gap-1 sm:gap-2">
          <Link href="/guide" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-shell hover:text-ink">
            Guides
          </Link>
          <Link href="/guide/faq" className="rounded-full px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-shell hover:text-ink">
            FAQ
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="ml-1 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-[#f8f9f8] transition-colors hover:bg-[#1b322c]"
          >
            Prøv gratis
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function GuideFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-[#f0f1ec]">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="flex flex-col items-start gap-4">
          <Link href="/" aria-label="Kalas forside">
            <Wordmark />
          </Link>
          <p className="max-w-[16rem] text-sm leading-relaxed text-ink-soft">
            Juno planlægger jeres bryllup. I træffer beslutningerne.
          </p>
          <CtaLink className="mt-1">Prøv Kalas gratis</CtaLink>
        </div>
        <FooterColumn title="Emner" links={CATEGORIES.map((c) => ({ label: c.name, href: `/guide#${c.id}` }))} />
        <FooterColumn title="Populære guides" links={ARTICLES.slice(0, 5).map((a) => ({ label: a.title.split(/[:?]/)[0], href: `/guide/${a.slug}` }))} />
        <FooterColumn
          title="Kalas"
          links={[
            { label: "Forside", href: "/" },
            { label: "Alle guides", href: "/guide" },
            { label: "Spørgsmål og svar", href: "/guide/faq" },
            { label: "Log ind", href: SIGNUP_HREF },
          ]}
        />
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-6 text-xs text-muted sm:px-6">
        <span>© {new Date().getFullYear()} Kalas</span>
        {PRIVACY_POLICY_LIVE && (
          <Link href="/privatliv" className="transition-colors hover:text-ink">
            Privatlivspolitik
          </Link>
        )}
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-ink-soft transition-colors hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
