import { fetchSleeperUser } from "@/lib/api/sleeper/sleeper-api";
import { createClient } from "../server";

export async function upsertUser(username: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to insert user data.");
  }

  const sleeperUser = await fetchSleeperUser(username);

  if (!sleeperUser) {
    throw new Error("Failed to fetch sleeper user.");
  }

  const { error } = await supabase.from("users").upsert(
    [
      {
        id: user.id,
        sleeper_user_id: sleeperUser.user_id,
        username: sleeperUser.username,
        avatar_id: sleeperUser.avatar,
      },
    ],
    { onConflict: "id" }
  );

  if (error) {
    const msg = error.message ?? JSON.stringify(error);
    throw new Error(`Failed to insert user ${user.id}: ${msg}`);
  }
}
