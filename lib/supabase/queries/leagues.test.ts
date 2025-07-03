// leagues.test.ts
import * as leaguesModule from "./leagues";
import { createClient } from "../server";
import {
  fetchSleeperUserLeagues,
  fetchSleeperUserLeague,
  fetchSleeperLeagueRosters,
  fetchSleeperLeagueUsers,
} from "@/lib/api/sleeper/sleeper-api";
import {
  getAuthenticatedUserId,
  getAuthenticatedUserSleeperId,
} from "./user-id";
import { SupabaseClient } from "@supabase/supabase-js";

jest.mock("../server");
jest.mock("@/lib/api/sleeper/sleeper-api");
jest.mock("./user-id");

const { populateAllLeaguesForUser, populateAllLeagueMembersForUser } =
  leaguesModule;

describe("populateAllLeaguesForUser", () => {
  const sampleExternalLeague = {
    league_id: "L1",
    name: "Test League",
    season: 2025,
    status: "in_progress",
    avatar: null,
    total_rosters: 10,
    roster_positions: ["QB", "RB"],
    scoring_settings: { rec: 1, pass_td: 4 },
    settings: {
      waiver_budget: 100,
      waiver_type: 0,
      waiver_day_of_week: 3,
      trade_deadline: 5,
      draft_rounds: 10,
      reserve_slots: 5,
      type: 0,
      best_ball: 0,
      taxi_slots: 2,
      taxi_deadline: 2,
      taxi_years: 1,
      playoff_week_start: 14,
      playoff_teams: 4,
      playoff_round_type: 0,
    },
    previous_league_id: null,
  };

  let builderLeagues: { select: jest.Mock; in: jest.Mock; upsert: jest.Mock };
  let builderBroken: { upsert: jest.Mock };
  let builderUserLeagues: { upsert: jest.Mock };
  let mockSupabase: { from: jest.Mock };

  beforeEach(() => {
    builderLeagues = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    builderBroken = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };
    builderUserLeagues = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "leagues") return builderLeagues;
        if (table === "broken_league_histories") return builderBroken;
        if (table === "user_leagues") return builderUserLeagues;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
    (getAuthenticatedUserId as jest.Mock).mockResolvedValue("appUser1");
    (getAuthenticatedUserSleeperId as jest.Mock).mockResolvedValue(
      "sleeperUser1"
    );
  });

  it("throws if the user has no leagues", async () => {
    (fetchSleeperUserLeagues as jest.Mock).mockResolvedValue([]);
    await expect(populateAllLeaguesForUser()).rejects.toThrow(
      "No leagues found for this user."
    );
    // should never attempt a broken‐history upsert
    expect(mockSupabase.from).not.toHaveBeenCalledWith(
      "broken_league_histories"
    );
  });

  it("throws if broken_league_histories upsert fails", async () => {
    (fetchSleeperUserLeagues as jest.Mock).mockResolvedValue([
      sampleExternalLeague,
    ]);
    // simulate broken chain immediately
    (fetchSleeperUserLeague as jest.Mock).mockResolvedValueOnce(null);

    builderBroken.upsert.mockResolvedValueOnce({
      error: { message: "bh error" },
    });

    await expect(populateAllLeaguesForUser()).rejects.toThrow(
      "Upserting league_history_status failed: bh error"
    );
    expect(mockSupabase.from).toHaveBeenCalledWith("broken_league_histories");
  });

  it("throws if leagues table upsert fails", async () => {
    (fetchSleeperUserLeagues as jest.Mock).mockResolvedValue([
      sampleExternalLeague,
    ]);
    // valid chain
    (fetchSleeperUserLeague as jest.Mock).mockResolvedValueOnce(
      sampleExternalLeague
    );

    builderLeagues.upsert.mockResolvedValueOnce({
      error: { message: "leagues err" },
    });

    await expect(populateAllLeaguesForUser()).rejects.toThrow(
      "Upserting leagues failed: leagues err"
    );
    expect(mockSupabase.from).toHaveBeenCalledWith("leagues");
  });

  it("throws if user_leagues upsert fails", async () => {
    (fetchSleeperUserLeagues as jest.Mock).mockResolvedValue([
      sampleExternalLeague,
    ]);
    (fetchSleeperUserLeague as jest.Mock).mockResolvedValueOnce(
      sampleExternalLeague
    );

    builderUserLeagues.upsert.mockResolvedValueOnce({
      error: { message: "user leagues err" },
    });

    await expect(populateAllLeaguesForUser()).rejects.toThrow(
      "Upserting user_leagues failed: user leagues err"
    );
    expect(mockSupabase.from).toHaveBeenCalledWith("user_leagues");
  });

  it("resolves with an array of league IDs on success", async () => {
    (fetchSleeperUserLeagues as jest.Mock).mockResolvedValue([
      sampleExternalLeague,
    ]);
    (fetchSleeperUserLeague as jest.Mock).mockResolvedValueOnce(
      sampleExternalLeague
    );

    // all upserts succeed
    builderBroken.upsert.mockResolvedValue({ error: null });
    builderLeagues.upsert.mockResolvedValue({ error: null });
    builderUserLeagues.upsert.mockResolvedValue({ error: null });

    const result = await populateAllLeaguesForUser();
    expect(result).toEqual([sampleExternalLeague.league_id]);
    expect(mockSupabase.from).toHaveBeenCalledWith("leagues");
    expect(mockSupabase.from).toHaveBeenCalledWith("user_leagues");
  });
});

describe("populateAllLeagueMembersForUser", () => {
  let builderUserLookup: {
    select: jest.Mock;
    eq: jest.Mock;
    maybeSingle: jest.Mock;
  };
  let builderLeagueMembers: { upsert: jest.Mock };
  let mockSupabase: { from: jest.Mock };

  beforeEach(() => {
    builderUserLookup = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: "appUser1" },
        error: null,
      }),
    };

    builderLeagueMembers = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase = {
      from: jest.fn((table: string) => {
        if (table === "users") return builderUserLookup;
        if (table === "league_members") return builderLeagueMembers;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );

    (fetchSleeperLeagueRosters as jest.Mock).mockResolvedValue([
      { roster_id: 100, owner_id: "u1", co_owners: [] },
      { roster_id: 200, owner_id: "u2", co_owners: ["u3"] },
    ]);
    (fetchSleeperLeagueUsers as jest.Mock).mockResolvedValue([
      { user_id: "u1", display_name: "User One" },
      { user_id: "u3", display_name: "User Three" },
    ]);
  });

  it("upserts league_members for each provided league", async () => {
    await expect(
      populateAllLeagueMembersForUser(["L1", "L2"])
    ).resolves.toBeUndefined();

    // should upsert once per league ID
    expect(builderLeagueMembers.upsert).toHaveBeenCalledTimes(2);

    // check one of the rows
    expect(builderLeagueMembers.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          league_id: "L1",
          roster_id: 100,
          sleeper_user_id: "u1",
          league_username: "User One",
          user_id: "appUser1",
        }),
      ]),
      { onConflict: "league_id,roster_id,sleeper_user_id" }
    );
  });

  it("continues when user lookup errors", async () => {
    builderUserLookup.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "lookup err" },
    });
    const consoleErr = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      populateAllLeagueMembersForUser(["L1"])
    ).resolves.toBeUndefined();

    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });
});
