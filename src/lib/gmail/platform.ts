// The platform "Kalas" mailbox: one Gmail account all outreach flows through.
// Juno sends from here, vendors reply here, the poll cron reads here.
// Tokens live in the single-row platform_gmail_tokens table (service-role only).

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import {
  GmailNotConnectedError,
  refreshAccessToken,
  emailFromIdToken,
  type TokenResponse,
} from "./oauth";
import type { EventRow, PlatformGmailTokensRow } from "@/lib/db/types";

/** Signed-state subject used by the admin connect flow. */
export const PLATFORM_STATE_SUBJECT = "platform";

let cachedEmail: string | null = null;

async function loadRow(): Promise<PlatformGmailTokensRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_gmail_tokens")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as PlatformGmailTokensRow | null) ?? null;
}

/** Persist tokens after the admin consent callback. */
export async function storePlatformTokens(tokens: TokenResponse): Promise<void> {
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token, retry the connection");
  }
  const email = emailFromIdToken(tokens.id_token);
  if (!email) throw new Error("Could not determine the connected Gmail address");

  const admin = createAdminClient();
  const { error } = await admin.from("platform_gmail_tokens").upsert({
    id: 1,
    google_email: email,
    refresh_token_enc: encrypt(tokens.refresh_token),
    access_token: tokens.access_token,
    access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    scopes: tokens.scope.split(" "),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  cachedEmail = email;
}

/**
 * Valid access token for the platform mailbox, refreshing when needed.
 * A disconnected platform mailbox is an ops incident, not a user state —
 * the row is never deleted, only logged loudly.
 */
export async function getPlatformAccessToken(): Promise<string> {
  const row = await loadRow();
  if (!row) {
    throw new GmailNotConnectedError(
      "The Kalas outreach mailbox is not connected, an admin must connect it in Settings"
    );
  }
  cachedEmail = row.google_email;

  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at).getTime()
    : 0;
  if (row.access_token && expiresAt - Date.now() > 60_000) {
    return row.access_token;
  }

  let tokens: TokenResponse;
  try {
    tokens = await refreshAccessToken(row.refresh_token_enc);
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      console.error(
        `[platform-gmail] OUTREACH MAILBOX GRANT UNUSABLE (${err.message}), reconnect via /api/admin/gmail/connect`
      );
    }
    throw err;
  }

  const admin = createAdminClient();
  await admin
    .from("platform_gmail_tokens")
    .update({
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return tokens.access_token;
}

/** Address of the platform mailbox (cached after first read). */
export async function getPlatformEmail(): Promise<string | null> {
  if (cachedEmail) return cachedEmail;
  const row = await loadRow();
  cachedEmail = row?.google_email ?? null;
  return cachedEmail;
}

/** Connection status for the admin settings card. */
export async function getPlatformConnection(): Promise<{
  connected: boolean;
  email: string | null;
}> {
  const row = await loadRow();
  return { connected: Boolean(row), email: row?.google_email ?? null };
}

/** user+tag@domain — the per-event Reply-To address. */
export function plusAddress(email: string, tag: string): string {
  const at = email.indexOf("@");
  if (at < 0) return email;
  return `${email.slice(0, at)}+${tag}${email.slice(at)}`;
}

const TAG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no lookalikes

export function generateReplyTag(): string {
  const bytes = randomBytes(8);
  let tag = "";
  for (let i = 0; i < 8; i++) tag += TAG_ALPHABET[bytes[i] % TAG_ALPHABET.length];
  return tag;
}

/** Return the event's reply tag, minting one if missing. */
export async function ensureReplyTag(
  supabase: SupabaseClient,
  event: Pick<EventRow, "id" | "reply_tag">
): Promise<string> {
  if (event.reply_tag) return event.reply_tag;
  for (let attempt = 0; attempt < 2; attempt++) {
    const tag = generateReplyTag();
    const { error } = await supabase
      .from("events")
      .update({ reply_tag: tag })
      .eq("id", event.id)
      .is("reply_tag", null);
    if (!error) {
      // Re-read in case a concurrent writer won the race.
      const { data } = await supabase
        .from("events")
        .select("reply_tag")
        .eq("id", event.id)
        .single();
      if (data?.reply_tag) return data.reply_tag as string;
    }
    // Unique collision (astronomically rare) — retry with a fresh tag.
  }
  throw new Error("Could not assign a reply tag to this event");
}

/** Whether the signed-in email may administer the platform mailbox. */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
