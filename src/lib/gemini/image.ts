// Invite design generation ("Nano Banana"): Gemini image model renders a
// flat wedding-invitation card front from the couple's style/palette/wording.

import { Modality } from "@google/genai";
import { getGemini } from "./client";
import { logAgentError } from "./log";
import { SECTION_IMAGE_PROMPT } from "./prompts";

export const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";

export interface GeneratedImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Generate a per-section illustration for the wedding website (dresscode
 * flat-lay, transport route, gift still life…). Best-effort: null on failure.
 */
export async function generateSectionImage(args: {
  sectionId: string;
  styleDirection: string;
  vibes: string[];
  paletteHexes: string[];
  region: string;
  aspectRatio?: "16:9" | "3:4" | "1:1";
}): Promise<GeneratedImage | null> {
  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: SECTION_IMAGE_PROMPT(args),
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        imageConfig: { aspectRatio: args.aspectRatio ?? "16:9" },
      },
    });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const inline = part.inlineData;
      if (inline?.data) {
        return {
          data: Buffer.from(inline.data, "base64"),
          mimeType: inline.mimeType ?? "image/png",
        };
      }
    }
    return null;
  } catch (err) {
    logAgentError("gemini/image:generateSectionImage", err, {
      model: GEMINI_IMAGE_MODEL,
      section: args.sectionId,
    });
    return null;
  }
}
