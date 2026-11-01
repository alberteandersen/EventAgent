import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sessionOutcome, settleWebsiteOrder } from "@/lib/website/orders";

/**
 * POST /api/website/checkout/confirm — the couple is back from Checkout.
 * Body: { sessionId }. Asks Stripe what became of the session and settles
 * the order, so the unlock doesn't hang on the webhook arriving first (or,
 * in local development, at all). Returns { paid }.
 */
export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return Response.json({ error: "Payments are not configured yet" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
  const sessionId = body.sessionId ?? "";
  if (!sessionId) return Response.json({ error: "sessionId is required" }, { status: 400 });

  // RLS-scoped: confirms the order belongs to one of this user's weddings.
  const { data: order } = await supabase
    .from("website_orders")
    .select("id, status")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "pending_payment") return Response.json({ paid: order.status === "paid" });

  const session = await new Stripe(stripeKey).checkout.sessions.retrieve(sessionId);
  if (session.metadata?.order_id !== order.id) {
    return Response.json({ error: "Order not found" }, { status: 404 });
  }
  const outcome = sessionOutcome(session);
  await settleWebsiteOrder(createAdminClient(), session, outcome);
  return Response.json({ paid: outcome === "paid" });
}
