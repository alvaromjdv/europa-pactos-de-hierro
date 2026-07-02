import { chromium } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { resolve } from "node:path";

async function getFreePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  server.close();
  await once(server, "close");
  return String(port);
}

const apiPort = process.env.API_PORT ?? await getFreePort();
const frontendPort = process.env.FRONTEND_PORT ?? await getFreePort();
const frontendUrl = process.env.FRONTEND_URL ?? `http://localhost:${frontendPort}`;
const apiUrl = process.env.VITE_SERVER_ORIGIN ?? `http://localhost:${apiPort}`;
const artifactsDir = resolve("artifacts/ui-review");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const nodeCommand = process.execPath;
let stopping = false;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not ready yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`No respondio ${url}`);
}

function startProcess(command, args, env, useShell = false) {
  return spawn(command, args, {
    cwd: resolve("."),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: useShell
  });
}

function stopProcess(child) {
  if (!child || child.killed) return;
  stopping = true;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

await rm(resolve("data/netlify-local-ui"), { recursive: true, force: true });
await rm(artifactsDir, { recursive: true, force: true });
await mkdir(artifactsDir, { recursive: true });

const apiProcess = startProcess(nodeCommand, ["--import", "tsx", "scripts/local-netlify-api.ts"], {
  API_PORT: apiPort,
  NETLIFY_LOCAL_DATA_DIR: resolve("data/netlify-local-ui")
});
const frontendProcess = startProcess(npmCommand, ["--workspace", "@europa/frontend", "run", "dev", "--", "--port", frontendPort, "--strictPort"], {
  VITE_SERVER_ORIGIN: apiUrl
}, process.platform === "win32");

apiProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
apiProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
frontendProcess.stdout.on("data", (chunk) => process.stdout.write(chunk));
frontendProcess.stderr.on("data", (chunk) => process.stderr.write(chunk));
apiProcess.once("exit", (code) => {
  if (!stopping && code !== null && code !== 0) console.error(`API local termino con codigo ${code}`);
});
frontendProcess.once("exit", (code) => {
  if (!stopping && code !== null && code !== 0) console.error(`Frontend local termino con codigo ${code}`);
});

await Promise.race([
  Promise.all([waitForHttp(`${apiUrl}/api/health`), waitForHttp(frontendUrl)]),
  once(apiProcess, "exit").then(() => Promise.reject(new Error("API local se cerro antes de estar lista."))),
  once(frontendProcess, "exit").then(() => Promise.reject(new Error("Frontend local se cerro antes de estar listo.")))
]);

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(frontendUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: resolve(artifactsDir, "01-start-screen.png"), fullPage: true });

  await page.getByRole("button", { name: "Como jugar" }).click();
  await page.getByRole("dialog", { name: "Juega como en un tablero de conquista" }).waitFor();
  await page.screenshot({ path: resolve(artifactsDir, "02-tutorial.png"), fullPage: true });
  await page.getByRole("button", { name: "Entendido" }).click();

  await page.getByLabel("Nombre").fill("Alice");
  await page.getByRole("button", { name: "Crear partida" }).click();
  await page.locator(".game-shell canvas").waitFor({ timeout: 15000 });
  await page.screenshot({ path: resolve(artifactsDir, "03-live-match.png"), fullPage: true });

  const before = await page.locator(".map-frame").boundingBox();
  assert(before, "No se encontro el marco del mapa.");
  for (let index = 0; index < 20; index += 1) {
    await page.mouse.move(before.x + 80 + index * 28, before.y + 80 + (index % 5) * 64);
  }
  const after = await page.locator(".map-frame").boundingBox();
  const canvasCount = await page.locator(".map-frame canvas").count();
  assert(after, "El marco del mapa desaparecio tras mover el raton.");
  assert(canvasCount === 1, `Se esperaban 1 canvas, hay ${canvasCount}.`);
  assert(Math.abs(before.width - after.width) < 1 && Math.abs(before.height - after.height) < 1, "El mapa cambio de tamano durante hover.");

  await page.evaluate(() => {
    const backdrop = document.createElement("div");
    backdrop.className = "victory-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.innerHTML = `
      <section class="victory-modal">
        <p class="eyebrow">Tratado final</p>
        <h2>Victoria del jugador 0</h2>
        <p class="muted">La campana concluyo en el turno 8. Objetivo de capitales completado.</p>
        <div class="capital-table">
          <span class="winner-row">Jugador 0: 3 capitales</span>
          <span>Jugador 1: 1 capital</span>
        </div>
        <div class="capital-table">
          <span class="winner-row">Poder 0: 42/40</span>
          <span>Poder 1: 25/40</span>
        </div>
        <div class="modal-actions">
          <button class="primary">Nueva partida</button>
          <button>Volver al lobby</button>
        </div>
      </section>
    `;
    document.body.appendChild(backdrop);
  });
  await page.screenshot({ path: resolve(artifactsDir, "04-victory-modal.png"), fullPage: true });

  console.log(JSON.stringify({ ok: true, artifactsDir }, null, 2));
} finally {
  await browser.close();
  stopProcess(apiProcess);
  stopProcess(frontendProcess);
}
