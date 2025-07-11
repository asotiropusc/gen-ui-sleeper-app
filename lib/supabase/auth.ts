import { NextResponse } from "next/server";
import { createClient } from "./server";
import type { SupabaseClient, User } from "@supabase/supabase-js";

interface AuthSuccess {
  supabase: SupabaseClient;
  user: User;
}

/**
 * Ensures there's a valid Supabase session (or a dev dummy user).
 * @returns NextResponse (401) on failure, or { supabase, user } on success.
 */
export async function requireUser(): Promise<AuthSuccess> {
  const supabase = await createClient();
  const devMode = process.env.NODE_ENV === "development";

  // both return { data: { user }, error }
  const { data, error } = devMode
    ? await supabase.auth.admin.getUserById(process.env.SUPABASE_DEV_USER_ID!)
    : await supabase.auth.getUser();

  if (error || !data?.user) {
    const status = devMode ? 500 : 401;
    const msg = devMode
      ? `Dev‐mode user fetch error: ${error?.message ?? "no user returned"}`
      : "Not authenticated";

    throw NextResponse.json({ success: false, error: msg }, { status });
  }

  return { supabase, user: data.user };
}
