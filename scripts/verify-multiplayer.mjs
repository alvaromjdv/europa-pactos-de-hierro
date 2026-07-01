import { chromium } from "playwright";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function clickTerritory(page, x, y) {
  const canvas = page.locator(".map-frame canvas");
  const box = await canvas.boundingBox();
  assert(box, "No se encontro el canvas del mapa.");
  await page.mouse.click(box.x + 22 + x * 0.82, box.y + 8 + y * 0.82);
}

async function waitForText(page, text) {
  await page.locator("body").filter({ hasText: text }).waitFor({ timeout: 10000 });
}

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
  await pageA.getByLabel("Nombre").fill("Alice");
  await pageA.getByRole("button", { name: "Crear partida" }).click();
  await pageA.locator(".game-shell canvas").waitFor({ timeout: 15000 });

  const header = await pageA.locator("header .eyebrow").textContent();
  const matchID = header?.replace("Partida", "").trim();
  assert(matchID, "No se pudo leer el codigo de partida.");

  await pageB.goto(`${frontendUrl}/?join=${matchID}`, { waitUntil: "networkidle" });
  await pageB.getByLabel("Nombre").fill("Bob");
  await pageB.getByRole("button", { name: "Unirse" }).click();
  await pageB.locator(".game-shell canvas").waitFor({ timeout: 15000 });

  await waitForText(pageA, "Tu turno");
  await waitForText(pageB, "Esperando al jugador 0");

  await pageA.getByRole("button", { name: "Reclutar" }).click();
  await waitForText(pageA, "Tropas 7");
  await waitForText(pageB, "Tropas 7");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Movimiento");
  await waitForText(pageB, "Movimiento");

  await clickTerritory(pageA, 270, 420);
  await pageA.getByRole("button", { name: "Mover" }).click();
  await waitForText(pageA, "Iberia -> Francia");
  await waitForText(pageB, "Iberia -> Francia");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Batalla");
  await waitForText(pageB, "Batalla");

  await clickTerritory(pageA, 270, 420);
  await clickTerritory(pageA, 350, 355);
  await pageA.getByRole("button", { name: "Atacar" }).click();
  await waitForText(pageA, "Francia ataca Benelux");
  await waitForText(pageB, "Francia ataca Benelux");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Consolidacion");
  await waitForText(pageB, "Consolidacion");

  await pageA.getByRole("button", { name: "Fortificar" }).click();
  await waitForText(pageA, "fortifica posiciones");
  await waitForText(pageB, "fortifica posiciones");

  await pageA.getByRole("button", { name: "Terminar fase" }).click();
  await waitForText(pageA, "Esperando al jugador 1");
  await waitForText(pageB, "Tu turno");

  assert(errors.length === 0, `Errores de navegador:\n${errors.join("\n")}`);
  console.log(JSON.stringify({ ok: true, matchID }, null, 2));
} finally {
  await browser.close();
}
