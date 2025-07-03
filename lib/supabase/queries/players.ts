import { fetchSleeperPlayers } from "@/lib/api/sleeper/sleeper-api";
import { createClient } from "../server";
import { Player, SyncState } from "@/types/internal/Player";
import { Player as ExternalPlayer } from "@/types/external/Player";
import { SupabaseClient } from "@supabase/supabase-js";

const MAX_RETRIES = 2;
const CHUNK_SIZE = 1000;

async function upsertChunk(
  supabase: SupabaseClient,
  rows: Player[],
  chunkIndex: number,
  attempt: number = 1
): Promise<void> {
  const { error } = await supabase
    .from("players")
    .upsert(rows, { onConflict: "player_id" });

  if (error) {
    if (attempt <= MAX_RETRIES) {
      console.warn(
        `players chunk ${chunkIndex} failed on attempt ${attempt}, retrying…`
      );
      return upsertChunk(supabase, rows, chunkIndex, attempt + 1);
    }

    console.error(
      `players chunk ${chunkIndex} permanently failed: ${error.message}`
    );
  }
}

export async function upsertAllPlayers(): Promise<void> {
  const supabase = await createClient();

  const syncState = await getSyncStateFor("players");

  if (syncState?.last_updated_at) {
    const lastUpdated = new Date(syncState.last_updated_at);
    const now = new Date();
    const hoursSinceLast =
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLast < 48) {
      console.info(
        `upsertAllPlayers: only ${hoursSinceLast.toFixed(
          1
        )}h since last sync, skipping.`
      );
      return;
    }
  }

  const players = await fetchSleeperPlayers();
  if (!players && !syncState?.last_updated_at) {
    throw new Error(
      "upsertAllPlayers: initial load failed - no data from Sleeper API and no existing records."
    );
  }

  if (!players) {
    console.info(
      "upsertAllPlayers: failed to fetch players from Sleeper API. Using previous player data."
    );
    return;
  }

  const rows: Player[] = Object.values(players).map((p: ExternalPlayer) => ({
    player_id: p.player_id,
    full_name: p.full_name,
    first_name: p.first_name,
    last_name: p.last_name,
    team: p.team,
    position: p.position,
    fantasy_positions: p.fantasy_positions,
    jersey_number: p.number,
    age: p.age,
    birth_date: p.birth_date ? p.birth_date : null,
    college: p.college,
    rookie_year: p.metadata?.rookie_year ? p.metadata.rookie_year : null,
    weight: p.weight,
    height: p.height,
    years_exp: p.years_exp,
  }));

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await upsertChunk(supabase, chunk, i / CHUNK_SIZE);
  }

  await supabase.from("sync_state").upsert({ source: "players" });

  console.info("upsertAllPlayers: all chunks processed");
}

export async function getPlayersByIds(playerIds: string[]): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .in("player_id", playerIds);

  if (error) {
    throw new Error(`getPlayersByIds: ${error.message}`);
  }

  return (data || []) as Player[];
}

export async function getAllPlayers(): Promise<Player[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("players").select("*");

  if (error) {
    throw new Error(`getAllPlayers failed: ${error.message}`);
  }

  return (data ?? []) as Player[];
}

export async function getSyncStateFor(
  column: string
): Promise<Partial<SyncState> | null> {
  const supabase = await createClient();

  const { data: syncState, error } = await supabase
    .from("sync_state")
    .select("last_updated_at")
    .eq("source", column)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read sync state ${error.message}`);
  }

  return syncState;
}
