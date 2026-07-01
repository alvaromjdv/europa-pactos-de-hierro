import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { getStore } from "@netlify/blobs";
import {
  advancePhase,
  attackTerritory,
  createInitialState,
  fortifyTerritory,
  getPlayerView,
  moveTroops,
  playEventCard,
  recruitTroops
} from "./game";
import type { EuropaGameState, MatchSettings, MoveResult, PlayerID } from "./types";

type ApiRequest = {
  method: string;
  path: string;
  body?: string;
};

type ApiResponse = {
  status: number;
  body: unknown;
};

type MatchPlayer = {
  id: PlayerID;
  name: string;
  secret: string;
};

type MatchRecord = {
  matchId: string;
  version: number;
  currentPlayer: PlayerID;
  players: MatchPlayer[];
  G: EuropaGameState;
  createdAt: string;
  updatedAt: string;
};

type MovePayload = {
  playerID?: string;
  playerSecret?: string;
  expectedVersion?: number;
  move?: {
    type?: string;
    args?: unknown[];
  };
};

const maxPlayers = 4;
const localDataDir = resolve(process.env.NETLIFY_LOCAL_DATA_DIR ?? "data/netlify-local");
const memoryMatches = new Map<string, MatchRecord>();

export async function handleApiRequest(request: ApiRequest): Promise<ApiResponse> {
  try {
    const path = normalizePath(request.path);

    if (request.method === "GET" && path === "/api/health") {
      return ok({ ok: true, service: "europa-pactos-de-hierro", mode: "netlify-polling" });
    }

    if (request.method === "POST" && path === "/api/matches/create") {
      return createMatch(parseBody(request.body));
    }

    if (request.method === "POST" && path === "/api/matches/join") {
      return joinMatch(parseBody(request.body));
    }

    const match = path.match(/^\/api\/matches\/([^/]+)(?:\/move)?$/);
    if (!match) return json(404, { error: "Endpoint no encontrado." });

    const matchId = decodeURIComponent(match[1]);
    if (request.method === "GET" && path === `/api/matches/${match[1]}`) {
      return getMatch(matchId, parseQuery(request.path));
    }

    if (request.method === "POST" && path === `/api/matches/${match[1]}/move`) {
      return applyMove(matchId, parseBody(request.body) as MovePayload);
    }

    return json(405, { error: "Metodo no permitido." });
  } catch (error) {
    return json(500, { error: error instanceof Error ? error.message : "Error interno." });
  }
}

async function createMatch(body: unknown): Promise<ApiResponse> {
  const payload = body as { settings?: Partial<MatchSettings>; setupData?: Partial<MatchSettings> };
  const matchId = createMatchId();
  const now = new Date().toISOString();
  const record: MatchRecord = {
    matchId,
    version: 0,
    currentPlayer: "0",
    players: [],
    G: createInitialState(payload.settings ?? payload.setupData),
    createdAt: now,
    updatedAt: now
  };
  await saveMatch(record);
  return ok({ matchID: matchId, gameID: matchId });
}

async function joinMatch(body: unknown): Promise<ApiResponse> {
  const payload = body as { matchID?: string; matchId?: string; playerID?: string; playerName?: string };
  const matchId = payload.matchID ?? payload.matchId;
  if (!matchId) return json(400, { error: "Falta matchID." });

  const record = await loadMatch(matchId);
  if (!record) return json(404, { error: "Partida no encontrada." });

  const playerID = choosePlayerID(record, payload.playerID);
  if (!playerID) return json(409, { error: "La partida esta llena." });

  let player = record.players.find((candidate) => candidate.id === playerID);
  if (!player) {
    player = {
      id: playerID,
      name: String(payload.playerName ?? `Jugador ${playerID}`).slice(0, 40),
      secret: createSecret()
    };
    record.players.push(player);
    record.version += 1;
    record.updatedAt = new Date().toISOString();
    await saveMatch(record);
  }

  return ok({
    matchID: record.matchId,
    playerID: player.id,
    playerCredentials: player.secret,
    version: record.version
  });
}

async function getMatch(matchId: string, query: URLSearchParams): Promise<ApiResponse> {
  const record = await loadMatch(matchId);
  if (!record) return json(404, { error: "Partida no encontrada." });

  const playerID = query.get("playerID") ?? undefined;
  const playerSecret = query.get("playerSecret") ?? undefined;
  const player = authenticate(record, playerID, playerSecret);
  if (!player) return json(401, { error: "Credenciales de jugador invalidas." });

  return ok(toClientMatch(record, player.id));
}

async function applyMove(matchId: string, payload: MovePayload): Promise<ApiResponse> {
  const record = await loadMatch(matchId);
  if (!record) return json(404, { error: "Partida no encontrada." });

  const player = authenticate(record, payload.playerID, payload.playerSecret);
  if (!player) return json(401, { error: "Credenciales de jugador invalidas." });

  if (payload.expectedVersion !== record.version) {
    return json(409, { error: "Estado desactualizado. Refresca la partida.", match: toClientMatch(record, player.id) });
  }

  const result = runMove(record, player.id, payload.move?.type, payload.move?.args ?? []);
  if (!result.ok) return json(400, { error: result.reason, match: toClientMatch(record, player.id) });

  record.version += 1;
  record.updatedAt = new Date().toISOString();
  await saveMatch(record);
  return ok({ ...toClientMatch(record, player.id), battle: result.battle });
}

function runMove(record: MatchRecord, playerID: PlayerID, type: string | undefined, args: unknown[]): MoveResult {
  if (record.G.winner) return { ok: false, reason: "La partida ya ha terminado." };

  if (type === "recruit") return recruitTroops(record.G, record.currentPlayer, playerID, stringArg(args, 0), numberArg(args, 1));
  if (type === "move") return moveTroops(record.G, record.currentPlayer, playerID, stringArg(args, 0), stringArg(args, 1), numberArg(args, 2));
  if (type === "attack") {
    return attackTerritory(record.G, record.currentPlayer, playerID, stringArg(args, 0), stringArg(args, 1), numberArg(args, 2), () => rollDie());
  }
  if (type === "fortify") return fortifyTerritory(record.G, record.currentPlayer, playerID, stringArg(args, 0));
  if (type === "playCard") return playEventCard(record.G, record.currentPlayer, playerID, stringArg(args, 0), stringArg(args, 1));
  if (type === "endPhase") {
    const before = record.G.phase;
    const result = advancePhase(record.G, record.currentPlayer, playerID);
    if (result.ok && before === "consolidation") {
      record.currentPlayer = String((Number(record.currentPlayer) + 1) % record.G.settings.numPlayers) as PlayerID;
    }
    return result;
  }

  return { ok: false, reason: "Movimiento desconocido." };
}

function toClientMatch(record: MatchRecord, playerID: PlayerID) {
  return {
    matchID: record.matchId,
    version: record.version,
    playerID,
    G: getPlayerView(record.G, playerID),
    ctx: {
      currentPlayer: record.currentPlayer,
      gameover: record.G.winner ? { winner: record.G.winner } : undefined
    },
    players: record.players.map((player) => ({ id: player.id, name: player.name }))
  };
}

function authenticate(record: MatchRecord, playerID?: string, playerSecret?: string): MatchPlayer | undefined {
  return record.players.find((player) => player.id === playerID && player.secret === playerSecret);
}

function choosePlayerID(record: MatchRecord, preferred?: string): PlayerID | undefined {
  const ids = Array.from({ length: Math.min(maxPlayers, record.G.settings.numPlayers) }, (_, index) => String(index) as PlayerID);
  const occupied = new Set(record.players.map((player) => player.id));
  if (preferred && ids.includes(preferred as PlayerID) && !occupied.has(preferred as PlayerID)) return preferred as PlayerID;
  return ids.find((id) => !occupied.has(id));
}

async function loadMatch(matchId: string): Promise<MatchRecord | null> {
  const cached = memoryMatches.get(matchId);
  if (cached) return cloneMatch(cached);

  if (useBlobs()) {
    const store = getMatchStore();
    const record = (await store.get(matchId, { type: "json" })) as MatchRecord | null;
    if (record) memoryMatches.set(matchId, cloneMatch(record));
    return record;
  }

  try {
    return JSON.parse(await readFile(localPath(matchId), "utf8")) as MatchRecord;
  } catch {
    return null;
  }
}

async function saveMatch(record: MatchRecord): Promise<void> {
  memoryMatches.set(record.matchId, cloneMatch(record));

  if (useBlobs()) {
    const store = getMatchStore();
    await store.setJSON(record.matchId, record);
    return;
  }

  const path = localPath(record.matchId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(record, null, 2), "utf8");
}

function useBlobs(): boolean {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function cloneMatch(record: MatchRecord): MatchRecord {
  return structuredClone(record);
}

function getMatchStore() {
  const context = readBlobsContext();
  if (context?.siteID && context.token) {
    return getStore({ name: "matches", siteID: context.siteID, token: context.token, consistency: "strong" });
  }
  return getStore("matches", { consistency: "strong" });
}

function readBlobsContext(): { siteID?: string; token?: string } | null {
  if (process.env.MATCHES_BLOB_SITE_ID && process.env.MATCHES_BLOB_TOKEN) {
    return { siteID: process.env.MATCHES_BLOB_SITE_ID, token: process.env.MATCHES_BLOB_TOKEN };
  }

  const encoded = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!encoded) return null;

  try {
    return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as { siteID?: string; token?: string };
  } catch {
    return null;
  }
}

function localPath(matchId: string): string {
  return resolve(localDataDir, `${matchId}.json`);
}

function parseBody(body?: string): unknown {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function parseQuery(path: string): URLSearchParams {
  const index = path.indexOf("?");
  return new URLSearchParams(index >= 0 ? path.slice(index + 1) : "");
}

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0];
  if (withoutQuery.startsWith("/.netlify/functions/api")) {
    const suffix = withoutQuery.slice("/.netlify/functions/api".length);
    return suffix.startsWith("/api/") ? suffix : `/api${suffix}`;
  }
  return withoutQuery;
}

function stringArg(args: unknown[], index: number): string {
  return String(args[index] ?? "");
}

function numberArg(args: unknown[], index: number): number {
  return Number(args[index] ?? 0);
}

function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function createMatchId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function createSecret(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ok(body: unknown): ApiResponse {
  return json(200, body);
}

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}
