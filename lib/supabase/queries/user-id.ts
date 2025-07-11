import { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../server";

export async function getAuthenticatedUserSleeperId(
  supabase: SupabaseClient,
  authId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("sleeper_user_id")
    .eq("id", authId)
    .single();

  if (error || !data) {
    throw new Error("Failed to fetch sleeper_user_id from users table.");
  }

  return data.sleeper_user_id;
}

export async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    throw new Error("User must be authenticated.");
  }

  return authUser.id;
}
