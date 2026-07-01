import type { Game } from "boardgame.io";
import { CAPITALS_TO_WIN, territoryDefinitions } from "./map";
import { eventCardById, eventCards } from "./cards";
import type { BattleReport, EuropaGameState, EventCard, MatchSettings, MoveResult, Phase, PlayerID, TerritoryState } from "./types";

const INVALID_MOVE = "INVALID_MOVE";
const phaseOrder: Phase[] = ["production", "movement", "battle", "consolidation"];

const terrainDefenseBonus: Record<TerritoryState["terrain"], number> = {
  plains: 0,
  coast: 0,
  forest: 0,
  urban: 1,
  mountain: 1
};

export const DEFAULT_SETTINGS: MatchSettings = {
  numPlayers: 2,
  targetCapitals: CAPITALS_TO_WIN,
  duration: "standard",
  powerTarget: 42,
  maxTurns: 20
};

export function normalizeSettings(setupData?: Partial<MatchSettings>): MatchSettings {
  const duration = setupData?.duration === "quick" ? "quick" : "standard";
  const numPlayers = setupData?.numPlayers === 3 || setupData?.numPlayers === 4 ? setupData.numPlayers : 2;
  const targetCapitals = Math.max(2, Math.min(6, Math.floor(setupData?.targetCapitals ?? (duration === "quick" ? 2 : CAPITALS_TO_WIN))));
  return {
    numPlayers,
    targetCapitals,
    duration,
    powerTarget: Math.max(18, Math.floor(setupData?.powerTarget ?? (duration === "quick" ? 28 : 42))),
    maxTurns: Math.max(8, Math.floor(setupData?.maxTurns ?? (duration === "quick" ? 12 : 20)))
  };
}

export function createInitialState(setupData?: Partial<MatchSettings>): EuropaGameState {
  const settings = normalizeSettings(setupData);
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
  const deck = eventCards.map((card) => card.id);
  const hands: EuropaGameState["hands"] = {};
  for (let index = 0; index < settings.numPlayers; index += 1) {
    const playerID = String(index) as PlayerID;
    hands[playerID] = drawCards(deck, [], 2);
  }

  return {
    territories,
    phase: "production",
    turnNumber: 1,
    deck,
    hands,
    cardsPlayedThisTurn: {},
    settings,
    log: ["Partida creada. Las potencias preparan sus pactos."],
    winner: null,
    victoryReason: null
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
    if (count >= G.settings.targetCapitals) {
      G.victoryReason = `Control de ${count} capitales`;
      return playerID;
    }
  }

  for (const playerID of getActivePlayerIDs(G)) {
    const power = getPowerScore(G, playerID);
    if (power >= G.settings.powerTarget) {
      G.victoryReason = `${power} puntos de poder`;
      return playerID;
    }
  }

  if (G.turnNumber > G.settings.maxTurns) {
    const [leader] = getActivePlayerIDs(G).sort((a, b) => getPowerScore(G, b) - getPowerScore(G, a));
    if (leader) {
      G.victoryReason = `Liderazgo por poder tras ${G.settings.maxTurns} turnos`;
      return leader;
    }
  }

  return null;
}

export function getPowerScore(G: EuropaGameState, playerID: PlayerID): number {
  return Object.values(G.territories)
    .filter((territory) => territory.ownerId === playerID)
    .reduce((total, territory) => total + territory.resources + (territory.isCapital ? 5 : 1), 0);
}

export function getTerrainDefenseBonus(territory: TerritoryState): number {
  return terrainDefenseBonus[territory.terrain] + (territory.isCapital ? 1 : 0);
}

function getActivePlayerIDs(G: EuropaGameState): PlayerID[] {
  return Array.from({ length: G.settings.numPlayers }, (_, index) => String(index) as PlayerID);
}

function drawCards(deck: string[], currentHand: EventCard[], amount: number): EventCard[] {
  const nextHand = [...currentHand];
  while (deck.length > 0 && nextHand.length < 3 && nextHand.length < currentHand.length + amount) {
    const cardId = deck.shift();
    const card = cardId ? eventCardById[cardId] : undefined;
    if (card) nextHand.push(card);
  }
  return nextHand;
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
  const terrainBonus = getTerrainDefenseBonus(to);
  const defenderPower = to.troops + defenderRoll + terrainBonus + fortifyBonus;
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

  const battle: BattleReport = { attackerRoll, defenderRoll, attackerPower, defenderPower, terrainDefenseBonus: terrainBonus, conquered, attackerLosses, defenderLosses };
  pushLog(G, `${from.name} ataca ${to.name}: ${conquered ? "conquista" : "resiste"} (${attackerPower}-${defenderPower}, terreno +${terrainBonus}).`);
  G.winner = checkWinner(G);
  return { ok: true, battle };
}

export function playEventCard(
  G: EuropaGameState,
  currentPlayer: string,
  playerID: string | undefined,
  cardId: string,
  targetId: string
): MoveResult {
  const turn = ensureTurn(playerID, currentPlayer);
  if (!turn.ok) return turn;
  if (!playerID) return { ok: false, reason: "Jugador invalido." };
  const typedPlayer = playerID as PlayerID;
  if (G.cardsPlayedThisTurn[typedPlayer]) return { ok: false, reason: "Ya jugaste una carta este turno." };

  const hand = G.hands[typedPlayer] ?? [];
  const card = hand.find((candidate) => candidate.id === cardId);
  const target = G.territories[targetId];
  if (!card) return { ok: false, reason: "Carta no disponible." };
  if (!target) return { ok: false, reason: "Territorio inexistente." };

  const ownAdjacent = Object.values(G.territories).some((territory) => territory.ownerId === typedPlayer && territory.connections.includes(targetId));

  if (card.kind === "production") {
    const phase = ensurePhase(G, "production");
    if (!phase.ok) return phase;
    if (target.ownerId !== typedPlayer) return { ok: false, reason: "La produccion requiere un territorio propio." };
    target.troops += 2;
  }

  if (card.kind === "reinforcement") {
    if (target.ownerId !== typedPlayer) return { ok: false, reason: "El refuerzo requiere un territorio propio." };
    target.troops += card.id === "reserve-corps" ? 3 : 2;
  }

  if (card.kind === "defense") {
    if (target.ownerId !== typedPlayer) return { ok: false, reason: "La defensa requiere un territorio propio." };
    target.fortified = true;
    if (card.id === "citadel-orders") target.troops += 1;
  }

  if (card.kind === "sabotage" || card.kind === "crisis") {
    if (target.ownerId === typedPlayer) return { ok: false, reason: "El objetivo debe ser enemigo o neutral." };
    if (!ownAdjacent) return { ok: false, reason: "El objetivo debe ser adyacente a un territorio propio." };
    if (card.kind === "crisis" && target.isCapital) {
      target.fortified = false;
    } else {
      target.troops = Math.max(1, target.troops - 1);
    }
  }

  G.hands[typedPlayer] = hand.filter((candidate) => candidate.id !== cardId);
  G.cardsPlayedThisTurn[typedPlayer] = true;
  pushLog(G, `${typedPlayer} juega ${card.title} en ${target.name}.`);
  G.winner = checkWinner(G);
  return { ok: true };
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
    for (const activePlayer of getActivePlayerIDs(G)) {
      G.cardsPlayedThisTurn[activePlayer] = false;
      G.hands[activePlayer] = drawCards(G.deck, G.hands[activePlayer] ?? [], 1);
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
  maxPlayers: 4,
  setup: ({ ctx }) => createInitialState((ctx as { setupData?: Partial<MatchSettings> }).setupData),
  playerView: ({ G, playerID }) => getPlayerView(G, playerID as PlayerID | undefined),
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
    playCard: ({ G, ctx, playerID }: MoveContext, cardId: string, targetId: string) =>
      invalid(playEventCard(G, ctx.currentPlayer, playerID, cardId, targetId)),
    endPhase: ({ G, ctx, playerID, events }: MoveContext) => {
      const before = G.phase;
      const result = advancePhase(G, ctx.currentPlayer, playerID);
      if (!result.ok) return INVALID_MOVE;
      if (before === "consolidation") events.endTurn();
      return undefined;
    }
  }
};

export function getPlayerView(G: EuropaGameState, playerID?: PlayerID): EuropaGameState {
  if (!playerID) return G;
  const visible = new Set<string>();
  for (const territory of Object.values(G.territories)) {
    if (territory.ownerId === playerID) {
      visible.add(territory.id);
      territory.connections.forEach((connection) => visible.add(connection));
    }
  }

  return {
    ...G,
    hands: { [playerID]: G.hands[playerID] ?? [] },
    territories: Object.fromEntries(
      Object.entries(G.territories).map(([id, territory]) => {
        if (visible.has(id)) return [id, territory];
        return [
          id,
          {
            ...territory,
            troops: approximateTroops(territory.troops)
          }
        ];
      })
    )
  };
}

function approximateTroops(troops: number): number {
  if (troops <= 2) return 2;
  if (troops <= 5) return 4;
  return 8;
}
