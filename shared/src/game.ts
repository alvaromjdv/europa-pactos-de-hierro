import type { Game } from "boardgame.io";
import { CAPITALS_TO_WIN, territoryDefinitions } from "./map";
import type { BattleReport, EuropaGameState, MoveResult, Phase, PlayerID, TerritoryState } from "./types";

const INVALID_MOVE = "INVALID_MOVE";
const phaseOrder: Phase[] = ["production", "movement", "battle", "consolidation"];

const terrainDefenseBonus: Record<TerritoryState["terrain"], number> = {
  plains: 0,
  coast: 0,
  forest: 1,
  urban: 2,
  mountain: 2
};

export function createInitialState(): EuropaGameState {
  const territories = Object.fromEntries(
    territoryDefinitions.map((territory) => [
      territory.id,
      {
        ...territory,
        ownerId: territory.startingOwner,
        troops: territory.startingOwner ? (territory.isCapital ? 6 : 3) : 2,
        fortified: false
      }
    ])
  );

  return {
    territories,
    phase: "production",
    turnNumber: 1,
    log: ["Partida creada. Las potencias preparan sus pactos."],
    winner: null
  };
}

export function getPlayerResources(G: EuropaGameState, playerID: PlayerID): number {
  return Object.values(G.territories)
    .filter((territory) => territory.ownerId === playerID)
    .reduce((total, territory) => total + territory.resources, 0);
}

export function isConnected(G: EuropaGameState, fromId: string, toId: string): boolean {
  return Boolean(G.territories[fromId]?.connections.includes(toId));
}

export function nextPhase(phase: Phase): Phase {
  return phaseOrder[(phaseOrder.indexOf(phase) + 1) % phaseOrder.length];
}

export function checkWinner(G: EuropaGameState): PlayerID | null {
  const capitalCounts = new Map<PlayerID, number>();

  for (const territory of Object.values(G.territories)) {
    if (territory.isCapital && territory.ownerId) {
      capitalCounts.set(territory.ownerId, (capitalCounts.get(territory.ownerId) ?? 0) + 1);
    }
  }

  for (const [playerID, count] of capitalCounts.entries()) {
    if (count >= CAPITALS_TO_WIN) return playerID;
  }

  return null;
}

function ensureTurn(playerID: string | undefined, currentPlayer: string): MoveResult {
  if (!playerID || playerID !== currentPlayer) {
    return { ok: false, reason: "No es tu turno." };
  }
  return { ok: true };
}

function ensurePhase(G: EuropaGameState, expected: Phase): MoveResult {
  if (G.phase !== expected) {
    return { ok: false, reason: `La accion requiere la fase ${expected}.` };
  }
  return { ok: true };
}

function pushLog(G: EuropaGameState, message: string): void {
  G.log.unshift(message);
  G.log = G.log.slice(0, 80);
}

export function recruitTroops(
  G: EuropaGameState,
  currentPlayer: string,
  playerID: string | undefined,
  territoryId: string,
  amount: number
): MoveResult {
  const turn = ensureTurn(playerID, currentPlayer);
  if (!turn.ok) return turn;
  const phase = ensurePhase(G, "production");
  if (!phase.ok) return phase;

  const territory = G.territories[territoryId];
  const count = Math.floor(amount);
  if (!territory) return { ok: false, reason: "Territorio inexistente." };
  if (territory.ownerId !== playerID) return { ok: false, reason: "Solo puedes reclutar en territorios propios." };
  if (count < 1) return { ok: false, reason: "Debes reclutar al menos una tropa." };

  const available = getPlayerResources(G, playerID as PlayerID);
  if (count > available) return { ok: false, reason: "No tienes recursos suficientes." };

  territory.troops += count;
  pushLog(G, `${territory.name}: ${playerID} recluta ${count} tropas.`);
  return { ok: true };
}

export function moveTroops(
  G: EuropaGameState,
  currentPlayer: string,
  playerID: string | undefined,
  fromId: string,
  toId: string,
  amount: number
): MoveResult {
  const turn = ensureTurn(playerID, currentPlayer);
  if (!turn.ok) return turn;
  const phase = ensurePhase(G, "movement");
  if (!phase.ok) return phase;

  const from = G.territories[fromId];
  const to = G.territories[toId];
  const count = Math.floor(amount);
  if (!from || !to) return { ok: false, reason: "Territorio inexistente." };
  if (from.ownerId !== playerID || to.ownerId !== playerID) return { ok: false, reason: "Solo puedes mover entre territorios propios." };
  if (!isConnected(G, fromId, toId)) return { ok: false, reason: "Los territorios no estan conectados." };
  if (count < 1) return { ok: false, reason: "Debes mover al menos una tropa." };
  if (from.troops - count < 1) return { ok: false, reason: "Debes dejar una tropa defendiendo el origen." };

  from.troops -= count;
  to.troops += count;
  pushLog(G, `${from.name} -> ${to.name}: ${playerID} mueve ${count} tropas.`);
  return { ok: true };
}

export function fortifyTerritory(
  G: EuropaGameState,
  currentPlayer: string,
  playerID: string | undefined,
  territoryId: string
): MoveResult {
  const turn = ensureTurn(playerID, currentPlayer);
  if (!turn.ok) return turn;
  const phase = ensurePhase(G, "consolidation");
  if (!phase.ok) return phase;

  const territory = G.territories[territoryId];
  if (!territory) return { ok: false, reason: "Territorio inexistente." };
  if (territory.ownerId !== playerID) return { ok: false, reason: "Solo puedes fortificar territorios propios." };

  territory.fortified = true;
  pushLog(G, `${territory.name}: ${playerID} fortifica posiciones.`);
  return { ok: true };
}

export function attackTerritory(
  G: EuropaGameState,
  currentPlayer: string,
  playerID: string | undefined,
  fromId: string,
  toId: string,
  amount: number,
  rollDie: () => number
): MoveResult {
  const turn = ensureTurn(playerID, currentPlayer);
  if (!turn.ok) return turn;
  const phase = ensurePhase(G, "battle");
  if (!phase.ok) return phase;

  const from = G.territories[fromId];
  const to = G.territories[toId];
  const count = Math.floor(amount);
  if (!from || !to) return { ok: false, reason: "Territorio inexistente." };
  if (from.ownerId !== playerID) return { ok: false, reason: "El origen debe ser propio." };
  if (to.ownerId === playerID) return { ok: false, reason: "No puedes atacar un territorio propio." };
  if (!isConnected(G, fromId, toId)) return { ok: false, reason: "El objetivo no es adyacente." };
  if (count < 1) return { ok: false, reason: "Debes atacar con al menos una tropa." };
  if (from.troops - count < 1) return { ok: false, reason: "Debes dejar una tropa defendiendo el origen." };

  const attackerRoll = rollDie();
  const defenderRoll = rollDie();
  const fortifyBonus = to.fortified ? 2 : 0;
  const attackerPower = count + attackerRoll;
  const defenderPower = to.troops + defenderRoll + terrainDefenseBonus[to.terrain] + fortifyBonus;
  const attackerLosses = Math.min(count, Math.max(1, Math.floor(defenderPower / 4)));
  const defenderLosses = Math.min(to.troops, Math.max(1, Math.floor(attackerPower / 4)));
  const conquered = attackerPower > defenderPower && defenderLosses >= to.troops;

  from.troops -= attackerLosses;
  to.troops -= defenderLosses;

  if (conquered) {
    const occupyingTroops = Math.max(1, count - attackerLosses);
    from.troops -= occupyingTroops;
    to.ownerId = playerID as PlayerID;
    to.troops = occupyingTroops;
    to.fortified = false;
  }

  const battle: BattleReport = { attackerRoll, defenderRoll, attackerPower, defenderPower, conquered, attackerLosses, defenderLosses };
  pushLog(G, `${from.name} ataca ${to.name}: ${conquered ? "conquista" : "resiste"} (${attackerPower}-${defenderPower}).`);
  G.winner = checkWinner(G);
  return { ok: true, battle };
}

export function advancePhase(G: EuropaGameState, currentPlayer: string, playerID: string | undefined): MoveResult {
  const turn = ensureTurn(playerID, currentPlayer);
  if (!turn.ok) return turn;

  G.phase = nextPhase(G.phase);
  if (G.phase === "production") {
    G.turnNumber += 1;
    for (const territory of Object.values(G.territories)) {
      territory.fortified = false;
    }
  }
  pushLog(G, `Fase actual: ${G.phase}.`);
  G.winner = checkWinner(G);
  return { ok: true };
}

type MoveContext = {
  G: EuropaGameState;
  ctx: { currentPlayer: string };
  playerID?: string;
  events: { endTurn: () => void };
  random: { Die: (sides: number) => number };
};

function invalid(result: MoveResult) {
  return result.ok ? undefined : INVALID_MOVE;
}

export const EuropaGame: Game<EuropaGameState> = {
  name: "europa-pactos-de-hierro",
  minPlayers: 2,
  maxPlayers: 6,
  setup: createInitialState,
  turn: {
    minMoves: 1,
    maxMoves: 100
  },
  endIf: ({ G }) => (G.winner ? { winner: G.winner } : undefined),
  moves: {
    recruit: ({ G, ctx, playerID }: MoveContext, territoryId: string, amount: number) =>
      invalid(recruitTroops(G, ctx.currentPlayer, playerID, territoryId, amount)),
    move: ({ G, ctx, playerID }: MoveContext, fromId: string, toId: string, amount: number) =>
      invalid(moveTroops(G, ctx.currentPlayer, playerID, fromId, toId, amount)),
    attack: ({ G, ctx, playerID, random }: MoveContext, fromId: string, toId: string, amount: number) =>
      invalid(attackTerritory(G, ctx.currentPlayer, playerID, fromId, toId, amount, () => random.Die(6))),
    fortify: ({ G, ctx, playerID }: MoveContext, territoryId: string) =>
      invalid(fortifyTerritory(G, ctx.currentPlayer, playerID, territoryId)),
    endPhase: ({ G, ctx, playerID, events }: MoveContext) => {
      const before = G.phase;
      const result = advancePhase(G, ctx.currentPlayer, playerID);
      if (!result.ok) return INVALID_MOVE;
      if (before === "consolidation") events.endTurn();
      return undefined;
    }
  }
};
