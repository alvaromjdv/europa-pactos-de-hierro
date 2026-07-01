import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { EuropaGame } from "@europa/shared";

const require = createRequire(import.meta.url);
const { FlatFile, Server } = require("boardgame.io/server") as typeof import("boardgame.io/server");

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";
const port = Number(process.env.PORT ?? 8000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? process.env.CLIENT_ORIGIN;
const serverOrigin = process.env.SERVER_ORIGIN ?? `http://localhost:${port}`;
const dataDir = resolve(process.env.DATA_DIR ?? "data");
const origins = getAllowedOrigins(frontendOrigin, isProduction);

if (isProduction && origins.length === 0) {
  throw new Error("FRONTEND_ORIGIN is required when NODE_ENV=production.");
}

mkdirSync(dataDir, { recursive: true });

const server = Server({
  games: [EuropaGame],
  origins,
  db: new FlatFile({ dir: dataDir })
});

server.app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error("Unhandled server error", error);
    ctx.status = 500;
    ctx.body = { error: "Internal server error" };
  }
});

server.app.use(async (ctx, next) => {
  if (ctx.path === "/health") {
    ctx.body = { ok: true, service: "europa-pactos-de-hierro", environment: nodeEnv, serverOrigin };
    return;
  }
  await next();
});

server.run(port, () => {
  console.log(`Europa server listening on ${serverOrigin}`);
  console.log(`Environment: ${nodeEnv}`);
  console.log(`Data directory: ${dataDir}`);
  console.log(`Allowed client origins: ${origins.join(", ")}`);
});

function getAllowedOrigins(frontendOrigin: string | undefined, production: boolean) {
  const configured = (frontendOrigin ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (production) return [...new Set(configured)];

  return [...new Set([...configured, "http://localhost:5173", "http://127.0.0.1:5173", ...getLanOrigins()])];
}

function getLanOrigins() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address): address is NonNullable<typeof address> => Boolean(address && address.family === "IPv4" && !address.internal))
    .map((address) => `http://${address.address}:5173`);
}
