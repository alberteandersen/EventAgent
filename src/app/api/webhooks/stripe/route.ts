import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleWebsiteOrder } from "@/lib/website/orders";

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 * Handles checkout.session.completed and .async_payment_succeeded (order →
 * paid, once the money is in), and checkout.session.expired and
 * .async_payment_failed (order → canceled). Signature-verified; uses the
 * admin client because Stripe calls without a user session. A failed write
 * answers 500 so Stripe delivers the event again.
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

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      // Only the website checkout remains (it unlocks both AI designers).
      const session = event.data.object;
      try {
        await settleWebsiteOrder(
          createAdminClient(),
          session,
          event.type === "checkout.session.async_payment_failed" ? "canceled" : undefined
        );
      } catch (err) {
        console.error(`[webhooks/stripe] ${event.type} ${event.id} not recorded`, err);
        return Response.json({ error: "Could not record the event" }, { status: 500 });
      }
    }
  }

  return Response.json({ received: true });
}
