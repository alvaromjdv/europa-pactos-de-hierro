export type PlayerID = "0" | "1" | "2" | "3" | "4" | "5";

export type Phase = "production" | "movement" | "battle" | "consolidation";

export type Terrain = "plains" | "mountain" | "forest" | "urban" | "coast";

export type EventCardKind = "production" | "sabotage" | "reinforcement" | "defense" | "crisis";

export type EventCard = {
  id: string;
  title: string;
  kind: EventCardKind;
  text: string;
};

export type GameDuration = "quick" | "standard";

export type MatchSettings = {
  numPlayers: 2 | 3 | 4;
  targetCapitals: number;
  duration: GameDuration;
  powerTarget: number;
  maxTurns: number;
};

export type TerritoryDefinition = {
  id: string;
  name: string;
  region: string;
  x: number;
  y: number;
  terrain: Terrain;
  resources: number;
  isCapital: boolean;
  startingOwner: PlayerID | null;
  connections: string[];
};

export type TerritoryState = TerritoryDefinition & {
  ownerId: PlayerID | null;
  troops: number;
  fortified: boolean;
};

export type BattleReport = {
  attackerRoll: number;
  defenderRoll: number;
  attackerPower: number;
  defenderPower: number;
  terrainDefenseBonus: number;
  conquered: boolean;
  attackerLosses: number;
  defenderLosses: number;
};

export type EuropaGameState = {
  territories: Record<string, TerritoryState>;
  phase: Phase;
  turnNumber: number;
  log: string[];
  deck: string[];
  hands: Partial<Record<PlayerID, EventCard[]>>;
  cardsPlayedThisTurn: Partial<Record<PlayerID, boolean>>;
  settings: MatchSettings;
  winner: PlayerID | null;
  victoryReason: string | null;
};

export type MoveResult =
  | { ok: true; battle?: BattleReport }
  | { ok: false; reason: string };
