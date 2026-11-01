/* Website orders are settled here, by the server, from what Stripe says
   about the Checkout Session. The couple can read their orders but never
   write them (migration 0042): a browser must not mark its own order paid. */

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionOutcome = "paid" | "canceled" | "open";

/** What a Checkout Session means for its order. A completed session is not
    always money in hand: delayed payment methods complete first and pay (or
    fail) later, so `payment_status` decides. */
export function sessionOutcome(
  session: Pick<Stripe.Checkout.Session, "status" | "payment_status">
): SessionOutcome {
  if (session.status === "expired") return "canceled";
  if (session.status === "complete" && session.payment_status !== "unpaid") return "paid";
  return "open";
}

/** Move the session's order out of pending_payment. Safe to call twice (the
    webhook and the return from Checkout both do); throws when the write
    fails so the caller can let Stripe retry. `admin` is the service-role
    client. */
export async function settleWebsiteOrder(
  admin: SupabaseClient,
  session: Stripe.Checkout.Session,
  outcome: SessionOutcome = sessionOutcome(session)
): Promise<void> {
  const orderId = session.metadata?.order_id;
  if (!orderId || outcome === "open") return;

  const paymentIntent =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  const { error } = await admin
    .from("website_orders")
    .update(outcome === "paid" ? { status: "paid", stripe_payment_intent: paymentIntent } : { status: "canceled" })
    .eq("id", orderId)
    .eq("status", "pending_payment");
  if (error) throw new Error(error.message);
}
