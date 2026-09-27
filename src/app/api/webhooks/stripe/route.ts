import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 * Handles checkout.session.completed (order → paid) and
 * checkout.session.expired (order → canceled). Signature-verified;
 * uses the admin client because Stripe calls without a user session.
 */
export async function POST(request: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid signature" },
      { status: 400 }
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const supabase = createAdminClient();
      // Only the website checkout remains (it unlocks both AI designers).
      const table = "website_orders";
      if (event.type === "checkout.session.completed") {
        await supabase
          .from(table)
          .update({
            status: "paid",
            stripe_payment_intent:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .eq("id", orderId)
          .eq("status", "pending_payment");
      } else {
        await supabase
          .from(table)
          .update({ status: "canceled" })
          .eq("id", orderId)
          .eq("status", "pending_payment");
      }
    }
  }

  return Response.json({ received: true });
}
