import { Type, type Schema } from "@google/genai";
import { factsSchemaProps } from "@/lib/venue/search";
import type { RawFacts } from "@/lib/venue/facts";

/** responseSchema for structured venue extraction (search step B). */
export const venueListSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    venues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING, nullable: true },
          address: { type: Type.STRING, nullable: true },
          website: { type: Type.STRING, nullable: true },
          email: { type: Type.STRING, nullable: true },
          phone: { type: Type.STRING, nullable: true },
          capacity: { type: Type.STRING, nullable: true },
          price_hint: { type: Type.STRING, nullable: true },
          why_fit: {
            type: Type.STRING,
            nullable: true,
            description: "One sentence on why this option fits the couple",
          },
          // Structured facts, so a venue Juno finds is filterable on capacity,
          // price, catering and accommodation exactly like one the couple
          // found on the explore page.
          ...factsSchemaProps,
        },
        required: ["name"],
      },
    },
  },
  required: ["venues"],
};

export interface ExtractedVenue extends RawFacts {
  name: string;
  description?: string | null;
  address?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  capacity?: string | null;
  price_hint?: string | null;
  why_fit?: string | null;
}

/** responseSchema for quote extraction from venue replies. */
export const quoteSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    has_quote: { type: Type.BOOLEAN },
    price_amount: { type: Type.NUMBER, nullable: true },
    currency: { type: Type.STRING, nullable: true },
    price_basis: {
      type: Type.STRING,
      nullable: true,
      description: "e.g. 'total', 'per person', 'per hour', 'minimum spend'",
    },
    availability: {
      type: Type.STRING,
      enum: ["available", "unavailable", "unclear"],
    },
    conditions: { type: Type.STRING, nullable: true },
    summary: { type: Type.STRING, description: "1-2 sentence summary of the reply" },
  },
  required: ["has_quote", "availability", "summary"],
};
