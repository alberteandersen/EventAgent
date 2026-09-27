import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "./types";

/**
 * Read the current user's profile, creating an empty row if the signup
 * trigger hasn't (e.g. pre-existing users). Returns null only if there is
 * no authenticated user.
 */
export async function getOrCreateProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRow> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data as ProfileRow;

  const { data: created, error } = await supabase
    .from("profiles")
    .insert({ user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return created as ProfileRow;
}

