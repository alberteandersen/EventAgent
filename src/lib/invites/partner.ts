import { randomBytes } from "crypto";

export { isPlausibleEmail } from "./email";

/* The partner invitation Ava sends from the Kalas mailbox.
 *
 * Composition lives here rather than in the route so the wording is testable
 * without a Gmail token, and so the two languages stay side by side where a
 * change to one is an obvious prompt to change the other. */

/** 32 chars of base64url — the whole security of the invite link. */
export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function inviteUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/invite/${token}`;
}

export interface PartnerInviteMessage {
  subject: string;
  body: string;
}

/**
 * What the partner reads. Since 0036 the link joins them to the same wedding,
 * so it says so: the same checklist, budget and guest list, changed by either
 * of them.
 *
 * `inviterName` is a first name; `partnerName` may be empty, in which case the
 * greeting stays unaddressed rather than guessing at "Hi partner".
 */
export function buildPartnerInvite({
  inviterName,
  partnerName,
  url,
  lang,
}: {
  inviterName: string;
  partnerName: string;
  url: string;
  lang: "da" | "en";
}): PartnerInviteMessage {
  const who = inviterName.trim() || (lang === "da" ? "Din partner" : "Your partner");
  const greetName = partnerName.trim();

  if (lang === "en") {
    return {
      subject: `${who} has started planning your wedding on Kalas`,
      body: [
        greetName ? `Hi ${greetName},` : "Hi,",
        "",
        `${who} has started planning your wedding in Kalas, one place for the timeline, the budget, the guest list, and me writing to the vendors.`,
        "",
        "Sign in here to plan it together:",
        url,
        "",
        "You will see the same wedding: the same checklist, budget and guest list, and whatever either of you changes, the other sees straight away.",
        "",
        "Warmly,",
        "Ava",
      ].join("\n"),
    };
  }

  return {
    subject: `${who} er gået i gang med jeres bryllup på Kalas`,
    body: [
      greetName ? `Hej ${greetName},` : "Hej,",
      "",
      `${who} er begyndt at planlægge jeres bryllup i Kalas, ét sted til tidslinjen, budgettet, gæstelisten og mig, der skriver til leverandørerne.`,
      "",
      "Log ind her, så planlægger I det sammen:",
      url,
      "",
      "I ser det samme bryllup: den samme tjekliste, det samme budget og den samme gæsteliste, og det én af jer ændrer, ser den anden med det samme.",
      "",
      "Kærlig hilsen",
      "Ava",
    ].join("\n"),
  };
}
