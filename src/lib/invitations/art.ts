/* Painting the card: the image model makes the artwork alone, no words, at
   the card's nearest ratio, with the text area left as empty paper. The
   words are set over it afterwards, so a name can never be misspelled and
   stays editable in Canva. */

import { Modality } from "@google/genai";
import { getGemini } from "@/lib/gemini/client";
import { GEMINI_IMAGE_MODEL, type GeneratedImage } from "@/lib/gemini/image";
import { logAgentError } from "@/lib/gemini/log";
import type { CardFormat } from "@/kalas/invitations/card/formats";
import type { CardSpec } from "@/kalas/invitations/card/spec";
import type { ArtPlacement, CardVibe } from "@/kalas/invitations/card/vibes";

const PLACEMENT: Record<ArtPlacement, string> = {
  corners: "gathered in two opposite corners, trailing a little way along the edges",
  frame: "as a frame or border around the edges, heaviest in the corners",
  top: "across the top of the paper only",
  bottom: "along the bottom of the paper only",
  scattered: "scattered lightly around the edges and corners",
  texture: "as the paper itself: texture and at most one tiny motif, nothing else",
};

/** For the paper-only vibes, the model's urge to decorate needs a firm no. */
const PAPER_ONLY = "The paper stays completely bare: no sprigs, leaves, flowers, stains, splashes, marks or motifs of any kind unless the style above names one.";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function cardArtPrompt(args: {
  vibe: CardVibe;
  format: CardFormat;
  spec: Pick<CardSpec, "palette" | "textArea">;
  placement: ArtPlacement;
  brief: string;
}): string {
  const { format, spec } = args;
  const orientation = format.widthIn > format.heightIn ? "landscape" : "portrait";
  const a = spec.textArea;
  // Never say "card" to the image model: it answers with a photo of one,
  // lying on a table with a shadow. Ask for the artwork itself.
  return `A full-bleed ${orientation} artwork on paper, ${format.artRatio}, to be printed edge to edge as the background of luxury wedding stationery, in exactly the medium the style below describes (a pen drawing stays a clean pen drawing, with no watercolour washes or stains added). The textured paper and the painting cover the entire canvas: every edge of the image is the edge of the paper.

Style: ${args.vibe.art}.
${args.brief ? `The couple's direction: ${args.brief}.\n` : ""}Colours: paper around ${spec.palette.paper}; accents in ${spec.palette.accent}; text in ${spec.palette.ink} will be printed over it later, so keep the artwork in harmony with it.

Composition: the painted elements sit ${PLACEMENT[args.placement]}. The area from ${pct(a.top)} to ${pct(1 - a.bottom)} of the height and from ${pct(a.left)} to ${pct(1 - a.right)} of the width stays calm, empty paper or the softest wash. Keep important elements at least 6% in from the ${orientation === "portrait" ? "left and right" : "top and bottom"} edges.

No text of any kind: no letters, words, numbers, names, dates, monograms, calligraphy, signatures or watermarks. The colour values above are only for you: never write them, or any other code, on the paper.
${args.placement === "texture" ? PAPER_ONLY : ""}

Not a photograph and not a mockup: no table, surface or background around the paper, no drop shadow, no envelope, no hands, no perspective, no visible paper edge or corner. Just the artwork, straight on, fine-art stationery quality.`;
}

/** The model now and then answers with words and no picture; one more try
    usually brings the picture, so a card is not lost to a single miss. */
const ATTEMPTS = 2;

export async function paintCardArt(prompt: string, format: CardFormat): Promise<GeneratedImage | null> {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await getGemini().models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: { aspectRatio: format.artRatio },
        },
      });
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          return { data: Buffer.from(part.inlineData.data, "base64"), mimeType: part.inlineData.mimeType ?? "image/png" };
        }
      }
    } catch (err) {
      logAgentError("invitations/art", err, { model: GEMINI_IMAGE_MODEL, attempt });
    }
  }
  return null;
}
