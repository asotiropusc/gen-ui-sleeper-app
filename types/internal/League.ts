import {
  LeagueFormat,
  PlayoffRoundType,
  RosterType,
  ScoringFormat,
  WaiverType,
} from "../shared/enums";

export type RoundName = "quarterfinals" | "semifinals" | "finals";
export type PlayoffWeekMap = Partial<Record<RoundName, number[]>>;

export interface League {
  league_id: string;
  league_group_id: string;
  league_name: string;

  // split out into two fields:
  scoring_format: ScoringFormat;
  league_format: LeagueFormat;
  roster_type: RosterType;

  season: string;
  status: string;
  avatar_id: string | null;
  total_rosters: number;
  roster_positions: string[];

  scoring_settings: Record<string, number>;
  waiver_budget: number;
  waiver_type: WaiverType;
  waiver_day_of_week: number;
  trade_deadline: number;
  draft_rounds: number;
  reserve_slots: number;
  taxi_slots: number;
  taxi_deadline: number;
  taxi_years: number;
  playoff_week_start: number;
  playoff_teams: number;
  playoff_round_type: PlayoffRoundType;
  regular_season_weeks: number;
  total_weeks: number;
  playoff_rounds: RoundName[];
  playoff_week_map: PlayoffWeekMap;
  playoff_bye_teams_count: number;
}

export interface BrokenLeagueHistory {
  league_group_id: string;
}

export interface LeagueMemberRow {
  league_id: string;
  roster_id: number;
  sleeper_user_id: string;
  league_username: string | null;
}
