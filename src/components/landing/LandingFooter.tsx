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
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Press", href: "/press" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Planning guides", href: "/guides" },
      { label: "Blog", href: "/blog" },
      { label: "Help center", href: "/help" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
    ],
  },
];

const social = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "X", href: "https://x.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <BlurFade inView className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
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
            <Link
              href="/vendors"
              className="mt-4 inline-block text-sm font-medium text-ink hover:text-ink-hover"
            >
              Vendor portal →
            </Link>
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

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <span className="text-xs text-velvet-soft">
            © {new Date().getFullYear()} Kalas. All rights reserved.
          </span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-velvet-muted transition hover:text-ink"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </BlurFade>
    </footer>
  );
}
