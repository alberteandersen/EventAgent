/**
 * Runs Ava's card design and painting for real, without a wedding, and
 * writes the result where /dev/invite-cards?try=1 shows it:
 * public/invitations/dev-try.{json,png}. Dev only; the files are ignored.
 *
 * Usage: npx tsx --env-file=.env scripts/try-card-design.mts <vibe> [5x7|7x5] ["their words"]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { findFormat } from "@/kalas/invitations/card/formats";
import { findVibe, starterSpec } from "@/kalas/invitations/card/vibes";
import { parseInviteContent } from "@/kalas/invitations/content";
import { designCard } from "@/lib/invitations/buildCard";
import { cardArtPrompt, paintCardArt } from "@/lib/invitations/art";

const [vibeId = "akvarel", formatId = "5x7", words = ""] = process.argv.slice(2);
const vibe = findVibe(vibeId);
const format = findFormat(formatId);
const content = parseInviteContent({
  partnerA: "Samira", partnerB: "Rufus", date: "2027-06-12", time: "14:00",
  venue: "Broholm Slot", venueDetail: "Gudme, Fyn", rsvpBy: "2027-04-01", language: "da",
});
const started = Date.now();
const design = await designCard({ vibe, current: starterSpec(vibe, format, "da"), content, styleDirection: words });
console.log(`designed in ${((Date.now() - started) / 1000).toFixed(1)}s: ${design.spec.conceptName} · ${design.placement}\n  art: ${design.artBrief}`);
const art = await paintCardArt(cardArtPrompt({ vibe, format, spec: design.spec, placement: design.placement, brief: design.artBrief }), format);
if (!art) throw new Error("painting failed");
const dir = join(process.cwd(), "public", "invitations");
writeFileSync(join(dir, "dev-try.png"), art.data);
writeFileSync(join(dir, "dev-try.json"), JSON.stringify(design.spec, null, 1));
console.log(`painted in ${((Date.now() - started) / 1000).toFixed(1)}s total`);
