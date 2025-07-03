export interface User {
  username: string;
  user_id: string;
  display_name: string;
  avatar: string;
  metadata: {
    team_name?: string;
  } | null;
}

export interface LeagueUser {
  display_name: string;
  user_id: string;
}
