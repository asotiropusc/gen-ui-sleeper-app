// /types/internal/matchups.ts

import { RoundName } from "./League";

// Matches CREATE TYPE matchup_status_enum …
export enum MatchupStatus {
  Upcoming = "upcoming",
  InProgress = "in_progress",
  Completed = "completed",
}

export type BracketType = "winners" | "losers";

export type SourceType = "winner" | "loser";

export interface MatchupRow {
  matchup_uuid: string;
  league_id: string;
  matchup_status: MatchupStatus;
  season: string;
  week: number;
  matchup_id: number | null;
  roster_one_id: number;
  roster_two_id: number | null;
  roster_one_score: number;
  roster_two_score: number | null;
  winning_roster_id: number | null;
}

export interface MatchupPlayerRow {
  matchup_uuid: string;
  roster_id: number;
  player_id: string;
  roster_position: string;
  started: boolean;
  points: number;
  opposing_team: string | null;
}

export interface PlayoffMatchupRow {
  matchup_uuid: string;
  round_name: RoundName | null;
  bracket_type: BracketType;
  playoff_position: number | null;
  previous_matchup_one: string | null;
  previous_matchup_two: string | null;
  source_type: SourceType | null;
}
