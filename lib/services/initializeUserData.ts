import { SupabaseClient } from "@supabase/supabase-js";
import {
  populateAllLeagueMembersForUser,
  populateAllLeaguesForUser,
} from "../supabase/queries/leagues";
import {
  populateAllMatchupsForUser,
  populateAllPlayoffMatchupsForUser,
} from "../supabase/queries/matchups";
import { upsertAllPlayers } from "../supabase/queries/players";
import { upsertUser } from "../supabase/queries/users";

type InitializeUserDataResults =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Orchestrates initial data population for a newly authenticated user.
 * Should be called once after the user logs in and provides their Sleeper username.
 */
export async function initializeUserData(
  supabase: SupabaseClient,
  authId: string,
  sleeperUsername: string
): Promise<InitializeUserDataResults> {
  try {
    // 1. Ensure the user record exists
    await upsertUser(supabase, authId, sleeperUsername);

    // 2. Populate global players table (first user or if stale)
    await upsertAllPlayers(supabase);

    // 3. Fetch and upsert all leagues for this user
    const newLeagueIds = await populateAllLeaguesForUser(supabase, authId);

    if (newLeagueIds.length) {
      // 4. Populate league members
      await populateAllLeagueMembersForUser(supabase, newLeagueIds);

      // 5. Populate weekly matchups and players
      await populateAllMatchupsForUser(supabase, newLeagueIds);

      // 6. Populate playoff matchups
      await populateAllPlayoffMatchupsForUser(supabase, newLeagueIds);
    } else {
      console.info(
        `initializeUserData: no new leagues to insert. Skipping members & matchups population.`
      );
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "Unknown error during initialization",
    };
  }
}
