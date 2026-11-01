import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** POST /api/proposals/[proposalId]/dismiss — drop Juno's proposed reply. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  const { proposalId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("reply_proposals")
    .update({ status: "dismissed" })
    .eq("id", proposalId)
    .eq("status", "proposed");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
