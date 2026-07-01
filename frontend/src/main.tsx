import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import { HttpGameClient } from "./ui/HttpGameClient";
import "./styles.css";

const SERVER_URL = import.meta.env.VITE_SERVER_ORIGIN ?? import.meta.env.VITE_SERVER_URL ?? "";

function EuropaClient(props: { matchID: string; playerID: string; credentials: string }) {
  return <HttpGameClient serverUrl={SERVER_URL} {...props} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App serverUrl={SERVER_URL} GameClient={EuropaClient} />
  </React.StrictMode>
);
