import {
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
  fetchSleeperUserCurrentLeagues,
  fetchSleeperUserLeague,
} from "@/lib/api/sleeper/sleeper-api";
import { createClient } from "../server";
import {
  getAuthenticatedUserId,
  getAuthenticatedUserSleeperId,
} from "./user-id";
import { League as ExternalLeague } from "@/types/external/League";
import {
  League,
  BrokenLeagueHistory,
  LeagueMemberRow,
  PlayoffWeekMap,
  RoundName,
} from "@/types/internal/League";
import { v4 as uuidv4 } from "uuid";
import {
  LeagueFormat,
  PlayoffRoundType,
  RosterType,
  ScoringFormat,
  WaiverType,
} from "@/types/shared/enums";

export interface WeekCalculations {
  regularSeasonWeeks: number;
  totalWeeks: number;
  rounds: RoundName[];
  roundToWeekMapping: PlayoffWeekMap;
}

export function mapLeagueWeekInfo(
  playoffStartWeek: number,
  playoffTeams: number,
  playoffRoundType: PlayoffRoundType
): WeekCalculations {
  const regularSeasonWeeks = playoffStartWeek - 1;

  const rounds: RoundName[] =
    playoffTeams <= 4
      ? ["semifinals", "finals"]
      : ["quarterfinals", "semifinals", "finals"];

  let weekDurations: number[];
  switch (playoffRoundType) {
    case PlayoffRoundType.ONE_WEEK_PER_ROUND:
      weekDurations = rounds.map(() => 1);
      break;
    case PlayoffRoundType.TWO_WEEK_CHAMPIONSHIP:
      weekDurations = rounds.map((r) => (r === "finals" ? 2 : 1));
      break;
    case PlayoffRoundType.TWO_WEEKS_PER_ROUND:
      weekDurations = rounds.map(() => 2);
      break;
    default:
      console.warn(
        `Unknown playoff_round_type ${playoffRoundType}, defaulting to ONE_WEEK_PER_ROUND`
      );
      weekDurations = rounds.map(() => 1);
  }

  const roundToWeekMapping: PlayoffWeekMap = {};
  let currentWeek = playoffStartWeek;
  for (let i = 0; i < rounds.length; i++) {
    const dur = weekDurations[i];
    roundToWeekMapping[rounds[i]] =
      dur === 1 ? [currentWeek] : [currentWeek, currentWeek + 1];
    currentWeek += dur;
  }

  return {
    regularSeasonWeeks,
    totalWeeks: currentWeek - 1,
    rounds,
    roundToWeekMapping,
  };
}

export function determinePlayoffByeTeamCounts(numTeams: number): number {
  switch (numTeams) {
    case 5:
      return 3;
    case 6:
      return 2;
    case 7:
      return 1;
    default:
      return 0;
  }
}

export function determinePlayoffRoundType(
  code: number,
  leagueId: string
): PlayoffRoundType {
  switch (code) {
    case 0:
      return PlayoffRoundType.ONE_WEEK_PER_ROUND;
    case 1:
      return PlayoffRoundType.TWO_WEEK_CHAMPIONSHIP;
    case 2:
      return PlayoffRoundType.TWO_WEEKS_PER_ROUND;
    default:
      console.warn(
        `Unknown playoff_round_type ${code} for league: ${leagueId}, defaulting to ONE_WEEK_PER_ROUND`
      );
      return PlayoffRoundType.ONE_WEEK_PER_ROUND;
  }
}

export function determineLeagueFormat(type: number): LeagueFormat {
  switch (type) {
    case 0:
      return LeagueFormat.Redraft;
    case 1:
      return LeagueFormat.Keeper;
    case 2:
      return LeagueFormat.Dynasty;
    default:
      // Fallback if Sleeper ever adds new types
      console.warn(`Unknown league type ${type}, defaulting to Redraft`);
      return LeagueFormat.Redraft;
  }
}

export function determineScoringFormat(
  rosterPositions: string[],
  scoringSettings: Record<string, number>
): ScoringFormat {
  // 1) Decide base scoring type by PPR level
  const recPoints = scoringSettings["rec"] ?? 0;
  let baseFormat: ScoringFormat;
  if (recPoints === 1) {
    baseFormat = ScoringFormat.PPR;
  } else if (recPoints === 0.5) {
    baseFormat = ScoringFormat.HalfPPR;
  } else {
    baseFormat = ScoringFormat.Standard;
  }

  // 2) If SUPER_FLEX is enabled, pick the SuperFlex variant
  const hasSuperFlex = rosterPositions.includes("SUPER_FLEX");
  if (hasSuperFlex) {
    switch (baseFormat) {
      case ScoringFormat.Standard:
        return ScoringFormat.StandardSuperFlex;
      case ScoringFormat.PPR:
        return ScoringFormat.PPRSuperFlex;
      case ScoringFormat.HalfPPR:
        return ScoringFormat.HalfPPRSuperFlex;
    }
  }

  // 3) Otherwise just return the base format
  return baseFormat;
}

export function determineWaiverTypeEnum(waiverType: number): WaiverType {
  switch (waiverType) {
    case 0:
      return WaiverType.RollingWaivers;
    case 1:
      return WaiverType.ReverseStandings;
    case 2:
      return WaiverType.FAABBidding;
    default:
      console.warn(
        `Unknown waiver type ${waiverType}, defaulting to RollingWaivers`
      );
      return WaiverType.RollingWaivers;
  }
}

export function mapExternalLeagueToInternal(
  external: ExternalLeague,
  leagueGroupId: string
): League {
  // 1) Destructure the bits you need from the raw API shape
  const {
    league_id,
    name: league_name,
    season,
    status,
    avatar,
    total_rosters,
    roster_positions,
    scoring_settings,
    settings,
  } = external;

  // 2) Pull out simple settings
  const {
    waiver_budget,
    waiver_type,
    waiver_day_of_week,
    trade_deadline,
    draft_rounds,
    reserve_slots,
    type,
    best_ball,
    taxi_slots,
    taxi_deadline,
    taxi_years,
    playoff_week_start,
    playoff_teams,
    playoff_round_type,
  } = settings;

  const scoringSettings: Record<string, number> = Object.fromEntries(
    Object.entries(scoring_settings).map(([key, val]) => [
      key,
      Number(val.toFixed(2)),
    ])
  );

  // 3) Compute derived fields via helpers
  const scoring_format = determineScoringFormat(
    roster_positions,
    scoringSettings
  );
  const league_format = determineLeagueFormat(type);
  const waiver_type_enum = determineWaiverTypeEnum(waiver_type);
  const playoffRoundType = determinePlayoffRoundType(
    playoff_round_type,
    league_id
  );
  const playoffByeTeamCounts = determinePlayoffByeTeamCounts(playoff_teams);
  // 4) Get all your week counts + playoff map in one go
  const {
    regularSeasonWeeks: regular_season_weeks,
    totalWeeks: total_weeks,
    rounds: playoff_rounds,
    roundToWeekMapping: playoff_week_map,
  } = mapLeagueWeekInfo(playoff_week_start, playoff_teams, playoffRoundType);

  return {
    league_id,
    league_group_id: leagueGroupId,
    league_name,
    season,
    status,
    avatar_id: avatar ?? null,
    total_rosters,
    roster_positions,

    scoring_settings: scoringSettings,
    waiver_budget,
    waiver_type: waiver_type_enum,
    waiver_day_of_week,
    trade_deadline,
    draft_rounds,
    reserve_slots,
    taxi_slots,
    taxi_deadline,
    taxi_years,

    scoring_format,
    league_format,
    roster_type: best_ball === 0 ? RosterType.Classic : RosterType.BestBall,

    playoff_week_start,
    playoff_teams,
    playoff_round_type: playoffRoundType,
    regular_season_weeks,
    total_weeks,
    playoff_rounds,
    playoff_week_map,
    playoff_bye_teams_count: playoffByeTeamCounts,
  };
}

async function chainLeagueHistory(
  leagueId: string,
  allUserLeagues: League[],
  leagueGroupId: string
): Promise<boolean> {
  let currentLeagueId: string | null = leagueId;

  while (currentLeagueId) {
    const league: ExternalLeague | null = await fetchSleeperUserLeague(
      currentLeagueId
    );

    if (!league) return false;

    const internalLeague: League = mapExternalLeagueToInternal(
      league,
      leagueGroupId
    );

    allUserLeagues.push(internalLeague);

    currentLeagueId = league.previous_league_id;
  }

  return true;
}

async function fetchAllLeagueHistories(newLeagues: ExternalLeague[]): Promise<{
  leagues: League[];
  brokenLeagueHistory: BrokenLeagueHistory[];
}> {
  const allUserLeagues: League[] = [];
  const brokenLeagueHistory: BrokenLeagueHistory[] = [];

  for (const league of newLeagues) {
    const leagueGroupId = uuidv4();

    const isChainValid = await chainLeagueHistory(
      league.league_id,
      allUserLeagues,
      leagueGroupId
    );

    if (!isChainValid) {
      brokenLeagueHistory.push({
        league_group_id: leagueGroupId,
      });
    }
  }

  return { leagues: allUserLeagues, brokenLeagueHistory };
}

export async function populateAllLeaguesForUser(): Promise<string[]> {
  const supabase = await createClient();

  const authUserId = await getAuthenticatedUserId();
  const sleeperUserId = await getAuthenticatedUserSleeperId();

  const currentUserLeagues = await fetchSleeperUserCurrentLeagues(
    sleeperUserId
  );
  if (!currentUserLeagues || currentUserLeagues.length === 0) {
    throw new Error("No leagues found for this user.");
  }

  const currentLeagueIds = currentUserLeagues.map((l) => l.league_id);

  // 3) Figure out which of those top-levels are brand new to our DB
  const leagueIdsToInsert = await getLeaguesToInsert(currentLeagueIds);

  const leaguesToIngest = currentUserLeagues.filter((l) =>
    leagueIdsToInsert.includes(l.league_id)
  );

  // 4) Fetch full histories (ancestors + top-levels) only for the brand-new ones
  const { leagues: ingestedLeaguesWithHistory, brokenLeagueHistory } =
    await fetchAllLeagueHistories(leaguesToIngest);

  if (brokenLeagueHistory.length) {
    const { error: leagueHistoryStatusError } = await supabase
      .from("broken_league_histories")
      .upsert(brokenLeagueHistory, { onConflict: "league_group_id" });
    if (leagueHistoryStatusError) {
      throw new Error(
        `Upserting league_history_status failed: ${leagueHistoryStatusError.message}`
      );
    }
  }

  if (ingestedLeaguesWithHistory.length) {
    // bulk insert to leagues table
    const { error: leaguesTableError } = await supabase
      .from("leagues")
      .upsert(ingestedLeaguesWithHistory, { onConflict: "league_id" });
    if (leaguesTableError) {
      throw new Error(`Upserting leagues failed: ${leaguesTableError.message}`);
    }
  }

  const existingTopLevelIds = currentLeagueIds.filter(
    (currId) => !leagueIdsToInsert.includes(currId)
  );
  const existingHistoryLeagueIds = await getAllLeagueIdsInHistory(
    existingTopLevelIds
  );

  const userLeagueUpsertRows = [
    ...ingestedLeaguesWithHistory.map((league) => ({
      user_id: authUserId,
      league_id: league.league_id,
    })),
    ...existingHistoryLeagueIds.map((league_id) => ({
      user_id: authUserId,
      league_id,
    })),
  ];

  const { error: userLeaguesError } = await supabase
    .from("user_leagues")
    .upsert(userLeagueUpsertRows, { onConflict: "user_id,league_id" });
  if (userLeaguesError) {
    throw new Error(
      `Upserting user_leagues failed: ${userLeaguesError.message}`
    );
  }

  return ingestedLeaguesWithHistory.map((l) => l.league_id);
}

export async function populateAllLeagueMembersForUser(leagueIds: string[]) {
  const supabase = await createClient();

  await Promise.all(
    leagueIds.map(async (leagueId) => {
      try {
        const rows = await generateLeagueMemberRows(leagueId);

        const { error } = await supabase
          .from("league_members")
          .upsert(rows, { onConflict: "league_id,roster_id,sleeper_user_id" });

        if (error) throw new Error(error.message);
      } catch (err) {
        console.error(
          `Failed to upsert members for ${leagueId}:`,
          (err as Error).message
        );
      }
    })
  );
}

export async function generateLeagueMemberRows(
  leagueId: string
): Promise<LeagueMemberRow[]> {
  const leagueRosters = await fetchSleeperLeagueRosters(leagueId);
  if (!leagueRosters) {
    throw new Error(`Could not fetch rosters for league ${leagueId}`);
  }

  const leagueUsers = await fetchSleeperLeagueUsers(leagueId);
  if (!leagueUsers) {
    throw new Error(`Could not fetch league users for league ${leagueId}`);
  }

  const ownerToRoster = leagueRosters.reduce(
    (map, { roster_id, owner_id, co_owners }) => {
      const allOwners = [owner_id, ...(co_owners || [])];
      allOwners.forEach((userId) => {
        map.set(userId, roster_id);
      });
      return map;
    },
    new Map<string, number>()
  );

  return leagueUsers.map((user) => ({
    league_id: leagueId,
    roster_id: ownerToRoster.get(user.user_id)!,
    sleeper_user_id: user.user_id,
    league_username: user.display_name,
  }));
}

export async function getLeaguesToInsert(
  leagueIds: string[]
): Promise<string[]> {
  if (leagueIds.length === 0) return [];

  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from("leagues")
    .select("league_id")
    .in("league_id", leagueIds);

  if (error) {
    throw new Error();
  }

  const existingSet = new Set(existing.map((r) => r.league_id));
  return leagueIds.filter((id) => !existingSet.has(id));
}

export async function getAllLeaguesForUser(): Promise<string[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("User must be authenticated to fetch user leagues.");
  }

  const { data, error } = await supabase
    .from("user_leagues")
    .select("league_id")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(
      `Failed to getAllLeaguesForUser for authenticated user: ${error.message}`
    );
  }

  const rows = data ?? [];
  return rows.map((row) => row.league_id);
}

export async function getAllLeagueIdsInHistory(
  leagueIds: string[]
): Promise<string[]> {
  if (leagueIds.length === 0) return [];

  const supabase = await createClient();

  const { data: groupRows } = await supabase
    .from("leagues")
    .select("league_group_id")
    .in("league_id", leagueIds)
    .throwOnError();
  if (!groupRows || groupRows.length === 0) return [];

  const groupIds = groupRows.map((r) => r.league_group_id);

  const { data: leagueRows } = await supabase
    .from("leagues")
    .select("league_id")
    .in("league_group_id", groupIds)
    .throwOnError();
  if (!leagueRows) return [];

  return leagueRows.map((r) => r.league_id);
}

// TODO: maybe add function to mend broken league chains
// TODO: Add READs to this as well.
