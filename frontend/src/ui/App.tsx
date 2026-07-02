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
  const [showTutorial, setShowTutorial] = useState(false);

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
          <p className="eyebrow">Tablero online de conquista</p>
          <h1>Europa: Pactos de Hierro</h1>
          <p className="subtitle">Crea una partida, comparte el codigo y conquista capitales por turnos: refuerza, ataca, fortifica y protege tus fronteras.</p>
        </div>

        <section className="lobby-preview" aria-label="Vista previa del tablero">
          <div className="preview-board" aria-hidden="true">
            <span className="preview-route route-a" />
            <span className="preview-route route-b" />
            <span className="preview-route route-c" />
            <span className="preview-token blue">6</span>
            <span className="preview-token red">8</span>
            <span className="preview-token gold">3</span>
            <span className="preview-token green">4</span>
            <span className="preview-capital capital-a" />
            <span className="preview-capital capital-b" />
          </div>
          <div className="preview-brief">
            <p className="eyebrow">Flujo de turno</p>
            <div className="preview-steps">
              <span>Refuerza</span>
              <span>Ataca</span>
              <span>Fortifica</span>
              <span>Termina turno</span>
            </div>
          </div>
        </section>

        <section className="lobby-guide">
          <div className="split">
            <p className="eyebrow">Como se gana</p>
            <button className="icon-button" type="button" onClick={() => setShowTutorial(true)}>Como jugar</button>
          </div>
          <div className="turn-guide">
            <div className="guide-row active"><span>1</span><p>Controla capitales enemigas y protege las tuyas.</p></div>
            <div className="guide-row"><span>2</span><p>Usa tropas para atacar territorios adyacentes.</p></div>
            <div className="guide-row"><span>3</span><p>Gana al alcanzar el objetivo de capitales o poder.</p></div>
          </div>
        </section>

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
            Unirse con codigo
          </button>
        </div>

        <p className="small">Servidor: {serverUrl || "Netlify"} - Juego: {GAME_NAME}</p>
        {status && <p className="status">{status}</p>}
      </section>
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
    </main>
  );
}

function TutorialModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="victory-backdrop" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <section className="tutorial-modal">
        <div className="split">
          <div>
            <p className="eyebrow">Tutorial de 60 segundos</p>
            <h2 id="tutorial-title">Juega como en un tablero de conquista</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar tutorial">Cerrar</button>
        </div>
        <div className="tutorial-grid">
          <article>
            <span>1</span>
            <h3>Refuerza</h3>
            <p>Elige un territorio propio y recluta tropas. Las capitales y fronteras son los mejores puntos de salida.</p>
          </article>
          <article>
            <span>2</span>
            <h3>Ataca</h3>
            <p>Haz clic en un territorio propio con tropas y despues en un enemigo conectado. El resultado muestra dados y perdidas.</p>
          </article>
          <article>
            <span>3</span>
            <h3>Fortifica</h3>
            <p>Mueve tropas entre dos territorios propios conectados. Deja siempre una tropa defendiendo el origen.</p>
          </article>
          <article>
            <span>4</span>
            <h3>Termina turno</h3>
            <p>Pasa el mando al rival. Ganas controlando capitales, acumulando poder o manteniendo regiones completas.</p>
          </article>
        </div>
        <p className="phase-help">Consejo rapido: primero haz clic en tu territorio de origen y luego en el destino conectado. Las acciones importantes nunca se ejecutan solo al pasar el raton.</p>
        <button className="primary wide" type="button" onClick={onClose}>Entendido</button>
      </section>
    </div>
  );
}

