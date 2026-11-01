import { NextRequest } from "next/server";
import { Type, type Schema } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGemini, GEMINI_MODEL } from "@/lib/gemini/client";
import { logAgentError } from "@/lib/gemini/log";
import type { BudgetContractRow, ContractReview } from "@/lib/db/types";

export const maxDuration = 120;

const BUCKET = "budget-contracts";

const REVIEW_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vendorName: { type: Type.STRING },
    totalPrice: { type: Type.NUMBER },
    currency: { type: Type.STRING },
    depositAmount: { type: Type.NUMBER },
    paymentSchedule: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          dueDate: { type: Type.STRING },
        },
        required: ["label"],
      },
    },
    cancellationPolicy: { type: Type.STRING },
    summary: { type: Type.STRING },
    redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
    suggestedActualCost: { type: Type.NUMBER },
    suggestedReminderDate: { type: Type.STRING },
    language: { type: Type.STRING },
  },
  required: ["summary"],
};

const REVIEW_PROMPT = `You are Juno, a wedding-planning assistant reviewing a supplier CONTRACT for a couple.
Read the document and extract the key facts. Rules:
- Amounts: return numbers only (no currency symbols). Report the currency in "currency" (e.g. "DKK").
- totalPrice = the full agreed price. depositAmount = any upfront deposit. suggestedActualCost = the total the couple should record as the actual cost (usually totalPrice).
- paymentSchedule = each payment/installment with its amount and dueDate (ISO YYYY-MM-DD if a date is given).
- suggestedReminderDate = the ISO date of the NEXT upcoming payment or deadline the couple should be reminded about.
- cancellationPolicy = one concise sentence.
- summary = 2-3 plain-language sentences of what this contract commits them to.
- redFlags = concrete things to double-check (auto-renewal, non-refundable deposits, vague scope, overtime fees, missing dates). Empty array if none.
- Never invent facts not in the document. Omit fields you cannot determine.
- Write summary, cancellationPolicy and redFlags in the same language as the contract.`;

async function loadContractBytes(path: string): Promise<{ base64: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { base64: buf.toString("base64") };
}

/**
 * POST /api/budget/contracts/review — { contractId, question? }.
 * Without a question: run Juno's structured review and persist it.
 * With a question: answer it using the contract as context (not persisted).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { contractId?: string; question?: string };
  const contractId = body.contractId ?? "";
  const question = (body.question ?? "").trim();
  if (!contractId) return Response.json({ error: "contractId is required" }, { status: 400 });

  // RLS: only returns the row if it's the user's.
  const { data: row } = await supabase.from("budget_contracts").select("*").eq("id", contractId).maybeSingle();
  if (!row) return Response.json({ error: "Contract not found" }, { status: 404 });
  const contract = row as BudgetContractRow;

  const bytes = await loadContractBytes(contract.storage_path);
  if (!bytes) return Response.json({ error: "Kunne ikke læse filen" }, { status: 500 });

  const filePart = {
    inlineData: { mimeType: contract.mime_type ?? "application/pdf", data: bytes.base64 },
  };

  try {
    const ai = getGemini();

    // ── Ask mode ──────────────────────────────────────────────────────────
    if (question) {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [{ role: "user", parts: [filePart, { text: question }] }],
        config: {
          systemInstruction:
            "You are Juno. Answer the couple's question about THIS contract only, concisely and in their language. If the contract doesn't cover it, say so plainly.",
          temperature: 0.2,
        },
      });
      return Response.json({ answer: res.text ?? "" });
    }

    // ── Review mode ───────────────────────────────────────────────────────
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [filePart, { text: "Review this contract." }] }],
      config: {
        systemInstruction: REVIEW_PROMPT,
        responseMimeType: "application/json",
        responseSchema: REVIEW_SCHEMA,
        temperature: 0.2,
      },
    });

    let review: ContractReview;
    try {
      review = JSON.parse(res.text ?? "{}") as ContractReview;
    } catch {
      return Response.json({ error: "Kunne ikke tolke gennemgangen" }, { status: 502 });
    }

    await supabase.from("budget_contracts").update({ review }).eq("id", contractId);
    return Response.json({ review });
  } catch (err) {
    logAgentError("budget-contract-review", err, { contractId });
    return Response.json({ error: "Juno kunne ikke gennemgå kontrakten lige nu" }, { status: 500 });
  }
}
