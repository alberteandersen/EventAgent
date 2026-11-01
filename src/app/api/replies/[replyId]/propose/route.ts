import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReplyProposal } from "@/lib/gemini/agent";
import type { EmailReplyRow } from "@/lib/db/types";

/**
 * POST /api/replies/[replyId]/propose — (re)generate Juno's proposed reply for
 * a vendor reply. RLS-scoped ownership check, then admin write via the shared
 * generator.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ replyId: string }> }
) {
  const { replyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Ownership enforced by RLS on this select.
  const { data: reply } = await supabase
    .from("email_replies")
    .select("*")
    .eq("id", replyId)
    .maybeSingle();
  if (!reply) return Response.json({ error: "Reply not found" }, { status: 404 });

  const proposal = await generateReplyProposal(createAdminClient(), reply as EmailReplyRow);
  if (!proposal) {
    return Response.json({ error: "Could not draft a reply" }, { status: 502 });
  }
  return Response.json(proposal);
}
