/* What the privacy policy (/privatliv) needs from the company and its lawyer.
   The policy goes live, and the links to it appear, only when every field is
   set and a lawyer has read the page: a policy that names no controller, or
   guesses at a legal basis, is worse than none. The text itself lives in
   src/app/privatliv/page.tsx, drafted from docs/privatlivspolitik-udkast.md. */

export const PRIVACY = {
  /** The legal entity, e.g. "Kalas ApS". */
  company: null as string | null,
  cvr: null as string | null,
  address: null as string | null,
  /** Where people write about their data. Not Juno's outgoing mailbox. */
  email: null as string | null,
  /** The Supabase project's region, e.g. "EU (Frankfurt)". */
  databaseRegion: null as string | null,
  /** How long data is kept, as a sentence, e.g. "Så længe kontoen findes og
   *  12 måneder efter brylluppet. Regnskabsdata i 5 år efter bogføringsloven." */
  retention: null as string | null,
  /** How a couple deletes their account, and how a guest gets their details deleted. */
  deletion: null as string | null,
  /** The lawyer's answer: who is controller for the guests' details, the couple, Kalas or both. */
  guestDataRole: null as string | null,
  /** The lawyer's answer: the legal basis for guests' allergies and diets (GDPR art. 9). */
  guestHealthBasis: null as string | null,
  /** The lawyer's answer: the basis for transfers to the US (Data Privacy Framework, SCCs). */
  transferBasis: null as string | null,
  /** Set once a lawyer has read the page as it renders. */
  reviewed: false,
};

export const PRIVACY_POLICY_LIVE = PRIVACY.reviewed && Object.values(PRIVACY).every(Boolean);
