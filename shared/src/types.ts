export type PlayerID = "0" | "1" | "2" | "3" | "4" | "5";

export type Phase = "production" | "movement" | "battle" | "consolidation";

export type Terrain = "plains" | "mountain" | "forest" | "urban" | "coast";

export type TerritoryDefinition = {
  id: string;
  name: string;
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
  conquered: boolean;
  attackerLosses: number;
  defenderLosses: number;
};

export type EuropaGameState = {
  territories: Record<string, TerritoryState>;
  phase: Phase;
  turnNumber: number;
  log: string[];
  winner: PlayerID | null;
};

export type MoveResult =
  | { ok: true; battle?: BattleReport }
  | { ok: false; reason: string };
