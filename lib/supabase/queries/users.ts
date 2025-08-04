import { fetchSleeperUser } from "@/lib/api/sleeper/sleeper-api";
import { UsernameNotFoundError } from "@/lib/errors";
import { SupabaseClient } from "@supabase/supabase-js";

export async function upsertUser(
  supabase: SupabaseClient,
  authId: string,
  username: string,
) {
  const sleeperUser = await fetchSleeperUser(username);

  if (!sleeperUser) {
    throw new UsernameNotFoundError(username);
  }

  const { error } = await supabase.from("users").upsert(
    [
      {
        id: authId,
        sleeper_user_id: sleeperUser.user_id,
        username: sleeperUser.username,
        avatar_id: sleeperUser.avatar,
      },
    ],
    { onConflict: "id" },
  );

  if (error) {
    const msg = error.message ?? JSON.stringify(error);
    throw new Error(`Failed to insert user ${authId}: ${msg}`);
  }
}
