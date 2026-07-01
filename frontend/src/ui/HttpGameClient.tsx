import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EuropaGameState } from "@europa/shared";
import { GameBoard } from "./GameBoard";

type HttpGameClientProps = {
  serverUrl: string;
  matchID: string;
  playerID: string;
  credentials: string;
};

type MatchPayload = {
  matchID: string;
  version: number;
  playerID: string;
  G: EuropaGameState;
  ctx: { currentPlayer: string; gameover?: { winner?: string } };
};

type SyncState = "sincronizando" | "actualizado" | "error";

export function HttpGameClient({ serverUrl, matchID, playerID, credentials }: HttpGameClientProps) {
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("sincronizando");
  const [syncError, setSyncError] = useState("");
  const matchRef = useRef<MatchPayload | null>(null);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  const fetchMatch = useCallback(async () => {
    try {
      setSyncState("sincronizando");
      const query = new URLSearchParams({ playerID, playerSecret: credentials });
      const response = await fetch(`${serverUrl}/api/matches/${encodeURIComponent(matchID)}?${query}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "No se pudo sincronizar la partida.");
      setMatch(payload as MatchPayload);
      setSyncError("");
      setSyncState("actualizado");
    } catch (error) {
      setSyncState("error");
      setSyncError(error instanceof Error ? error.message : "Error de sincronizacion.");
    }
  }, [credentials, matchID, playerID, serverUrl]);

  useEffect(() => {
    void fetchMatch();
    const interval = window.setInterval(() => void fetchMatch(), 1500);
    return () => window.clearInterval(interval);
  }, [fetchMatch]);

  const moves = useMemo(() => {
    async function send(type: string, args: unknown[] = [], retryOnConflict = true) {
      const current = matchRef.current;
      if (!current) return;

      try {
        setSyncState("sincronizando");
        const response = await fetch(`${serverUrl}/api/matches/${encodeURIComponent(matchID)}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerID,
            playerSecret: credentials,
            expectedVersion: current.version,
            move: { type, args }
          })
        });
        const payload = await response.json();
        if (response.status === 409 && payload.match) {
          const nextMatch = payload.match as MatchPayload;
          setMatch(nextMatch);
          matchRef.current = nextMatch;
          if (retryOnConflict) {
            await send(type, args, false);
            return;
          }
          throw new Error(payload.error ?? "La partida cambio. Reintentando con estado actualizado.");
        }
        if (!response.ok) throw new Error(payload.error ?? "Movimiento rechazado.");
        setMatch(payload as MatchPayload);
        setSyncError("");
        setSyncState("actualizado");
        void fetchMatch();
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Movimiento rechazado.");
        setSyncState("error");
        void fetchMatch();
      }
    }

    return {
      recruit: (territoryId: string, amount: number) => void send("recruit", [territoryId, amount]),
      move: (fromId: string, toId: string, amount: number) => void send("move", [fromId, toId, amount]),
      attack: (fromId: string, toId: string, amount: number) => void send("attack", [fromId, toId, amount]),
      fortify: (territoryId: string) => void send("fortify", [territoryId]),
      playCard: (cardId: string, targetId: string) => void send("playCard", [cardId, targetId]),
      endPhase: () => void send("endPhase")
    };
  }, [credentials, fetchMatch, matchID, playerID, serverUrl]);

  if (!match) {
    return (
      <main className="login-shell">
        <section className="login-panel">
          <p className="eyebrow">Sincronizando</p>
          <h1>Europa: Pactos de Hierro</h1>
          <p className="status">{syncError || "Cargando partida..."}</p>
        </section>
      </main>
    );
  }

  return (
    <GameBoard
      G={match.G}
      ctx={match.ctx}
      moves={moves}
      playerID={playerID}
      matchID={matchID}
      isActive={match.ctx.currentPlayer === playerID && !match.ctx.gameover}
      syncStatus={syncState}
      syncError={syncError}
    />
  );
}
