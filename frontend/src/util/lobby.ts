export const GAME_NAME = "europa-pactos-de-hierro";

export type LobbySettings = {
  numPlayers: 2 | 3 | 4;
  targetCapitals: number;
  duration: "quick" | "standard";
};

type CreateResponse = {
  gameID?: string;
  matchID?: string;
};

type JoinResponse = {
  matchID?: string;
  playerID?: string;
  playerCredentials: string;
};

export async function createMatch(serverUrl: string, settings: LobbySettings = { numPlayers: 2, targetCapitals: 3, duration: "standard" }): Promise<string> {
  const response = await fetch(`${serverUrl}/api/matches/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings })
  });

  if (!response.ok) {
    throw new Error(`No se pudo crear la partida (${response.status}).`);
  }

  const payload = (await response.json()) as CreateResponse;
  const matchID = payload.gameID ?? payload.matchID;
  if (!matchID) throw new Error("El lobby no devolvio codigo de partida.");
  return matchID;
}

export async function joinMatch(serverUrl: string, matchID: string, playerName: string, preferredPlayerID: string) {
  const attempts = [...new Set([preferredPlayerID, "1", "2", "3", "0"])];

  for (const playerID of attempts) {
    const response = await fetch(`${serverUrl}/api/matches/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchID, playerID, playerName })
    });

    if (response.ok) {
      const payload = (await response.json()) as JoinResponse;
      return { matchID: payload.matchID ?? matchID, playerID: payload.playerID ?? playerID, credentials: payload.playerCredentials };
    }
  }

  throw new Error("No se pudo unirse: codigo incorrecto o partida llena.");
}
