/* eslint-disable @typescript-eslint/no-explicit-any */
// players.test.ts
import {
  upsertAllPlayers,
  getPlayersByIds,
  getAllPlayers,
  getSyncStateFor,
} from "./players";
import { createClient } from "../server";
import { fetchSleeperPlayers } from "@/lib/api/sleeper/sleeper-api";
import { SupabaseClient } from "@supabase/supabase-js";

jest.mock("../server");
jest.mock("@/lib/api/sleeper/sleeper-api");

describe("upsertAllPlayers", () => {
  let builder: {
    select: jest.Mock;
    eq: jest.Mock;
    maybeSingle: jest.Mock;
    upsert: jest.Mock;
  };
  let mockSupabase: { from: jest.Mock };

  beforeEach(() => {
    builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(builder),
    };

    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );

    jest.spyOn(console, "info").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("skips if last sync was less than 48h ago", async () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    builder.maybeSingle.mockResolvedValueOnce({
      data: { last_updated_at: oneHourAgo },
      error: null,
    });

    await expect(upsertAllPlayers()).resolves.toBeUndefined();

    // Should check sync_state then return, but never call the Sleeper API
    expect(mockSupabase.from).toHaveBeenCalledWith("sync_state");
    expect(fetchSleeperPlayers).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalledWith("players");
  });

  it("skips if API returns null but has prior sync_state >48h ago", async () => {
    const threeDaysAgo = new Date(
      Date.now() - 72 * 60 * 60 * 1000
    ).toISOString();
    builder.maybeSingle.mockResolvedValueOnce({
      data: { last_updated_at: threeDaysAgo },
      error: null,
    });
    (fetchSleeperPlayers as jest.Mock).mockResolvedValueOnce(null);

    await expect(upsertAllPlayers()).resolves.toBeUndefined();

    expect(fetchSleeperPlayers).toHaveBeenCalled();
    // Logs and returns, but does not upsert players or sync_state again
    expect(mockSupabase.from).toHaveBeenCalledWith("sync_state");
    expect(mockSupabase.from).not.toHaveBeenCalledWith("players");
  });

  it("throws on initial load failure when no data and no prior sync", async () => {
    // maybeSingle → data: null
    (fetchSleeperPlayers as jest.Mock).mockResolvedValueOnce(null);

    await expect(upsertAllPlayers()).rejects.toThrow(
      "upsertAllPlayers: initial load failed - no data from Sleeper API and no existing records."
    );
  });

  it("processes one chunk and upserts sync_state on success", async () => {
    const externalPlayers = [
      {
        player_id: "p1",
        full_name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        team: "NYG",
        position: "QB",
        fantasy_positions: ["QB"],
        number: 12,
        age: 25,
        birth_date: "1995-01-01",
        college: "UCLA",
        metadata: { rookie_year: 2017 },
        weight: 210,
        height: "6-2",
        years_exp: 5,
      },
    ];
    (fetchSleeperPlayers as jest.Mock).mockResolvedValueOnce(externalPlayers);

    await expect(upsertAllPlayers()).resolves.toBeUndefined();

    // Should fetch and then upsert the single chunk
    expect(fetchSleeperPlayers).toHaveBeenCalled();
    expect(mockSupabase.from).toHaveBeenCalledWith("players");
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: "p1",
          full_name: "John Doe",
          jersey_number: 12,
          rookie_year: 2017,
        }),
      ]),
      { onConflict: "player_id" }
    );

    // Finally, sync_state is updated
    expect(mockSupabase.from).toHaveBeenCalledWith("sync_state");
    expect(builder.upsert).toHaveBeenCalledWith({ source: "players" });
  });

  it("retries up to MAX_RETRIES on chunk failure then succeeds", async () => {
    const externalPlayers = [
      {
        player_id: "p1",
        full_name: "John Doe",
        first_name: "John",
        last_name: "Doe",
        team: "NYG",
        position: "QB",
        fantasy_positions: ["QB"],
        number: 12,
        age: 25,
        birth_date: "1995-01-01",
        college: "UCLA",
        metadata: { rookie_year: 2017 },
        weight: 210,
        height: "6-2",
        years_exp: 5,
      },
    ];
    (fetchSleeperPlayers as jest.Mock).mockResolvedValueOnce(externalPlayers);

    let callCount = 0;
    // Fail the first two attempts, succeed on the third
    builder.upsert.mockImplementation(async () => {
      callCount++;
      return callCount <= 2
        ? { error: { message: "transient" } }
        : { error: null };
    });

    await expect(upsertAllPlayers()).resolves.toBeUndefined();

    // Should have tried 3 times (initial + 2 retries)
    expect(builder.upsert).toHaveBeenCalledTimes(4);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("players chunk 0 failed on attempt 1")
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("players chunk 0 failed on attempt 2")
    );
  });
});

describe("getPlayersByIds", () => {
  let builder: any;
  let mockSupabase: any;

  beforeEach(() => {
    builder = {
      select: jest.fn().mockReturnThis(),
      in: jest
        .fn()
        .mockReturnValue({ data: [{ player_id: "p1" }], error: null }),
    };
    mockSupabase = { from: jest.fn().mockReturnValue(builder) };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
  });

  it("returns data when query succeeds", async () => {
    const rows = await getPlayersByIds(["p1", "p2"]);
    expect(mockSupabase.from).toHaveBeenCalledWith("players");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.in).toHaveBeenCalledWith("player_id", ["p1", "p2"]);
    expect(rows).toEqual([{ player_id: "p1" }]);
  });

  it("throws if the query errors", async () => {
    builder.in.mockReturnValueOnce({ data: null, error: { message: "oops" } });
    await expect(getPlayersByIds(["p1"])).rejects.toThrow(
      "getPlayersByIds: oops"
    );
  });
});

describe("getAllPlayers", () => {
  let builder: any;
  let mockSupabase: any;

  beforeEach(() => {
    builder = {
      select: jest
        .fn()
        .mockReturnValue({ data: [{ player_id: "pX" }], error: null }),
    };
    mockSupabase = { from: jest.fn().mockReturnValue(builder) };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
  });

  it("returns all players on success", async () => {
    const rows = await getAllPlayers();
    expect(mockSupabase.from).toHaveBeenCalledWith("players");
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(rows).toEqual([{ player_id: "pX" }]);
  });

  it("throws if select errors", async () => {
    builder.select.mockReturnValueOnce({
      data: null,
      error: { message: "fail fetch" },
    });
    await expect(getAllPlayers()).rejects.toThrow(
      "getAllPlayers failed: fail fetch"
    );
  });
});

describe("getSyncStateFor", () => {
  let builder: any;
  let mockSupabase: any;

  beforeEach(() => {
    builder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { last_updated_at: "2025-06-01T00:00:00Z" },
        error: null,
      }),
    };
    mockSupabase = { from: jest.fn().mockReturnValue(builder) };
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
  });

  it("returns sync state when present", async () => {
    const state = await getSyncStateFor("players");
    expect(mockSupabase.from).toHaveBeenCalledWith("sync_state");
    expect(builder.select).toHaveBeenCalledWith("last_updated_at");
    expect(builder.eq).toHaveBeenCalledWith("source", "players");
    expect(state).toEqual({ last_updated_at: "2025-06-01T00:00:00Z" });
  });

  it("throws if maybeSingle errors", async () => {
    builder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "bad" },
    });
    await expect(getSyncStateFor("players")).rejects.toThrow(
      "Failed to read sync state bad"
    );
  });
});
