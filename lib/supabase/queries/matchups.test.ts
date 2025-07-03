/* eslint-disable @typescript-eslint/no-explicit-any */
// matchups.test.ts
import {
  mapMatchupStatus,
  populateAllMatchupsForUser,
  populateAllPlayoffMatchupsForUser,
  getPlayoffMatchupsForLeague,
} from "./matchups";
import { MatchupStatus } from "@/types/internal/Matchup";
import { createClient } from "../server";
import {
  fetchSleeperNFLState,
  fetchSleeperLeagueMatchups,
  fetchSleeperLeaguePlayoffBracket,
} from "@/lib/api/sleeper/sleeper-api";
import { SupabaseClient } from "@supabase/supabase-js";

jest.mock("../server");
jest.mock("@/lib/api/sleeper/sleeper-api");

describe("mapMatchupStatus", () => {
  it("returns Completed if season < currentSeason", () => {
    expect(mapMatchupStatus("2024", 5, "2025", 6)).toBe(
      MatchupStatus.Completed
    );
  });

  it("returns Completed if same season but week < currentWeek", () => {
    expect(mapMatchupStatus("2025", 1, "2025", 2)).toBe(
      MatchupStatus.Completed
    );
  });

  it("returns InProgress if week === currentWeek", () => {
    expect(mapMatchupStatus("2025", 3, "2025", 3)).toBe(
      MatchupStatus.InProgress
    );
  });

  it("returns Upcoming if week > currentWeek", () => {
    expect(mapMatchupStatus("2025", 4, "2025", 3)).toBe(MatchupStatus.Upcoming);
  });
});

describe("populateAllMatchupsForUser", () => {
  let leagueInfoBuilder: any;
  let matchupBuilder: any;
  let playerBuilder: any;
  let mockSupabase: { from: jest.Mock };

  beforeEach(() => {
    leagueInfoBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          season: "2025",
          total_weeks: 2,
          roster_positions: ["QB", "RB", "WR"],
        },
        error: null,
      }),
    };

    matchupBuilder = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    playerBuilder = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "leagues") return leagueInfoBuilder;
        if (table === "matchups") return matchupBuilder;
        if (table === "matchup_players") return playerBuilder;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );

    (fetchSleeperNFLState as jest.Mock).mockResolvedValue({
      league_season: "2025",
      week: 1,
    });

    (fetchSleeperLeagueMatchups as jest.Mock).mockImplementation(
      async (_leagueId: string, week: number) =>
        week === 1
          ? [
              {
                matchup_id: week,
                roster_id: 100 + week,
                points: 50 + week,
                players: ["p1", "p2"],
                players_points: { p1: 25 + week, p2: 25 + week },
                starters: ["p1"],
              },
              {
                matchup_id: week,
                roster_id: 200 + week,
                points: 45 + week,
                players: ["p3"],
                players_points: { p3: 45 + week },
                starters: [],
              },
            ]
          : null
    );
  });

  it("upserts both matchups and matchup_players for weeks with data and skips null weeks", async () => {
    await expect(populateAllMatchupsForUser(["L1"])).resolves.toBeUndefined();

    // league info fetched
    expect(mockSupabase.from).toHaveBeenCalledWith("leagues");
    expect(leagueInfoBuilder.select).toHaveBeenCalledWith(
      "season,total_weeks,roster_positions"
    );
    expect(leagueInfoBuilder.eq).toHaveBeenCalledWith("league_id", "L1");
    expect(leagueInfoBuilder.single).toHaveBeenCalled();

    // week 1 has data → one upsert each
    expect(mockSupabase.from).toHaveBeenCalledWith("matchups");
    expect(matchupBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          league_id: "L1",
          week: 1,
          roster_one_score: expect.any(Number),
        }),
      ]),
      { onConflict: "matchup_uuid" }
    );

    expect(mockSupabase.from).toHaveBeenCalledWith("matchup_players");
    expect(playerBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ player_id: "p1", started: true }),
      ]),
      { onConflict: "matchup_uuid,roster_id,player_id" }
    );

    // week 2 is null → no additional upsert
    // total upserts should be exactly 1 call each
    expect(matchupBuilder.upsert).toHaveBeenCalledTimes(1);
    expect(playerBuilder.upsert).toHaveBeenCalledTimes(1);
  });

  it("throws if fetchSleeperNFLState returns null", async () => {
    (fetchSleeperNFLState as jest.Mock).mockResolvedValueOnce(null);
    await expect(populateAllMatchupsForUser(["L1"])).rejects.toThrow(
      "Issue fetching NFL State."
    );
  });

  it("logs and continues on matchups upsert errors", async () => {
    // make the upsert for matchups return an error
    matchupBuilder.upsert.mockResolvedValueOnce({
      error: { message: "db fail" },
    });
    const consoleErr = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(populateAllMatchupsForUser(["L1"])).resolves.toBeUndefined();

    expect(consoleErr).toHaveBeenCalledWith(
      expect.stringContaining("Failed to upsert league matchups for L1"),
      "Failed upserting matchups for league L1 week 1"
    );
    consoleErr.mockRestore();
  });
});

describe("populateAllPlayoffMatchupsForUser", () => {
  let leagueInfoBuilder: any;
  let historyBuilder: any;
  let playoffBuilder: any;
  let mockSupabase: { from: jest.Mock };

  beforeEach(() => {
    leagueInfoBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          season: "2025",
          playoff_week_start: 3,
          playoff_week_map: { semifinals: [3], finals: [4] },
          total_weeks: 4,
        },
        error: null,
      }),
    };

    historyBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          { week: 3, matchup_id: 100, matchup_uuid: "u100" },
          { week: 4, matchup_id: 200, matchup_uuid: "u200" },
        ],
        error: null,
      }),
    };

    playoffBuilder = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "leagues") return leagueInfoBuilder;
        if (table === "matchups") return historyBuilder;
        if (table === "playoff_matchups") return playoffBuilder;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
    (fetchSleeperNFLState as jest.Mock).mockResolvedValue({
      league_season: "2025",
      week: 3,
    });

    // both brackets present by default
    (fetchSleeperLeaguePlayoffBracket as jest.Mock)
      .mockResolvedValueOnce([{ m: 100, r: 0, p: 1 }])
      .mockResolvedValueOnce([{ m: 200, r: 1, p: 2 }]);
  });

  it("upserts playoff_matchups when brackets exist and season matches", async () => {
    await expect(
      populateAllPlayoffMatchupsForUser(["L1"])
    ).resolves.toBeUndefined();

    // fetched league info
    expect(mockSupabase.from).toHaveBeenCalledWith("leagues");
    expect(leagueInfoBuilder.select).toHaveBeenCalledWith(
      "season, playoff_week_start, playoff_week_map, total_weeks"
    );

    // fetched past playoff matchups
    expect(mockSupabase.from).toHaveBeenCalledWith("matchups");
    expect(historyBuilder.select).toHaveBeenCalledWith("*");
    expect(historyBuilder.eq).toHaveBeenCalledWith("league_id", "L1");
    expect(historyBuilder.gte).toHaveBeenCalledWith("week", 3);
    expect(historyBuilder.order).toHaveBeenCalledWith("week", {
      ascending: true,
    });

    // finally upsert playoff rows
    expect(mockSupabase.from).toHaveBeenCalledWith("playoff_matchups");
    expect(playoffBuilder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ bracket_type: "winners" }),
        expect.objectContaining({ bracket_type: "losers" }),
      ]),
      { onConflict: "matchup_uuid" }
    );
  });

  it("skips upsert entirely if bracket fetch returns null", async () => {
    (fetchSleeperLeaguePlayoffBracket as jest.Mock)
      .mockReset()
      .mockImplementation(async () => null);
    const consoleWarn = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      populateAllPlayoffMatchupsForUser(["L1"])
    ).resolves.toBeUndefined();

    expect(playoffBuilder.upsert).not.toHaveBeenCalled();
    consoleWarn.mockRestore();
  });

  it("throws if final playoff_matchups upsert errors", async () => {
    playoffBuilder.upsert.mockResolvedValueOnce({
      error: { message: "up fail" },
    });

    await expect(populateAllPlayoffMatchupsForUser(["L1"])).rejects.toThrow(
      "populateAllPlayoffMatchupsForUser: failed to upsert playoff_matchups: up fail"
    );
  });
});

describe("getPlayoffMatchupsForLeague", () => {
  let historyBuilder: any;
  let mockSupabase: { from: jest.Mock };

  beforeEach(() => {
    historyBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [{ week: 5, matchup_id: 123, matchup_uuid: "u123" }],
        error: null,
      }),
    };

    mockSupabase = {
      from: jest.fn(() => historyBuilder),
    };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
  });

  it("returns rows when there is no error", async () => {
    const rows = await getPlayoffMatchupsForLeague("L1", 5);
    expect(rows).toEqual([{ week: 5, matchup_id: 123, matchup_uuid: "u123" }]);

    expect(historyBuilder.select).toHaveBeenCalledWith("*");
    expect(historyBuilder.eq).toHaveBeenCalledWith("league_id", "L1");
    expect(historyBuilder.gte).toHaveBeenCalledWith("week", 5);
    expect(historyBuilder.order).toHaveBeenCalledWith("week", {
      ascending: true,
    });
  });

  it("throws if the query errors", async () => {
    historyBuilder.order.mockResolvedValueOnce({
      data: null,
      error: { message: "fetch failed" },
    });
    await expect(getPlayoffMatchupsForLeague("L1", 5)).rejects.toThrow(
      "getPlayoffMatchupsForLeague: fetch failed"
    );
  });
});
