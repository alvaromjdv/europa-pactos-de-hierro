import { useMemo, useState } from "react";
import { isConnected, type EuropaGameState, type TerritoryState } from "@europa/shared";
import { MapCanvas } from "./MapCanvas";

type BoardProps = {
  G: EuropaGameState;
  ctx: { currentPlayer: string; gameover?: { winner?: string } };
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  matchID: string;
  isActive: boolean;
};

const phaseLabels = {
  production: "Produccion",
  movement: "Movimiento",
  battle: "Batalla",
  consolidation: "Consolidacion"
};

export function GameBoard({ G, ctx, moves, playerID, matchID, isActive }: BoardProps) {
  const [selectedId, setSelectedId] = useState<string>("iberia");
  const [targetId, setTargetId] = useState<string>("");
  const [amount, setAmount] = useState(1);
  const selected = G.territories[selectedId];
  const target = targetId ? G.territories[targetId] : undefined;
  const playerTerritories = useMemo(
    () => Object.values(G.territories).filter((territory) => playerID && territory.ownerId === playerID),
    [G.territories, playerID]
  );
  const resources = playerTerritories.reduce((total, territory) => total + territory.resources, 0);
  const capitals = playerTerritories.filter((territory) => territory.isCapital).length;
  const shareUrl = `${window.location.origin}${window.location.pathname}?join=${matchID}`;

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
  }

  function renderAction() {
    if (!isActive) return <p className="muted">Esperando al jugador {ctx.currentPlayer}.</p>;
    if (!selected) return <p className="muted">Selecciona un territorio.</p>;

    if (G.phase === "production") {
      return (
        <button disabled={selected.ownerId !== playerID} onClick={() => moves.recruit(selected.id, amount)}>
          Reclutar
        </button>
      );
    }

    if (G.phase === "movement") {
      return (
        <button disabled={!target || selected.ownerId !== playerID || target.ownerId !== playerID} onClick={() => target && moves.move(selected.id, target.id, amount)}>
          Mover
        </button>
      );
    }

    if (G.phase === "battle") {
      return (
        <button disabled={!target || selected.ownerId !== playerID || target.ownerId === playerID} onClick={() => target && moves.attack(selected.id, target.id, amount)}>
          Atacar
        </button>
      );
    }

    return (
      <button disabled={selected.ownerId !== playerID} onClick={() => moves.fortify(selected.id)}>
        Fortificar
      </button>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Partida {matchID}</p>
          <h1>Europa: Pactos de Hierro</h1>
        </div>
        <div className="turn-summary">
          <span>Jugador {playerID}</span>
          <span>{phaseLabels[G.phase]}</span>
          <span>Turno {G.turnNumber}</span>
        </div>
      </header>

      <section className="war-room">
        <MapCanvas G={G} selectedId={selectedId} targetId={targetId} playerID={playerID} onSelect={selectTerritory} />

        <aside className="side-panel">
          <section className="panel-block">
            <div className="split">
              <div>
                <p className="eyebrow">Jugador activo</p>
                <h2>{ctx.currentPlayer === playerID ? "Tu turno" : `Jugador ${ctx.currentPlayer}`}</h2>
              </div>
              <button className="icon-button" onClick={copyLink} title="Copiar link de partida">Copiar</button>
            </div>
            <div className="stats">
              <span>Recursos {resources}</span>
              <span>Capitales {capitals}/3</span>
              <span>{isActive ? "Activo" : "Espera"}</span>
            </div>
          </section>

          <TerritoryPanel title="Seleccionado" territory={selected} />
          <TerritoryPanel title="Objetivo" territory={target} />

          <section className="panel-block">
            <label>
              Tropas
              <input type="number" min={1} max={99} value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
            </label>
            <div className="action-row">{renderAction()}</div>
            <button className="primary wide" disabled={!isActive} onClick={() => moves.endPhase()}>
              Terminar fase
            </button>
          </section>

          {ctx.gameover?.winner && (
            <section className="panel-block victory">
              <h2>Victoria del jugador {ctx.gameover.winner}</h2>
            </section>
          )}

          <section className="panel-block log">
            <h2>Historial</h2>
            {G.log.map((entry, index) => (
              <p key={`${entry}-${index}`}>{entry}</p>
            ))}
          </section>
        </aside>
      </section>
    </main>
  );
}

function TerritoryPanel({ title, territory }: { title: string; territory?: TerritoryState }) {
  return (
    <section className="panel-block">
      <p className="eyebrow">{title}</p>
      {territory ? (
        <>
          <h2>{territory.name}</h2>
          <div className="stats">
            <span>Dueno {territory.ownerId ?? "Neutral"}</span>
            <span>Tropas {territory.troops}</span>
            <span>{territory.terrain}</span>
          </div>
        </>
      ) : (
        <p className="muted">Sin territorio.</p>
      )}
    </section>
  );
}
