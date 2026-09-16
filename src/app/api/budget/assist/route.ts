import { NextRequest } from "next/server";
import { Type, type Schema } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import { budgetLines } from "@/kalas/data";
import { estimatedTotal } from "@/kalas/screens/budget/estimate";
import { normaliseAdvice } from "@/lib/budget/advice";
import type { BudgetItemRow, EventRow } from "@/lib/db/types";

export const maxDuration = 60;

/** Same parse as useWedding.tsx's client-side copy — a bare digits-only read
 *  of the text column, duplicated rather than imported because that file is
 *  "use client" and pulls in hooks this route has no business loading. */
function parseBudget(text: string | null): number {
  if (!text) return 0;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number.parseInt(digits, 10) : 0;
}

const CATEGORY_IDS = budgetLines.map((l) => l.id);

const ADVICE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING, enum: CATEGORY_IDS },
          pct: { type: Type.NUMBER },
          rationale: { type: Type.STRING },
        },
        required: ["category", "pct", "rationale"],
      },
    },
    tips: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["headline", "lines", "tips"],
};

interface RawAdvice {
  headline: string;
  lines: { category: string; pct: number; rationale: string }[];
  tips: string[];
}

const ADVICE_PROMPT = `Du er Ava, brylluppets planlægger, og skal foreslå en budgetfordeling for et par.

Brug PRÆCIS disse ${budgetLines.length} kategorier, ingen andre, og medtag hver af dem én gang i "lines":
${budgetLines.map((l) => `- ${l.id} = ${l.label}`).join("\n")}

Regler:
- pct er hver kategoris andel af totalbudgettet, som et heltal. Summen af alle pct skal være 100.
- Har parret allerede brugt eller betalt et beløb i en kategori, må din foreslåede pct aldrig give et
  lavere kronebeløb end det, de allerede har lagt — det ville bede dem fortryde en beslutning, de har
  truffet.
- rationale er ÉN kort sætning på dansk der begrunder netop dette tal ud fra parrets egne oplysninger
  (gæsteantal, region, stil) — ikke en generisk tommelfingerregel.
- headline er ÉN sætning der opsummerer anbefalingen for netop dette par, ikke en overskrift for alle par.
- tips: 3-5 konkrete, korte råd, forankret i parrets egne oplysninger — ikke branchetal de ikke har bedt om.
- Skriv alt på dansk, medmindre parrets sprog er engelsk — brug i så fald engelsk konsekvent overalt.`;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  const eventId = body.eventId ?? "";
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  // RLS-scoped ownership check, same shape as the website-design routes.
  const { data: eventRow } = await supabase
    .from("events")
    .select("guest_count, location, budget, requirements")
    .eq("id", eventId)
    .maybeSingle();
  if (!eventRow) return Response.json({ error: "Event not found" }, { status: 404 });
  const event = eventRow as Pick<EventRow, "guest_count" | "location" | "budget" | "requirements">;

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("language")
    .eq("user_id", user.id)
    .maybeSingle();
  const language = (profileRow as { language?: string } | null)?.language === "en" ? "en" : "da";

  const { data: itemRows } = await supabase
    .from("budget_items")
    .select("category, planned_amount, paid_amount, actual_cost")
    .eq("event_id", eventId);
  const items = (itemRows as Pick<BudgetItemRow, "category" | "planned_amount" | "paid_amount" | "actual_cost">[] | null) ?? [];
  const byId = new Map(items.map((i) => [i.category, i]));

  const guests = event.guest_count ?? 0;
  const total = parseBudget(event.budget) || estimatedTotal(0, guests);
  if (total <= 0) {
    return Response.json(
      { error: "Ava skal kende jeres budget eller gæsteantal, før hun kan foreslå en fordeling." },
      { status: 422 },
    );
  }
  const location = event.location?.trim() || "";
  const style =
    typeof event.requirements?.description === "string" ? event.requirements.description : "";

  const lineContext = budgetLines
    .map((l) => {
      const existing = byId.get(l.id);
      const planned = existing?.planned_amount ?? Math.round((total * l.pct) / 100);
      const spent = Math.max(existing?.actual_cost ?? 0, existing?.paid_amount ?? 0);
      return spent > 0
        ? `- ${l.id}: budgetteret ${planned} kr, heraf allerede brugt/betalt ${spent} kr`
        : `- ${l.id}: budgetteret ${planned} kr, intet brugt endnu`;
    })
    .join("\n");

  const userContent = `Totalbudget: ${total} kr
Gæsteantal: ${guests || "ikke angivet"}
Region: ${location || "ikke angivet"}
Stil: ${style || "ikke angivet"}
Parrets sprog: ${language === "en" ? "engelsk" : "dansk"}

Nuværende fordeling pr. kategori:
${lineContext}`;

  try {
    const ai = getGemini();
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      config: {
        systemInstruction: ADVICE_PROMPT,
        responseMimeType: "application/json",
        responseSchema: ADVICE_SCHEMA,
        temperature: 0.4,
      },
    });

    let raw: RawAdvice;
    try {
      raw = JSON.parse(res.text ?? "{}") as RawAdvice;
    } catch {
      return Response.json({ error: "Ava kunne ikke sætte forslaget sammen. Prøv igen." }, { status: 502 });
    }

    // Never trust the model's arithmetic — normaliseAdvice (tested on its
    // own) drops unknown categories, clamps negatives, and apportions the
    // rounding so the percentages always sum to exactly 100.
    const lines = normaliseAdvice(budgetLines, raw.lines ?? [], total);

    return Response.json({
      headline: raw.headline || "",
      total,
      lines,
      tips: (raw.tips ?? []).filter((t) => typeof t === "string" && t.trim()).slice(0, 5),
    });
  } catch (err) {
    logAgentError("budget-assist", err, { eventId });
    return Response.json({ error: "Ava kunne ikke regne på budgettet lige nu." }, { status: 500 });
  }
}
