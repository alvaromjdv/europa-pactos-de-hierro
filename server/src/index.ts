import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { EuropaGame } from "@europa/shared";

const require = createRequire(import.meta.url);
const { FlatFile, Server } = require("boardgame.io/server") as typeof import("boardgame.io/server");

const port = Number(process.env.PORT ?? 8000);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
const dataDir = resolve(process.env.DATA_DIR ?? "data");
const origins = [...new Set([...clientOrigin.split(","), "http://localhost:5173", "http://127.0.0.1:5173", ...getLanOrigins()])];

mkdirSync(dataDir, { recursive: true });

const server = Server({
  games: [EuropaGame],
  origins,
  db: new FlatFile({ dir: dataDir })
});

server.app.use(async (ctx, next) => {
  if (ctx.path === "/health") {
    ctx.body = { ok: true, service: "europa-pactos-de-hierro", dataDir };
    return;
  }
  await next();
});

server.run(port, () => {
  console.log(`Europa server listening on http://localhost:${port}`);
  console.log(`Allowed client origins: ${origins.join(", ")}`);
});

function getLanOrigins() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address): address is NonNullable<typeof address> => Boolean(address && address.family === "IPv4" && !address.internal))
    .map((address) => `http://${address.address}:5173`);
}
