import { NextRequest } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { websitePriceCents } from "@/lib/website/pricing";

/**
 * POST /api/website/checkout — create a website order and a Stripe Checkout
 * Session for it. Body: { eventId }. Returns { url } to redirect the
 * browser. 503 when Stripe isn't configured (the feature then runs
 * unlocked — see hasWebsiteAccess).
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

  const body = (await request.json().catch(() => ({}))) as { eventId?: string };
  const eventId = body.eventId ?? "";
  if (!eventId) return Response.json({ error: "eventId is required" }, { status: 400 });

  // RLS-scoped: confirms the event belongs to this user.
  const { data: event } = await supabase.from("events").select("id, title").eq("id", eventId).maybeSingle();
  if (!event) return Response.json({ error: "Event not found" }, { status: 404 });

  // Already unlocked → nothing to buy.
  const { count: paidCount } = await supabase
    .from("website_orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "paid");
  if ((paidCount ?? 0) > 0) return Response.json({ error: "already_paid" }, { status: 409 });

  const amountCents = websitePriceCents();
  const { data: order, error: orderError } = await supabase
    .from("website_orders")
    .insert({
      event_id: eventId,
      user_id: user.id,
      amount_cents: amountCents,
      currency: "dkk",
      status: "pending_payment",
    })
    .select()
    .single();
  if (orderError || !order) {
    return Response.json({ error: orderError?.message ?? "Could not create order" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const stripe = new Stripe(stripeKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "dkk",
          unit_amount: amountCents,
          product_data: {
            name: "Kalas, AI-designet bryllupshjemmeside",
            description: "Juno designer jeres personlige hjemmeside, inkl. fjernelse af Kalas-branding.",
          },
        },
      },
    ],
    metadata: { order_id: order.id, event_id: eventId, user_id: user.id, order_type: "website" },
    success_url: `${appUrl}/home?website_checkout=success`,
    cancel_url: `${appUrl}/home?website_checkout=canceled`,
  });

  await supabase.from("website_orders").update({ stripe_session_id: session.id }).eq("id", order.id);
  return Response.json({ url: session.url });
}
