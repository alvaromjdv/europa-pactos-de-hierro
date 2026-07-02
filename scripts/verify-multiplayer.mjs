import { chromium } from "playwright";
import { rm } from "node:fs/promises";
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
      // Server is not ready yet.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`No respondio ${url}`);
}

function startProcess(command, args, env, useShell = false) {
  const child = spawn(command, args, {
    cwd: resolve("."),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    shell: useShell
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
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

async function clickTerritory(page, x, y) {
  const map = page.locator(".map-frame");
  const box = await map.boundingBox();
  assert(box, "No se encontro el mapa.");
  await page.mouse.click(box.x + 22 + x * 0.82, box.y + 8 + y * 0.82);
}

async function waitForText(page, text) {
  await page.locator("body").filter({ hasText: text }).waitFor({ timeout: 10000 });
}

await rm(resolve("data/netlify-local"), { recursive: true, force: true });

const apiProcess = startProcess(nodeCommand, ["--import", "tsx", "scripts/local-netlify-api.ts"], {
  API_PORT: apiPort,
  NETLIFY_LOCAL_DATA_DIR: resolve("data/netlify-local")
});
const frontendProcess = startProcess(npmCommand, ["--workspace", "@europa/frontend", "run", "dev", "--", "--port", frontendPort, "--strictPort"], {
  VITE_SERVER_ORIGIN: apiUrl
}, process.platform === "win32");

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
console.log(JSON.stringify({ frontendUrl, apiUrl }));

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  for (const [label, page] of [
    ["A", pageA],
    ["B", pageB]
  ]) {
    page.on("pageerror", (error) => errors.push(`${label} pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.text().includes("GPU stall due to ReadPixels")) return;
      if (message.type() === "error") errors.push(`${label} console ${message.type()}: ${message.text()}`);
    });
  }

  await pageA.goto(frontendUrl, { waitUntil: "networkidle" });
  await pageA.getByRole("button", { name: "Como jugar" }).click();
  await pageA.getByRole("dialog", { name: "Juega como en un tablero de conquista" }).waitFor();
  await pageA.getByRole("heading", { name: "Refuerza" }).waitFor();
  await pageA.getByRole("button", { name: "Entendido" }).click();
  await pageA.getByLabel("Nombre").fill("Alice");
  await pageA.getByRole("button", { name: "Crear partida" }).click();
  try {
    await pageA.locator(".game-shell canvas").waitFor({ timeout: 15000 });
  } catch (error) {
    console.error(await pageA.locator("body").innerText());
    console.error(errors.join("\n"));
    throw error;
  }

  const header = await pageA.locator("header .eyebrow").textContent();
  const matchID = header?.replace("Partida", "").trim();
  assert(matchID, "No se pudo leer el codigo de partida.");

  await pageB.goto(`${frontendUrl}/?join=${matchID}`, { waitUntil: "networkidle" });
  await pageB.getByLabel("Nombre").fill("Bob");
  await pageB.getByRole("button", { name: "Unirse con codigo" }).click();
  await pageB.locator(".game-shell canvas").waitFor({ timeout: 15000 });

  await waitForText(pageA, "Tu turno");
  await waitForText(pageB, "Esperando al jugador 0");

  await pageA.getByText("Ordenes opcionales").click();
  await pageA.getByRole("button", { name: /Impulso industrial/ }).click();
  await waitForText(pageA, "juega Impulso industrial");
  await waitForText(pageB, "juega Impulso industrial");

  await pageA.getByRole("button", { name: "Reclutar" }).click();
  await waitForText(pageA, "Tropas 9");
  await waitForText(pageB, "recluta 1 tropas");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Batalla");
  await waitForText(pageB, "Batalla");

  await clickTerritory(pageA, 270, 420);
  await clickTerritory(pageA, 350, 355);
  await pageA.getByRole("button", { name: "Atacar" }).click();
  await waitForText(pageA, "Francia ataca Benelux");
  await waitForText(pageB, "Francia ataca Benelux");
  await waitForText(pageA, "terreno +");
  await waitForText(pageB, "terreno +");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Consolidacion");
  await waitForText(pageB, "Consolidacion");

  await clickTerritory(pageA, 160, 520);
  await clickTerritory(pageA, 270, 420);
  await pageA.getByRole("button", { name: "Fortificar" }).click();
  await waitForText(pageA, "Iberia -> Francia");
  await waitForText(pageB, "Iberia -> Francia");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Esperando al jugador 1");
  await waitForText(pageB, "Tu turno");

  assert(errors.length === 0, `Errores de navegador:\n${errors.join("\n")}`);
  console.log(JSON.stringify({ ok: true, matchID }, null, 2));
} finally {
  await browser.close();
  stopProcess(apiProcess);
  stopProcess(frontendProcess);
}
