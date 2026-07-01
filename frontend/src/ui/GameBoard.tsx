import { useEffect, useMemo, useRef, useState } from "react";
import { getPowerScore, isConnected, type EuropaGameState, type EventCard, type TerritoryState } from "@europa/shared";
import { MapCanvas } from "./MapCanvas";

type BoardProps = {
  G: EuropaGameState;
  ctx: { currentPlayer: string; gameover?: { winner?: string } };
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  matchID: string;
  isActive: boolean;
  syncStatus?: "sincronizando" | "actualizado" | "error";
  syncError?: string;
};

const phaseLabels = {
  production: "Refuerzos",
  movement: "Maniobra",
  battle: "Ataque",
  consolidation: "Fortificar"
};

const legacyPhaseLabels = {
  production: "Produccion",
  movement: "Movimiento",
  battle: "Batalla",
  consolidation: "Consolidacion"
};

const phaseHelp = {
  production: "Coloca tropas en un territorio propio. Las capitales suelen ser buenos puntos de salida.",
  movement: "Mueve tropas entre dos territorios propios conectados y deja siempre una defendiendo.",
  battle: "Elige un territorio propio con tropas y ataca un enemigo adyacente.",
  consolidation: "Marca una posicion clave como fortificada y termina tu turno."
};

const turnSteps = [
  { phase: "production", label: "Refuerza", text: "Pon tropas en tus zonas." },
  { phase: "movement", label: "Mueve", text: "Recoloca entre zonas propias." },
  { phase: "battle", label: "Ataca", text: "Conquista vecinos enemigos." },
  { phase: "consolidation", label: "Fortifica", text: "Protege una frontera." }
] as const;

type VisualEffect = {
  type: "recruit" | "move" | "attack" | "conquer" | "fortify" | "card";
  fromId?: string;
  toId?: string;
  territoryId?: string;
  nonce: number;
};

export function GameBoard({ G, ctx, moves, playerID, matchID, isActive, syncStatus = "actualizado", syncError = "" }: BoardProps) {
  const [selectedId, setSelectedId] = useState<string>("iberia");
  const [targetId, setTargetId] = useState<string>("");
  const [amount, setAmount] = useState(1);
  const [toast, setToast] = useState("");
  const [visualEffect, setVisualEffect] = useState<VisualEffect | null>(null);
  const previousTerritories = useRef(G.territories);
  const selected = G.territories[selectedId];
  const target = targetId ? G.territories[targetId] : undefined;
  const playerTerritories = useMemo(
    () => Object.values(G.territories).filter((territory) => playerID && territory.ownerId === playerID),
    [G.territories, playerID]
  );
  const resources = playerTerritories.reduce((total, territory) => total + territory.resources, 0);
  const capitals = playerTerritories.filter((territory) => territory.isCapital).length;
  const enemyCapitals = Object.values(G.territories).filter((territory) => territory.isCapital && territory.ownerId && territory.ownerId !== playerID).length;
  const playerHand = playerID ? G.hands[playerID as keyof typeof G.hands] ?? [] : [];
  const cardTarget = target ?? selected;
  const playerPower = playerID ? getPowerScore(G, playerID as "0" | "1" | "2" | "3" | "4" | "5") : 0;
  const shareUrl = `${window.location.origin}${window.location.pathname}?join=${matchID}`;
  const actionHint = getActionHint(G, selected, target, playerID, isActive);
  const capitalSummary = getCapitalSummary(G);
  const powerSummary = getPowerSummary(G);
  const lastBattle = G.log.find((entry) => entry.includes(" ataca "));

  useEffect(() => {
    const previous = previousTerritories.current;
    const current = G.territories;

    for (const territory of Object.values(current)) {
      const before = previous[territory.id];
      if (!before) continue;

      if (before.ownerId !== territory.ownerId) {
        setVisualEffect({ type: "conquer", territoryId: territory.id, nonce: Date.now() });
        break;
      }

      if (territory.troops > before.troops && territory.ownerId === playerID) {
        setVisualEffect({ type: "recruit", territoryId: territory.id, nonce: Date.now() });
        break;
      }

      if (territory.troops < before.troops) {
        const destination = Object.values(current).find((candidate) => {
          const previousCandidate = previous[candidate.id];
          return previousCandidate && candidate.troops > previousCandidate.troops && candidate.ownerId === territory.ownerId;
        });
        if (destination) {
          setVisualEffect({ type: "move", fromId: territory.id, toId: destination.id, nonce: Date.now() });
        } else {
          setVisualEffect({ type: "attack", territoryId: territory.id, nonce: Date.now() });
        }
        break;
      }

      if (!before.fortified && territory.fortified) {
        setVisualEffect({ type: "fortify", territoryId: territory.id, nonce: Date.now() });
        break;
      }
    }

    previousTerritories.current = current;
  }, [G.territories, playerID]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  function selectTerritory(id: string) {
    const clicked = G.territories[id];
    const current = G.territories[selectedId];
    const canTargetFromSelection =
      playerID &&
      current &&
      current.ownerId === playerID &&
      id !== selectedId &&
      isConnected(G, selectedId, id) &&
      ((G.phase === "movement" && clicked.ownerId === playerID) ||
        (G.phase === "battle" && clicked.ownerId !== playerID));

    if (canTargetFromSelection) {
      setTargetId(id);
      return;
    }

    if (!selectedId || (playerID && clicked.ownerId === playerID)) {
      setSelectedId(id);
      setTargetId("");
      return;
    }
    setTargetId(id);
  }

  function copyLink() {
    void navigator.clipboard?.writeText(shareUrl);
    setToast("Link de partida copiado.");
  }

  function recruitSelected() {
    if (!selected) return;
    setVisualEffect({ type: "recruit", territoryId: selected.id, nonce: Date.now() });
    moves.recruit(selected.id, amount);
  }

  function moveSelected() {
    if (!selected || !target) return;
    setVisualEffect({ type: "move", fromId: selected.id, toId: target.id, nonce: Date.now() });
    moves.move(selected.id, target.id, amount);
  }

  function attackSelected() {
    if (!selected || !target) return;
    setVisualEffect({ type: "attack", fromId: selected.id, toId: target.id, nonce: Date.now() });
    moves.attack(selected.id, target.id, amount);
  }

  function fortifySelected() {
    if (!selected) return;
    setVisualEffect({ type: "fortify", territoryId: selected.id, nonce: Date.now() });
    moves.fortify(selected.id);
  }

  function playCard(card: EventCard) {
    if (!cardTarget) return;
    setVisualEffect({ type: "card", territoryId: cardTarget.id, nonce: Date.now() });
    moves.playCard(card.id, cardTarget.id);
  }

  function dispatchLobbyAction(action: "new" | "lobby") {
    window.dispatchEvent(new CustomEvent("europa:lobby-action", { detail: { action } }));
  }

  function renderAction() {
    if (!isActive) return <p className="muted">Esperando al jugador {ctx.currentPlayer}.</p>;
    if (!selected) return <p className="muted">Selecciona un territorio.</p>;

    if (G.phase === "production") {
      return (
        <button className="action-button recruit" disabled={selected.ownerId !== playerID} onClick={recruitSelected}>
          Reclutar
        </button>
      );
    }

    if (G.phase === "movement") {
      return (
        <button className="action-button move" disabled={!target || selected.ownerId !== playerID || target.ownerId !== playerID} onClick={moveSelected}>
          Mover
        </button>
      );
    }

    if (G.phase === "battle") {
      return (
        <button className="action-button attack" disabled={!target || selected.ownerId !== playerID || target.ownerId === playerID} onClick={attackSelected}>
          Atacar
        </button>
      );
    }

    return (
      <button className="action-button fortify" disabled={selected.ownerId !== playerID} onClick={fortifySelected}>
        Fortificar
      </button>
    );
  }

  return (
    <main className="game-shell">
      {toast && <div className="toast">{toast}</div>}
      <header className="topbar">
        <div>
          <p className="eyebrow">Partida {matchID}</p>
          <h1>Europa: Pactos de Hierro</h1>
        </div>
        <div className="turn-summary">
          <span className="player-chip">Jugador {playerID}</span>
          <span className={`phase-chip phase-${G.phase}`}>{phaseLabels[G.phase]}</span>
          <span className="sr-only">{legacyPhaseLabels[G.phase]}</span>
          <span>Turno {G.turnNumber}</span>
        </div>
      </header>

      <section className="war-room">
        <nav className="left-rail" aria-label="Fases del turno">
          <div className="rail-mark">EPH</div>
          {turnSteps.map((step, index) => (
            <div className={`rail-step ${G.phase === step.phase ? "active" : ""}`} key={step.phase}>
              <strong>{index + 1}</strong>
              <span>{step.label}</span>
            </div>
          ))}
        </nav>

        <MapCanvas
          G={G}
          selectedId={selectedId}
          targetId={targetId}
          playerID={playerID}
          phase={G.phase}
          effect={visualEffect}
          onSelect={selectTerritory}
        />

        <aside className="side-panel">
          <section className="panel-block command-card">
            <div className="split">
              <div>
                <p className="eyebrow">Turno de conquista</p>
                <h2>{ctx.currentPlayer === playerID ? "Tu turno" : `Jugador ${ctx.currentPlayer}`}</h2>
              </div>
              <button className="icon-button" onClick={copyLink} title="Copiar link de partida">Copiar</button>
            </div>
            <p className="phase-help">{phaseHelp[G.phase]}</p>
            <div className="stats">
              <span>Recursos {resources}</span>
              <span>Capitales {capitals}/{G.settings.targetCapitals}</span>
              <span>Poder {playerPower}/{G.settings.powerTarget}</span>
              <span>Rivales {enemyCapitals}</span>
              <span>{isActive ? "Activo" : "Espera"}</span>
              <span className={`sync-${syncStatus}`}>{syncStatus}</span>
            </div>
            {syncError && <p className="hint">{syncError}</p>}
            <p className="small">Duracion {G.settings.duration} - max {G.settings.maxTurns} turnos</p>
          </section>

          <section className="panel-block objective-card">
            <p className="eyebrow">Objetivo</p>
            <h2>Conquista {G.settings.targetCapitals} capitales o alcanza {G.settings.powerTarget} poder</h2>
            <div className="turn-guide">
              {turnSteps.map((step, index) => (
                <div className={`guide-row ${G.phase === step.phase ? "active" : ""}`} key={step.phase}>
                  <span>{index + 1}</span>
                  <p><strong>{step.label}.</strong> {step.text}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="territory-stack">
            <TerritoryPanel title="Origen" territory={selected} active />
            <TerritoryPanel title="Destino" territory={target} />
          </div>

          <section className="panel-block action-card">
            <div>
              <p className="eyebrow">Accion disponible</p>
              <h2>{phaseLabels[G.phase]}</h2>
            </div>
            <label>
              Tropas a usar
              <input type="number" min={1} max={99} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </label>
            <div className="action-row">{renderAction()}</div>
            <p className={actionHint.ok ? "hint ok" : "hint"}>{actionHint.message}</p>
            <button className="primary wide" aria-label="Terminar fase" disabled={!isActive} onClick={() => moves.endPhase()}>
              Pasar a {phaseLabels[nextPhaseName(G.phase)]}
            </button>
          </section>

          <section className="panel-block cards-card">
            <div className="split">
              <div>
                <p className="eyebrow">Orden opcional</p>
                <h2>{playerHand.length}/3 cartas</h2>
              </div>
              <span className={playerID && G.cardsPlayedThisTurn[playerID as keyof typeof G.cardsPlayedThisTurn] ? "card-used" : "card-ready"}>
                {playerID && G.cardsPlayedThisTurn[playerID as keyof typeof G.cardsPlayedThisTurn] ? "Usada" : "Lista"}
              </span>
            </div>
            <div className="card-list">
              {playerHand.map((card) => (
                <button
                  className={`event-card card-${card.kind}`}
                  disabled={!isActive || !canPlayCard(card, G, selected, target, playerID)}
                  key={card.id}
                  onClick={() => playCard(card)}
                >
                  <span>{card.title}</span>
                  <small>{card.text}</small>
                </button>
              ))}
              {playerHand.length === 0 && <p className="muted">Sin ordenes disponibles.</p>}
            </div>
          </section>

          <section className="panel-block battle-report">
            <p className="eyebrow">Parte de batalla</p>
            <h2>{lastBattle ? formatBattleTitle(lastBattle) : "Sin enfrentamientos"}</h2>
            <p className="muted">{lastBattle ? formatBattleDetail(lastBattle) : "Los movimientos militares apareceran aqui cuando empiece la fase de batalla."}</p>
          </section>

          <section className="panel-block log">
            <div className="split">
              <h2>Historial</h2>
              <span className="log-count">{G.log.length}</span>
            </div>
            {G.log.map((entry, index) => (
              <p className={entry.includes(" ataca ") ? "battle-entry" : ""} key={`${entry}-${index}`}>{entry}</p>
            ))}
          </section>
        </aside>
      </section>

      {ctx.gameover?.winner && (
        <VictoryModal
          winner={ctx.gameover.winner}
          turnNumber={G.turnNumber}
          capitalSummary={capitalSummary}
          powerSummary={powerSummary}
          victoryReason={G.victoryReason}
          settings={G.settings}
          onNewGame={() => dispatchLobbyAction("new")}
          onLobby={() => dispatchLobbyAction("lobby")}
        />
      )}
    </main>
  );
}

function TerritoryPanel({ title, territory, active = false }: { title: string; territory?: TerritoryState; active?: boolean }) {
  return (
    <section className={`panel-block territory-card ${active ? "active" : ""}`}>
      <p className="eyebrow">{title}</p>
      {territory ? (
        <>
          <div className="territory-heading">
            <h2>{territory.name}</h2>
            {territory.isCapital && <span className="capital-badge">Capital</span>}
          </div>
          <div className="stats">
            <span>Dueno {territory.ownerId ?? "Neutral"}</span>
            <span>Tropas {territory.troops}</span>
            <span>Recursos {territory.resources}</span>
            <span>{terrainLabel(territory.terrain)}</span>
          </div>
          <p className="connections">Conecta: {territory.connections.length}</p>
        </>
      ) : (
        <p className="muted">Elige un territorio conectado para completar la orden.</p>
      )}
    </section>
  );
}

function getActionHint(G: EuropaGameState, selected: TerritoryState | undefined, target: TerritoryState | undefined, playerID: string | null, isActive: boolean) {
  if (!isActive) return { ok: false, message: "Esperando al jugador activo." };
  if (!selected) return { ok: false, message: "Selecciona un territorio propio." };
  if (G.phase === "production") {
    return selected.ownerId === playerID
      ? { ok: true, message: "Puedes reclutar en este territorio." }
      : { ok: false, message: "Selecciona un territorio propio para reclutar." };
  }
  if (G.phase === "movement") {
    if (selected.ownerId !== playerID) return { ok: false, message: "El origen debe ser tuyo." };
    if (!target) return { ok: false, message: "Selecciona un destino propio conectado." };
    if (target.ownerId !== playerID) return { ok: false, message: "El destino de movimiento debe ser propio." };
    return { ok: true, message: "Orden de movimiento lista." };
  }
  if (G.phase === "battle") {
    if (selected.ownerId !== playerID) return { ok: false, message: "El ataque debe salir de un territorio propio." };
    if (!target) return { ok: false, message: "Selecciona un objetivo enemigo adyacente." };
    if (target.ownerId === playerID) return { ok: false, message: "No puedes atacar un territorio propio." };
    return { ok: true, message: "Ataque preparado contra objetivo adyacente." };
  }
  return selected.ownerId === playerID
    ? { ok: true, message: "Puedes fortificar este territorio." }
    : { ok: false, message: "Selecciona un territorio propio para fortificar." };
}

function terrainLabel(terrain: TerritoryState["terrain"]) {
  const labels = {
    plains: "Llanura",
    mountain: "Montana",
    forest: "Bosque",
    urban: "Urbano",
    coast: "Costa"
  };
  return labels[terrain];
}

function getCapitalSummary(G: EuropaGameState) {
  const counts = new Map<string, number>();
  for (const territory of Object.values(G.territories)) {
    if (territory.isCapital && territory.ownerId) {
      counts.set(territory.ownerId, (counts.get(territory.ownerId) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function getPowerSummary(G: EuropaGameState) {
  return Array.from({ length: G.settings.numPlayers }, (_, index) => String(index) as "0" | "1" | "2" | "3" | "4" | "5")
    .map((player) => [player, getPowerScore(G, player)] as [string, number])
    .sort(([a], [b]) => a.localeCompare(b));
}

function canPlayCard(card: EventCard, G: EuropaGameState, selected: TerritoryState | undefined, target: TerritoryState | undefined, playerID: string | null) {
  if (!playerID || G.cardsPlayedThisTurn[playerID as keyof typeof G.cardsPlayedThisTurn]) return false;
  const cardTarget = target ?? selected;
  if (!cardTarget) return false;
  if (card.kind === "production" && G.phase !== "production") return false;
  if (card.kind === "production" || card.kind === "reinforcement" || card.kind === "defense") {
    return cardTarget.ownerId === playerID;
  }
  const hasOwnAdjacent = Object.values(G.territories).some((territory) => territory.ownerId === playerID && territory.connections.includes(cardTarget.id));
  return cardTarget.ownerId !== playerID && hasOwnAdjacent;
}

function formatBattleTitle(entry: string) {
  return entry.split(":")[0] ?? entry;
}

function formatBattleDetail(entry: string) {
  return entry.includes(":") ? entry.split(":").slice(1).join(":").trim() : entry;
}

function VictoryModal({
  winner,
  turnNumber,
  capitalSummary,
  powerSummary,
  victoryReason,
  settings,
  onNewGame,
  onLobby
}: {
  winner: string;
  turnNumber: number;
  capitalSummary: [string, number][];
  powerSummary: [string, number][];
  victoryReason: string | null;
  settings: EuropaGameState["settings"];
  onNewGame: () => void;
  onLobby: () => void;
}) {
  return (
    <div className="victory-backdrop" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <section className="victory-modal">
        <p className="eyebrow">Tratado final</p>
        <h2 id="victory-title">Victoria del jugador {winner}</h2>
        <p className="muted">La campana concluyo en el turno {turnNumber}. {victoryReason ?? "Objetivo estrategico completado."}</p>
        <div className="capital-table">
          {capitalSummary.map(([player, count]) => (
            <span className={player === winner ? "winner-row" : ""} key={player}>
              Jugador {player}: {count} capitales
            </span>
          ))}
        </div>
        <div className="capital-table">
          {powerSummary.map(([player, score]) => (
            <span className={player === winner ? "winner-row" : ""} key={player}>
              Poder {player}: {score}/{settings.powerTarget}
            </span>
          ))}
        </div>
        <div className="modal-actions">
          <button className="primary" onClick={onNewGame}>Nueva partida</button>
          <button onClick={onLobby}>Volver al lobby</button>
        </div>
      </section>
    </div>
  );
}

function nextPhaseName(phase: EuropaGameState["phase"]) {
  if (phase === "production") return "movement";
  if (phase === "movement") return "battle";
  if (phase === "battle") return "consolidation";
  return "production";
}
