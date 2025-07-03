export interface Player {
  player_id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  team: string | null;
  position: string;
  fantasy_positions: string[];
  jersey_number: number | null;
  age: number | null;
  birth_date: string | null;
  college: string | null;
  rookie_year: string | null;
  weight: string | null;
  height: string | null;
  years_exp: number | null;
}

export interface SyncState {
  source: string;
  last_updated_at: string;
}
