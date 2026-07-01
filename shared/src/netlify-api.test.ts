import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

process.env.NETLIFY_LOCAL_DATA_DIR = resolve("data/netlify-api-test");

const { handleApiRequest } = await import("./netlify-api");

async function resetStore() {
  await rm(process.env.NETLIFY_LOCAL_DATA_DIR!, { recursive: true, force: true });
}

async function createAndJoin() {
  await resetStore();
  const created = await handleApiRequest({
    method: "POST",
    path: "/api/matches/create",
    body: JSON.stringify({ settings: { numPlayers: 2, targetCapitals: 3, duration: "standard" } })
  });
  assert.equal(created.status, 200);
  const matchID = (created.body as { matchID: string }).matchID;

  const joined = await handleApiRequest({
    method: "POST",
    path: "/api/matches/join",
    body: JSON.stringify({ matchID, playerID: "0", playerName: "Alice" })
  });
  assert.equal(joined.status, 200);
  const credentials = (joined.body as { playerCredentials: string }).playerCredentials;
  return { matchID, credentials };
}

test("netlify api crea, une y devuelve vista de jugador", async () => {
  const { matchID, credentials } = await createAndJoin();
  const response = await handleApiRequest({
    method: "GET",
    path: `/api/matches/${matchID}?playerID=0&playerSecret=${credentials}`
  });

  assert.equal(response.status, 200);
  assert.equal((response.body as { ctx: { currentPlayer: string } }).ctx.currentPlayer, "0");
});

test("netlify api rechaza credenciales invalidas", async () => {
  const { matchID } = await createAndJoin();
  const response = await handleApiRequest({
    method: "GET",
    path: `/api/matches/${matchID}?playerID=0&playerSecret=bad-secret`
  });

  assert.equal(response.status, 401);
});

test("netlify api aplica optimistic locking", async () => {
  const { matchID, credentials } = await createAndJoin();
  const first = await handleApiRequest({
    method: "POST",
    path: `/api/matches/${matchID}/move`,
    body: JSON.stringify({
      playerID: "0",
      playerSecret: credentials,
      expectedVersion: 1,
      move: { type: "recruit", args: ["iberia", 1] }
    })
  });
  assert.equal(first.status, 200);

  const stale = await handleApiRequest({
    method: "POST",
    path: `/api/matches/${matchID}/move`,
    body: JSON.stringify({
      playerID: "0",
      playerSecret: credentials,
      expectedVersion: 1,
      move: { type: "recruit", args: ["iberia", 1] }
    })
  });
  assert.equal(stale.status, 409);
});

test("netlify api no permite mover fuera de turno", async () => {
  const { matchID } = await createAndJoin();
  const joined = await handleApiRequest({
    method: "POST",
    path: "/api/matches/join",
    body: JSON.stringify({ matchID, playerID: "1", playerName: "Bob" })
  });
  assert.equal(joined.status, 200);
  const credentials = (joined.body as { playerCredentials: string }).playerCredentials;

  const response = await handleApiRequest({
    method: "POST",
    path: `/api/matches/${matchID}/move`,
    body: JSON.stringify({
      playerID: "1",
      playerSecret: credentials,
      expectedVersion: 2,
      move: { type: "recruit", args: ["germany", 1] }
    })
  });

  assert.equal(response.status, 400);
  assert.match((response.body as { error: string }).error, /No es tu turno/);
});
