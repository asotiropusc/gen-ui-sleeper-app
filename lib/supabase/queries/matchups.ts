import {
  fetchSleeperLeagueMatchups,
  fetchSleeperLeaguePlayoffBracket,
  fetchSleeperNFLState,
} from "@/lib/api/sleeper/sleeper-api";
import { createClient } from "../server";
import pLimit from "p-limit";
import {
  MatchupPlayerRow,
  MatchupRow,
  MatchupStatus,
  PlayoffMatchupRow,
} from "@/types/internal/Matchup";
import { Matchup } from "@/types/external/Matchup";
import { v4 as uuidv4 } from "uuid";
import {
  BracketReference,
  PlayoffMatchup,
} from "@/types/external/PlayoffMatchup";
import { PostgrestError } from "@supabase/supabase-js";
import { League, RoundName } from "@/types/internal/League";
import { PlayoffRoundType, typedEntries } from "@/types/shared/enums";

type PlayoffLeagueInfo = Pick<
  League,
  | "season"
  | "playoff_week_start"
  | "playoff_week_map"
  | "playoff_round_type"
  | "total_weeks"
>;

export function mapMatchupStatus(
  season: string,
  week: number,
  currentSeason: string,
  currentWeek: number
): MatchupStatus {
  if (season < currentSeason || week < currentWeek) {
    return MatchupStatus.Completed;
  }

  return week === currentWeek
    ? MatchupStatus.InProgress
    : MatchupStatus.Upcoming;
}

function buildMatchupRow(
  matchPair: Matchup[],
  leagueId: string,
  season: string,
  week: number,
  status: MatchupStatus
): MatchupRow {
  const uuid = uuidv4();

  const isCompleteMatchup = matchPair.length === 2;
  const [a, b] = matchPair;
  const rosterOneScore = Number(a.points.toFixed(2));
  const rosterTwoScore = isCompleteMatchup ? Number(b.points.toFixed(2)) : null;

  let winner: number | null;
  if (!isCompleteMatchup) {
    winner = a.roster_id;
  } else if (rosterOneScore > rosterTwoScore!) {
    winner = a.roster_id;
  } else if (rosterTwoScore! > rosterOneScore) {
    winner = b.roster_id;
  } else {
    winner = null;
  }

  return {
    matchup_uuid: uuid,
    league_id: leagueId,
    matchup_status: status,
    season,
    week,
    matchup_id: isCompleteMatchup ? a.matchup_id : null,
    roster_one_id: a.roster_id,
    roster_two_id: isCompleteMatchup ? b.roster_id : null,
    roster_one_score: rosterOneScore,
    roster_two_score: rosterTwoScore,
    winning_roster_id: winner,
  };
}

function makePlayoffIdToRosterMap(
  bracket: PlayoffMatchup[]
): Record<string, (number | null)[]> {
  return Object.fromEntries(
    bracket.map((b) => [String(b.m), [b.t1, b.t2]] as const)
  );
}

function weeksForRound(
  playoffRoundType: PlayoffRoundType,
  playoffWeekStart: number,
  roundIndex: number,
  isChampionship: boolean
): number[] {
  const baseWeek = playoffWeekStart + roundIndex - 1;

  switch (playoffRoundType) {
    case PlayoffRoundType.ONE_WEEK_PER_ROUND:
      return [baseWeek];

    case PlayoffRoundType.TWO_WEEK_CHAMPIONSHIP:
      // Only finals (last round) get two weeks
      return isChampionship ? [baseWeek, baseWeek + 1] : [baseWeek];

    case PlayoffRoundType.TWO_WEEKS_PER_ROUND:
      // Every round spans two weeks
      return [baseWeek, baseWeek + 1];

    default:
      return [baseWeek];
  }
}

function mapBracketToRows(
  type: "winners" | "losers",
  bracket: PlayoffMatchup[],
  matchupLookup: Record<string, string>,
  leagueRow: PlayoffLeagueInfo
): PlayoffMatchupRow[] {
  return bracket.flatMap((b): PlayoffMatchupRow[] => {
    const weeks = weeksForRound(
      leagueRow.playoff_round_type,
      leagueRow.playoff_week_start,
      b.r,
      b.p === 1
    );

    return weeks.map((week) => {
      const key1 = `${week}|${b.t1}|${b.t2}`;
      const key2 = `${week}|${b.t2}|${b.t1}`;

      const matchupUuid = matchupLookup[key1] ?? matchupLookup[key2];

      const hasWinnerSource =
        (b.t1_from && "w" in b.t1_from) || (b.t2_from && "w" in b.t2_from);

      const roundName = hasWinnerSource
        ? typedEntries<RoundName, number[]>(leagueRow.playoff_week_map).find(
            ([, weeks]) => weeks.includes(week)
          )?.[0] ?? null
        : null;

      const indexToRosters = makePlayoffIdToRosterMap(bracket);

      return {
        matchup_uuid: matchupUuid,
        round_name: roundName,
        bracket_type: type,
        playoff_position: b.p ? b.p : null,
        previous_matchup_one: resolvePreviousMatchupUUID(
          b.t1_from ?? null,
          week - 1,
          matchupLookup,
          indexToRosters
        ),
        previous_matchup_two: resolvePreviousMatchupUUID(
          b.t2_from ?? null,
          week - 1,
          matchupLookup,
          indexToRosters
        ),
        source_type: hasWinnerSource ? "winner" : "loser",
      };
    });
  });
}

export async function populateAllMatchupsForUser(leagueIds: string[]) {
  const supabase = await createClient();

  const limit = pLimit(3);
  const nflState = await fetchSleeperNFLState();
  if (!nflState) throw new Error("Issue fetching NFL State.");

  const task = leagueIds.map((leagueId) =>
    limit(async () => {
      try {
        const { data: leagueRow, error: leagueErr } = await supabase
          .from("leagues")
          .select("season,total_weeks,playoff_week_start,roster_positions")
          .eq("league_id", leagueId)
          .single();

        if (leagueErr || !leagueRow) {
          throw new Error(
            `Missing league info for ${leagueId}: ${
              leagueErr?.message ?? "not found"
            }`
          );
        }

        const weeks = Array.from(
          { length: leagueRow.total_weeks },
          (_, i) => i + 1
        );

        const weekLimit = pLimit(3);
        const matchupsByWeek = await Promise.all(
          weeks.map((week) =>
            weekLimit(async () => ({
              week,
              matchups: await fetchSleeperLeagueMatchups(leagueId, week),
            }))
          )
        );

        for (const { week, matchups } of matchupsByWeek) {
          if (!matchups) continue;

          const isFirstPlayoffWeek = week === leagueRow.playoff_week_start;

          const groupedMatchup = matchups.reduce<Record<string, Matchup[]>>(
            (acc, m) => {
              if (m.matchup_id === null && !isFirstPlayoffWeek) {
                return acc;
              }

              const key = m.matchup_id ?? `bye:${m.roster_id}`;
              (acc[key] ||= []).push(m);
              return acc;
            },
            {}
          );
          const status: MatchupStatus = mapMatchupStatus(
            leagueRow.season,
            week,
            nflState.league_season,
            nflState.week
          );

          const weeklyMatchupRows: MatchupRow[] = [];
          const weeklyMatchupPlayerRows: MatchupPlayerRow[] = [];

          for (const pair of Object.values(groupedMatchup)) {
            const matchupRow = buildMatchupRow(
              pair,
              leagueId,
              leagueRow.season,
              week,
              status
            );
            weeklyMatchupRows.push(matchupRow);

            for (const roster of pair) {
              for (const playerId of roster.players) {
                const startIndex = roster.starters.indexOf(playerId);

                const roster_position =
                  startIndex >= 0
                    ? leagueRow.roster_positions[startIndex]
                    : "BN";

                const points = Number(
                  roster.players_points[playerId].toFixed(2)
                );

                weeklyMatchupPlayerRows.push({
                  matchup_uuid: matchupRow.matchup_uuid,
                  roster_id: roster.roster_id,
                  player_id: playerId,
                  roster_position,
                  started: startIndex >= 0,
                  points,
                  opposing_team: null,
                });
              }
            }
          }

          try {
            const { error: matchupErr } = await supabase
              .from("matchups")
              .upsert(weeklyMatchupRows, { onConflict: "matchup_uuid" });

            if (matchupErr) {
              throw new Error(
                `Failed to upsert matchups (on matchup_uuid): ${matchupErr.message}. `
              );
            }

            const CHUNK_SIZE = 100;

            for (
              let i = 0;
              i < weeklyMatchupPlayerRows.length;
              i += CHUNK_SIZE
            ) {
              const chunk = weeklyMatchupPlayerRows.slice(i, i + CHUNK_SIZE);

              const { error: playerErr } = await supabase
                .from("matchup_players")
                .upsert(chunk, {
                  onConflict: "matchup_uuid,roster_id,player_id",
                });

              if (playerErr) {
                console.error(`Chunk ${i / CHUNK_SIZE} failed:`, playerErr);
                throw new Error(
                  `Chunk upsert failed (rows ${i}–${i + CHUNK_SIZE}): ${
                    playerErr.message
                  }`
                );
              }
            }
          } catch (err) {
            if (isPostgrestError(err)) {
              console.error("DB error:", err.code, err.details, err.hint);
            } else {
              console.error(
                `Unexpected error: ${
                  err instanceof Error ? err.message : "Unknown error"
                }`
              );
            }
          }
        }
      } catch (err) {
        console.error(
          `Failed to upsert league matchups for ${leagueId}:`,
          (err as Error).message
        );
      }
    })
  );
  await Promise.all(task);
}

function resolvePreviousMatchupUUID(
  fromObj: BracketReference | null,
  prevWeek: number,
  matchupLookup: Record<string, string>,
  indexToRosters: Record<string, (number | null)[]>
): string | null {
  if (!fromObj) return null;
  const idx = "w" in fromObj ? fromObj.w : fromObj.l;

  const [r1, r2] = indexToRosters[idx] || [];

  const keyA = `${prevWeek}|${r1}|${r2}`;
  const keyB = `${prevWeek}|${r2}|${r1}`;
  return matchupLookup[keyA] ?? matchupLookup[keyB] ?? null;
}

export async function populateAllPlayoffMatchupsForUser(leagueIds: string[]) {
  const supabase = await createClient();

  const nflState = await fetchSleeperNFLState();
  if (!nflState) throw new Error("Issue fetching NFL State.");

  const playoffMatchupRows: PlayoffMatchupRow[] = [];

  await Promise.all(
    leagueIds.map(async (leagueId) => {
      try {
        const { data, error: leagueErr } = await supabase
          .from("leagues")
          .select(
            "season, playoff_week_start, playoff_week_map, playoff_round_type, total_weeks"
          )
          .eq("league_id", leagueId)
          .single();

        if (leagueErr || !data) {
          throw new Error(
            `Missing league info (${leagueErr?.message ?? "not found"})`
          );
        }

        // TODO: need to update get types from supabase
        const leagueRow: PlayoffLeagueInfo = data;

        if (
          leagueRow.season === nflState.league_season &&
          nflState.week < leagueRow.playoff_week_start
        ) {
          return;
        }

        const [winnersBracket, losersBracket] = await Promise.all([
          fetchSleeperLeaguePlayoffBracket(leagueId, "winners_bracket"),
          fetchSleeperLeaguePlayoffBracket(leagueId, "losers_bracket"),
        ]);

        if (!winnersBracket || !losersBracket) {
          throw new Error(
            `Failed to fetch playoff brackets for league ${leagueId}`
          );
        }
        const lastCompletedWeek =
          leagueRow.season === nflState.league_season
            ? Math.min(leagueRow.total_weeks, nflState.week)
            : leagueRow.total_weeks;

        const playoffMatchups = await getPlayoffMatchupsForLeague(
          leagueId,
          leagueRow.playoff_week_start,
          lastCompletedWeek
        );

        const playoffMatchLookup = Object.fromEntries(
          playoffMatchups.flatMap((m) => [
            [`${m.week}|${m.roster_one_id}|${m.roster_two_id}`, m.matchup_uuid],
            [`${m.week}|${m.roster_two_id}|${m.roster_one_id}`, m.matchup_uuid],
          ])
        );

        playoffMatchupRows.push(
          ...mapBracketToRows(
            "winners",
            winnersBracket,
            playoffMatchLookup,
            leagueRow
          ),
          ...mapBracketToRows(
            "losers",
            losersBracket,
            playoffMatchLookup,
            leagueRow
          )
        );
      } catch (err) {
        console.error(
          `League ${leagueId} playoff import failed:`,
          (err as Error).message
        );
      }
    })
  );

  if (playoffMatchupRows.length > 0) {
    const { error } = await supabase
      .from("playoff_matchups")
      .upsert(playoffMatchupRows, {
        onConflict: "matchup_uuid",
      });

    if (error) {
      throw new Error(
        `populateAllPlayoffMatchupsForUser: failed to upsert playoff_matchups: ${error.message}`
      );
    }
  }
}

export async function getPlayoffMatchupsForLeague(
  leagueId: string,
  playoffWeekStart: number,
  endWeek: number
): Promise<MatchupRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matchups")
    .select("*")
    .eq("league_id", leagueId)
    .gte("week", playoffWeekStart)
    .lte("week", endWeek)
    .order("week", { ascending: true });

  if (error) {
    throw new Error(`getPlayoffMatchupsForLeague: ${error.message}`);
  }

  return (data || []) as MatchupRow[];
}

function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    "details" in err &&
    "hint" in err
  );
}
