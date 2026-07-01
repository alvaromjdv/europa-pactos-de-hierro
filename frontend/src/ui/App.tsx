import { useEffect, useMemo, useState } from "react";
import { GAME_NAME, type LobbySettings } from "../util/lobby";
import { createMatch, joinMatch } from "../util/lobby";

type Session = {
  matchID: string;
  playerID: string;
  credentials: string;
  playerName: string;
};

type AppProps = {
  serverUrl: string;
  GameClient: React.ComponentType<any>;
};

const storedNameKey = "europa.playerName";

export function App({ serverUrl, GameClient }: AppProps) {
  const initialJoinCode = useMemo(() => new URLSearchParams(window.location.search).get("join") ?? "", []);
  const [playerName, setPlayerName] = useState(localStorage.getItem(storedNameKey) ?? "");
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [settings, setSettings] = useState<LobbySettings>({ numPlayers: 2, targetCapitals: 3, duration: "standard" });
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function withLobby(action: () => Promise<Session>) {
    if (!playerName.trim()) {
      setStatus("Escribe un nombre para entrar.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      localStorage.setItem(storedNameKey, playerName.trim());
      const next = await action();
      setSession(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo conectar con el lobby.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    async function handleLobbyAction(event: Event) {
      const action = (event as CustomEvent<{ action: "new" | "lobby" }>).detail?.action;
      if (action === "lobby") {
        setSession(null);
        return;
      }

      if (action === "new") {
        await withLobby(async () => {
          const matchID = await createMatch(serverUrl, settings);
          const joined = await joinMatch(serverUrl, matchID, playerName.trim(), "0");
          return { ...joined, playerName: playerName.trim() };
        });
      }
    }

    window.addEventListener("europa:lobby-action", handleLobbyAction);
    return () => window.removeEventListener("europa:lobby-action", handleLobbyAction);
  }, [playerName, serverUrl, settings]);

  if (session) {
    return (
      <GameClient
        matchID={session.matchID}
        playerID={session.playerID}
        credentials={session.credentials}
      />
    );
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Multiplayer por turnos</p>
          <h1>Europa: Pactos de Hierro</h1>
          <p className="subtitle">Crea una partida 1v1 o entra con codigo para disputar capitales, tropas y fases sincronizadas.</p>
        </div>

        <label>
          Nombre
          <input
            autoFocus
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Comandante"
          />
        </label>

        <section className="lobby-settings" aria-label="Configuracion de partida">
          <label>
            Jugadores
            <select
              value={settings.numPlayers}
              onChange={(event) => setSettings((current) => ({ ...current, numPlayers: Number(event.target.value) as LobbySettings["numPlayers"] }))}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label>
            Capitales objetivo
            <select
              value={settings.targetCapitals}
              onChange={(event) => setSettings((current) => ({ ...current, targetCapitals: Number(event.target.value) }))}
            >
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label>
            Duracion
            <select
              value={settings.duration}
              onChange={(event) => setSettings((current) => ({ ...current, duration: event.target.value as LobbySettings["duration"] }))}
            >
              <option value="standard">Estandar</option>
              <option value="quick">Rapida</option>
            </select>
          </label>
        </section>

        <div className="lobby-actions">
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              withLobby(async () => {
                const matchID = await createMatch(serverUrl, settings);
                const joined = await joinMatch(serverUrl, matchID, playerName.trim(), "0");
                return { ...joined, playerName: playerName.trim() };
              })
            }
          >
            Crear partida
          </button>
        </div>

        <div className="join-row">
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Codigo de partida"
            aria-label="Codigo de partida"
          />
          <button
            disabled={busy || !joinCode.trim()}
            onClick={() =>
              withLobby(async () => {
                const joined = await joinMatch(serverUrl, joinCode.trim(), playerName.trim(), "1");
                return { ...joined, playerName: playerName.trim() };
              })
            }
          >
            Unirse
          </button>
        </div>

        <p className="small">Servidor: {serverUrl} - Juego: {GAME_NAME}</p>
        {status && <p className="status">{status}</p>}
      </section>
    </main>
  );
}

