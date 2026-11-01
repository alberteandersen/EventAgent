// Which language Juno writes a vendor in. A venue reads its own language
// first, so the local one wins wherever it is unambiguous; English is the
// fallback for unknown countries and for multilingual ones (Belgium,
// Switzerland, Luxembourg) where guessing wrong is worse than writing in
// the common business language.
//
// Pure — no DB or network, so it stays unit-testable.

export interface OutreachLanguage {
  /** ISO-639-1 code, e.g. "da". */
  code: string;
  /** English name of the language — this is what the prompt is written in. */
  name: string;
  /** Which signal decided it (useful in the UI and when debugging). */
  source: "address" | "website" | "event" | "default";
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  da: "Danish",
  sv: "Swedish",
  nb: "Norwegian",
  fi: "Finnish",
  is: "Icelandic",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  cs: "Czech",
  el: "Greek",
  hu: "Hungarian",
  hr: "Croatian",
  ro: "Romanian",
  tr: "Turkish",
  et: "Estonian",
  lv: "Latvian",
  lt: "Lithuanian",
  sl: "Slovenian",
  sk: "Slovak",
  bg: "Bulgarian",
};

// Country → language. Aliases cover the English, local and Danish spellings,
// because Google Places returns the country in whatever locale it answered
// in and users type Danish names into the event location.
const COUNTRY_LANGUAGE: Record<string, string> = {
  denmark: "da", danmark: "da",
  sweden: "sv", sverige: "sv",
  norway: "nb", norge: "nb",
  finland: "fi", suomi: "fi",
  iceland: "is", island: "is", ísland: "is",
  germany: "de", deutschland: "de", tyskland: "de",
  austria: "de", österreich: "de", osterreich: "de", østrig: "de",
  france: "fr", frankrig: "fr",
  italy: "it", italia: "it", italien: "it",
  spain: "es", españa: "es", espana: "es", spanien: "es",
  portugal: "pt",
  netherlands: "nl", nederland: "nl", holland: "nl", nederlandene: "nl",
  poland: "pl", polska: "pl", polen: "pl",
  czechia: "cs", "czech republic": "cs", česko: "cs", tjekkiet: "cs",
  greece: "el", ελλάδα: "el", grækenland: "el", graekenland: "el",
  hungary: "hu", magyarország: "hu", ungarn: "hu",
  croatia: "hr", hrvatska: "hr", kroatien: "hr",
  romania: "ro", românia: "ro", rumænien: "ro",
  turkey: "tr", türkiye: "tr", turkiye: "tr", tyrkiet: "tr",
  estonia: "et", eesti: "et", estland: "et",
  latvia: "lv", latvija: "lv", letland: "lv",
  lithuania: "lt", lietuva: "lt", litauen: "lt",
  slovenia: "sl", slovenija: "sl", slovenien: "sl",
  slovakia: "sk", slovensko: "sk", slovakiet: "sk",
  bulgaria: "bg", българия: "bg", bulgarien: "bg",
  // Mapped to English explicitly so a later signal (a .it agency site, say)
  // can't pull an English-speaking country into another language.
  "united kingdom": "en", uk: "en", england: "en", scotland: "en", wales: "en",
  storbritannien: "en", ireland: "en", irland: "en",
  "united states": "en", "united states of america": "en", usa: "en", us: "en",
  canada: "en", australia: "en", australien: "en", "new zealand": "en",
  malta: "en", cyprus: "en", cypern: "en",
  // Deliberately absent: Belgium, Switzerland, Luxembourg — multilingual, so
  // they fall through to the English default rather than a coin flip.
};

const TLD_LANGUAGE: Record<string, string> = {
  dk: "da", se: "sv", no: "nb", fi: "fi", is: "is",
  de: "de", at: "de", fr: "fr", it: "it", es: "es", pt: "pt", nl: "nl",
  pl: "pl", cz: "cs", gr: "el", hu: "hu", hr: "hr", ro: "ro", tr: "tr",
  ee: "et", lv: "lv", lt: "lt", si: "sl", sk: "sk", bg: "bg",
  uk: "en", ie: "en",
};

const ENGLISH: OutreachLanguage = { code: "en", name: "English", source: "default" };

function named(code: string, source: OutreachLanguage["source"]): OutreachLanguage {
  return { code, name: LANGUAGE_NAMES[code] ?? "English", source };
}

/**
 * Language implied by the country in a formatted address or a location line.
 * Only the final comma-segment is considered — that is where Google puts the
 * country — and the lookup is exact, so Danish street names ("Danmarksgade
 * 5") can never be mistaken for a country.
 */
function languageForPlace(text: string | null | undefined): string | null {
  if (!text) return null;
  const segments = text.split(",");
  const last = segments[segments.length - 1]
    .trim()
    .replace(/[.\s]+$/, "")
    .toLowerCase();
  return COUNTRY_LANGUAGE[last] ?? null;
}

/** Language implied by a website's country-code TLD ("kro.dk" → Danish). */
function languageForWebsite(website: string | null | undefined): string | null {
  if (!website) return null;
  let host: string;
  try {
    host = new URL(website.includes("://") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
  const tld = host.toLowerCase().split(".").pop();
  return tld ? TLD_LANGUAGE[tld] ?? null : null;
}

/**
 * The language Juno should write this vendor in: the country on their address
 * first, then their website's ccTLD, then the couple's event location, and
 * English when nothing points anywhere.
 */
export function detectOutreachLanguage(args: {
  address?: string | null;
  website?: string | null;
  eventLocation?: string | null;
}): OutreachLanguage {
  const fromAddress = languageForPlace(args.address);
  if (fromAddress) return named(fromAddress, "address");

  const fromWebsite = languageForWebsite(args.website);
  if (fromWebsite) return named(fromWebsite, "website");

  const fromEvent = languageForPlace(args.eventLocation);
  if (fromEvent) return named(fromEvent, "event");

  return ENGLISH;
}
