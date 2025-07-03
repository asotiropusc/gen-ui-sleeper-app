import {
  getAllLeaguesForUser,
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
  sleeperUsername: string
): Promise<InitializeUserDataResults> {
  try {
    // 1. Ensure the user record exists
    await upsertUser(sleeperUsername);

    // 2. Populate global players table (first user or if stale)
    await upsertAllPlayers();

    // 3. Fetch and upsert all leagues for this user
    const leagueIds = await populateAllLeaguesForUser();

    if (leagueIds.length) {
      // 4. Populate league members
      await populateAllLeagueMembersForUser(leagueIds);

      // 5. Populate weekly matchups and players
      await populateAllMatchupsForUser(leagueIds);

      // 6. Populate playoff matchups
      await populateAllPlayoffMatchupsForUser(leagueIds);
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error).message || "Unknown error during initialization",
    };
  }
}

type PlayoffImportResult =
  | { success: true }
  | { success: false; error: string };

export async function populatePlayoffMatchupsForUser(): Promise<PlayoffImportResult> {
  try {
    const userLeagueIds = await getAllLeaguesForUser();
    await populateAllPlayoffMatchupsForUser(userLeagueIds);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
