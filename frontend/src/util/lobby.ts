export const GAME_NAME = "europa-pactos-de-hierro";

type CreateResponse = {
  gameID?: string;
  matchID?: string;
};

type JoinResponse = {
  playerCredentials: string;
};

export async function createMatch(serverUrl: string): Promise<string> {
  const response = await fetch(`${serverUrl}/games/${GAME_NAME}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numPlayers: 2 })
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
  const attempts = [...new Set([preferredPlayerID, "1", "0"])];

  for (const playerID of attempts) {
    const response = await fetch(`${serverUrl}/games/${GAME_NAME}/${matchID}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerID, playerName })
    });

    if (response.ok) {
      const payload = (await response.json()) as JoinResponse;
      return { matchID, playerID, credentials: payload.playerCredentials };
    }
  }

  throw new Error("No se pudo unirse: codigo incorrecto o partida llena.");
}
