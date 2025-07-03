import { League } from "@/types/external/League";
import { Matchup } from "@/types/external/Matchup";
import { NFLState } from "@/types/external/NFLState";
import { PlayerMap } from "@/types/external/Player";
import { PlayerTrend } from "@/types/external/PlayerTrend";
import { PlayoffMatchup } from "@/types/external/PlayoffMatchup";
import { Roster } from "@/types/external/Roster";
import { LeagueUser, User } from "@/types/external/User";

const SLEEPER_BASE_URL = "https://api.sleeper.app/v1/";

export async function makeRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error for ${url}! Status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error("Error making Sleeper request:", error);
    return null;
  }
}

export async function fetchSleeperUser(
  identifier: string
): Promise<User | null> {
  const url = `${SLEEPER_BASE_URL}/user/${identifier}`;

  return await makeRequest<User>(url);
}

export async function fetchSleeperLeagueUsers(
  leagueId: string
): Promise<LeagueUser[] | null> {
  const url = `${SLEEPER_BASE_URL}/league/${leagueId}/users`;

  return makeRequest<User[]>(url);
}

export async function fetchSleeperPlayers(): Promise<PlayerMap | null> {
  const url = `${SLEEPER_BASE_URL}/players/nfl`;

  return await makeRequest<PlayerMap>(url);
}

// Maybe simplify type here to just be league name and league id?
export async function fetchSleeperUserCurrentLeagues(
  userId: string
): Promise<League[] | null> {
  const season = new Date().getFullYear();
  const url = `${SLEEPER_BASE_URL}/user/${userId}/leagues/nfl/${season}`;

  return await makeRequest<League[]>(url);
}

export async function fetchSleeperUserLeague(
  leagueId: string
): Promise<League | null> {
  const url = `${SLEEPER_BASE_URL}/league/${leagueId}`;

  return await makeRequest<League>(url);
}

export async function fetchSleeperLeagueRosters(
  leagueId: string
): Promise<Roster[] | null> {
  const url = `${SLEEPER_BASE_URL}/league/${leagueId}/rosters`;
  return await makeRequest<Roster[]>(url);
}

// Should only be used to fetch the lastest roster...rosters for matchups should be fetched from matchups
export async function fetchSleeperUserLeagueRoster(
  userId: string,
  leagueId: string
): Promise<Roster | null> {
  const rosters = await fetchSleeperLeagueRosters(leagueId);
  if (!rosters) return null;

  return (
    rosters.find(
      (roster: Roster) =>
        roster.owner_id === userId ||
        (roster.co_owners && roster.co_owners.includes(userId))
    ) ?? null
  );
}

export async function fetchSleeperLeagueMatchups(
  leagueId: string,
  week: number
): Promise<Matchup[] | null> {
  const url = `${SLEEPER_BASE_URL}/league/${leagueId}/matchups/${week}`;

  return await makeRequest<Matchup[]>(url);
}

export async function fetchSleeperLeaguePlayoffBracket(
  leagueId: string,
  bracketType: "winners_bracket" | "losers_bracket" = "winners_bracket"
): Promise<PlayoffMatchup[] | null> {
  const url = `${SLEEPER_BASE_URL}/league/${leagueId}/${bracketType}`;

  return await makeRequest<PlayoffMatchup[]>(url);
}

export async function fetchSleeperNFLState(): Promise<NFLState | null> {
  const url = `${SLEEPER_BASE_URL}/state/nfl`;

  return await makeRequest<NFLState>(url);
}

export async function fetchSleeperTrendingPlayers(
  trendingType: "add" | "drop" = "add"
): Promise<PlayerTrend[] | null> {
  const url = `${SLEEPER_BASE_URL}/players/nfl/trending/${trendingType}`;

  return await makeRequest<PlayerTrend[]>(url);
}
