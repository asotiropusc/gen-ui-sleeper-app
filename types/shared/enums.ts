export enum PlayoffRoundType {
  ONE_WEEK_PER_ROUND = "one_week_per_round",
  TWO_WEEK_CHAMPIONSHIP = "two_week_championship",
  TWO_WEEKS_PER_ROUND = "two_weeks_per_round",
}

export enum WaiverType {
  RollingWaivers = "rolling_waviers",
  ReverseStandings = "reversse_standings",
  FAABBidding = "faab_bidding",
}

export enum ScoringFormat {
  Standard = "Standard",
  PPR = "PPR",
  HalfPPR = "Half PPR",
  StandardSuperFlex = "Standard Super Flex",
  PPRSuperFlex = "PPR Super Flex",
  HalfPPRSuperFlex = "Half PPR Super Flex",
}

export enum LeagueFormat {
  Redraft = "redraft",
  Keeper = "keeper",
  Dynasty = "dynasty",
}

export enum RosterType {
  Classic = "classic",
  BestBall = "best ball",
}

export function typedEntries<K extends string, V>(
  o: Partial<Record<K, V>>
): [K, V][] {
  return Object.entries(o) as [K, V][];
}
