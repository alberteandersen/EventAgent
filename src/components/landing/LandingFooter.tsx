import Link from "next/link";
import { BlurFade } from "@/components/ui/blur-fade";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Venues", href: "#features" },
      { label: "Quotes", href: "#features" },
      { label: "Budget", href: "#features" },
      { label: "Guests", href: "#features" },
      { label: "Website", href: "#features" },
      { label: "Timeline", href: "#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Wedding guides (Danish)", href: "/guide" },
      { label: "Checklist", href: "/guide/bryllup-tjekliste" },
      { label: "Wedding budget", href: "/guide/hvad-koster-et-bryllup" },
      { label: "FAQ", href: "/guide/faq" },
    ],
  },
];

/* Only pages that exist. About, contact, legal and social links come back when
   there is a page or a profile to send people to: a footer of 404s tells
   search engines and couples alike that the site is unfinished. */

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <BlurFade inView className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <Link
              href="/"
              className="font-[family-name:var(--font-wordmark)] text-[1.6rem] font-bold leading-none text-ink"
            >
              kalas
            </Link>
            <p className="mt-3 max-w-[14rem] text-sm leading-relaxed text-velvet-muted">
              Ava plans your wedding. You make the decisions.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-medium uppercase tracking-[1.5px] text-accent">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-velvet-muted transition hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-border pt-8">
          <span className="text-xs text-velvet-soft">
            © {new Date().getFullYear()} Kalas. All rights reserved.
          </span>
        </div>
      </BlurFade>
    </footer>
  );
}
