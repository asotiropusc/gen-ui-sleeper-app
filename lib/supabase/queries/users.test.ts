import { upsertUser } from "./users";
import { createClient } from "../server";
import { fetchSleeperUser } from "@/lib/api/sleeper/sleeper-api";
import { SupabaseClient } from "@supabase/supabase-js";

// Auto-mock those modules:
jest.mock("../server");
jest.mock("@/lib/api/sleeper/sleeper-api");

const mockSupabase = {
  auth: { getUser: jest.fn() },
  from: jest.fn().mockReturnValue({ upsert: jest.fn() }),
};

describe("upsertUser", () => {
  beforeEach(() => {
    (createClient as jest.Mock).mockResolvedValue(
      mockSupabase as unknown as SupabaseClient
    );
  });

  it("throws if not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "not auth" },
    });
    await expect(upsertUser("alice")).rejects.toThrow(
      "User must be authenticated"
    );
    expect(fetchSleeperUser).not.toHaveBeenCalled();
  });

  it("throws if fetchSleeperUser returns null", async () => {
    // authenticated
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    // sleeper lookup fails
    (fetchSleeperUser as jest.Mock).mockResolvedValue(null);

    await expect(upsertUser("alice")).rejects.toThrow(
      "Failed to fetch sleeper user"
    );
    expect(fetchSleeperUser).toHaveBeenCalledWith("alice");
  });

  it("throws if upsert returns an error", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    (fetchSleeperUser as jest.Mock).mockResolvedValue({
      user_id: "p1",
      username: "alice",
      avatar: "img.png",
    });
    // simulate upsert failure
    mockSupabase
      .from()
      .upsert.mockResolvedValue({ error: { message: "db err" } });

    await expect(upsertUser("alice")).rejects.toThrow(
      "Failed to insert user u1: db err"
    );
  });

  it("resolves successfully when everything works", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    (fetchSleeperUser as jest.Mock).mockResolvedValue({
      user_id: "p1",
      username: "alice",
      avatar: "img.png",
    });
    mockSupabase.from().upsert.mockResolvedValue({ error: null });

    await expect(upsertUser("alice")).resolves.toBeUndefined();
    // check that we tried to upsert with the right shape
    expect(mockSupabase.from).toHaveBeenCalledWith("users");
    expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "u1",
        sleeper_user_id: "p1",
        username: "alice",
        avatar_id: "img.png",
        last_synced_at: expect.any(Date),
      })
    );
  });
});
