import React from "react";
import ReactDOM from "react-dom/client";
import { Client } from "boardgame.io/react";
import { SocketIO } from "boardgame.io/multiplayer";
import { EuropaGame } from "@europa/shared";
import { App } from "./ui/App";
import { GameBoard } from "./ui/GameBoard";
import "./styles.css";

const SERVER_URL = import.meta.env.VITE_SERVER_ORIGIN ?? import.meta.env.VITE_SERVER_URL ?? "http://localhost:8000";

const EuropaClient = Client({
  game: EuropaGame,
  board: GameBoard,
  multiplayer: SocketIO({ server: SERVER_URL }),
  debug: false
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App serverUrl={SERVER_URL} GameClient={EuropaClient} />
  </React.StrictMode>
);
