import Link from "next/link";
import { PRIVACY_POLICY_LIVE } from "@/lib/legal";

const columns = [
  {
    title: "På siden",
    links: [
      { label: "Sådan arbejder Juno", href: "#arbejde" },
      { label: "Steder", href: "#steder" },
      { label: "Fra ja til tak", href: "#resten" },
      { label: "I bestemmer", href: "#vilkaar" },
    ],
  },
  {
    title: "Guides",
    links: [
      { label: "Alle bryllupsguides", href: "/guide" },
      { label: "Tjekliste", href: "/guide/bryllup-tjekliste" },
      { label: "Hvad koster et bryllup?", href: "/guide/hvad-koster-et-bryllup" },
      { label: "Spørgsmål og svar", href: "/guide/faq" },
    ],
  },
];

/* Only pages that exist. About, contact and social links come back when there
   is a page or a profile to send people to. */
export function LandingFooter() {
  return (
    <footer data-ground="laurel" className="bg-laurel-deep text-on-laurel">
      <div className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Kalas" className="font-[family-name:var(--font-wordmark)] text-[1.6rem] font-bold leading-none">
              kalas
            </Link>
            <p className="mt-3 max-w-[16rem] text-sm leading-relaxed text-on-laurel-soft">
              Juno planlægger jeres bryllup. I træffer beslutningerne.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="font-serif text-lg font-semibold">{col.title}</p>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-on-laurel-soft transition-colors hover:text-on-laurel">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-on-laurel/15 pt-8 text-xs text-on-laurel-soft">
          <span>© {new Date().getFullYear()} Kalas</span>
          {PRIVACY_POLICY_LIVE && (
            <Link href="/privatliv" className="transition-colors hover:text-on-laurel">
              Privatlivspolitik
            </Link>
          )}
        </div>
      </div>
    </footer>
  );
}
