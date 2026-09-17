import Link from "next/link";
import { ArrowRight } from "lucide-react";

/* The guide in the app's own look (docs/DESIGN_SYSTEM.md): ivory canvas,
   forest ink, sage labels, 28px cards on a hairline. Server-side copies of
   the few app primitives the guide needs, so a public page does not pull in
   the app shell's client bundle. */

export const serif = "font-serif";
export const card = "rounded-[28px] border border-line bg-card";
export const eyebrowClass = "text-xs font-bold uppercase tracking-[0.22em]";

/** Where every call to action goes: sign-in, then onboarding. */
export const SIGNUP_HREF = "/login";

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`text-[1.75rem] leading-none ${light ? "text-[#fffdf7]" : "text-ink"}`}
      style={{ fontFamily: "var(--font-wordmark)", fontWeight: 700, letterSpacing: 0 }}
    >
      Kalas
    </span>
  );
}

export function Eyebrow({
  children,
  light = false,
  className = "",
  id,
}: {
  children: React.ReactNode;
  /** On forest green. */
  light?: boolean;
  className?: string;
  id?: string;
}) {
  return <p id={id} className={`${eyebrowClass} ${light ? "text-[#a9c2b6]" : "text-sage"} ${className}`}>{children}</p>;
}

/** The forest-green pill the app uses for its own primary actions. */
export function CtaLink({
  children,
  href = SIGNUP_HREF,
  light = false,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  light?: boolean;
  className?: string;
}) {
  const tone = light
    ? "bg-[#f8f9f8] text-ink hover:bg-white"
    : "bg-ink text-[#f8f9f8] hover:bg-[#1b322c]";
  return (
    <Link
      href={href}
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-colors ${tone} ${className}`}
    >
      {children}
      <ArrowRight size={15} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** The circle-and-arrow at the end of a row or card. */
export function ArrowDot() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-[#f8f9f8]"
    >
      <ArrowRight size={14} />
    </span>
  );
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
