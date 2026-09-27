/**
 * Paints the sample artwork each card vibe ships with, one per paper size,
 * into public/invitations/vibes/<vibe>-<format>.webp. The same prompt Ava's
 * builds use (src/lib/invitations/art.ts), so a vibe's sample is honest
 * about what a build looks like. Re-run after changing a vibe's painting.
 *
 * Usage: npx tsx --env-file=.env scripts/invite-vibe-art.mts [vibe…] [--force] [--format=5x7|7x5]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { CARD_FORMATS } from "@/kalas/invitations/card/formats";
import { CARD_VIBES, sampleArt, starterSpec } from "@/kalas/invitations/card/vibes";
import { cardArtPrompt, paintCardArt } from "@/lib/invitations/art";

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));
const onlyFormat = args.find((a) => a.startsWith("--format="))?.slice(9);
const out = join(process.cwd(), "public", "invitations", "vibes");
mkdirSync(out, { recursive: true });

/** Bare paper: the vibe's paper colour with a fine, even fibre grain, made
    here rather than painted, so it is exactly that and nothing more. */
async function makePaper(hex: string, [w, h]: number[]): Promise<Buffer> {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const n = (Math.random() - 0.5) * 9;
    px[i * 3] = Math.max(0, Math.min(255, r + n));
    px[i * 3 + 1] = Math.max(0, Math.min(255, g + n));
    px[i * 3 + 2] = Math.max(0, Math.min(255, b + n));
  }
  return sharp(px, { raw: { width: w, height: h, channels: 3 } }).blur(0.6).webp({ quality: 86 }).toBuffer();
}

for (const vibe of CARD_VIBES.filter((v) => only.length === 0 || only.includes(v.id))) {
  for (const format of CARD_FORMATS.filter((f) => !onlyFormat || f.id === onlyFormat)) {
    const file = join(process.cwd(), "public", sampleArt(vibe.id, format.id));
    if (existsSync(file) && !force) { console.log(`skip ${vibe.id} ${format.id}`); continue; }
    const spec = starterSpec(vibe, format, "da");
    if (vibe.paper) {
      writeFileSync(file, await makePaper(spec.palette.paper, format.widthIn > format.heightIn ? [1600, 1143] : [1200, 1680]));
      console.log(`made paper ${vibe.id} ${format.id}`);
      continue;
    }
    const art = await paintCardArt(cardArtPrompt({ vibe, format, spec, placement: vibe.placement, brief: "" }), format);
    if (!art) { console.error(`FAILED ${vibe.id} ${format.id}`); continue; }
    // Big enough to print from at 5×7, small enough to ship in the app.
    const webp = await sharp(art.data).resize({ width: format.widthIn > format.heightIn ? 1600 : 1200 }).webp({ quality: 84 }).toBuffer();
    writeFileSync(file, webp);
    console.log(`painted ${vibe.id} ${format.id} (${Math.round(webp.length / 1024)} kB)`);
  }
}
