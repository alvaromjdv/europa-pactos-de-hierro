import assert from "node:assert/strict";
import test from "node:test";
import { attackTerritory, checkWinner, createInitialState, moveTroops } from "./game";

test("no permite mover tropas inexistentes", () => {
  const G = createInitialState();
  G.phase = "movement";
  const before = G.territories.iberia.troops;

  const result = moveTroops(G, "0", "0", "iberia", "france", before);

  assert.equal(result.ok, false);
  assert.equal(G.territories.iberia.troops, before);
});

test("no permite atacar territorios no adyacentes", () => {
  const G = createInitialState();
  G.phase = "battle";

  const result = attackTerritory(G, "0", "0", "iberia", "russia", 2, () => 6);

  assert.equal(result.ok, false);
});

test("no permite jugar fuera de turno", () => {
  const G = createInitialState();
  G.phase = "movement";

  const result = moveTroops(G, "0", "1", "ukraine", "russia", 1);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "No es tu turno.");
});

test("declara victoria al controlar el objetivo de capitales", () => {
  const G = createInitialState();
  G.territories.germany.ownerId = "0";

  assert.equal(checkWinner(G), "0");
});
