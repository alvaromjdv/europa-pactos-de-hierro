import assert from "node:assert/strict";
import test from "node:test";
import { attackTerritory, advancePhase, checkWinner, createInitialState, getPlayerResources, getRegionControlBonus, getPlayerView, getPowerScore, getTerrainDefenseBonus, moveTroops, playEventCard } from "./game";

test("no permite mover tropas inexistentes", () => {
  const G = createInitialState();
  G.phase = "movement";
  const before = G.territories.iberia.troops;

  const result = moveTroops(G, "0", "0", "iberia", "france", before);

  assert.equal(result.ok, false);
  assert.equal(G.territories.iberia.troops, before);
});

test("permite fortificar moviendo tropas al final del turno", () => {
  const G = createInitialState();
  G.phase = "consolidation";
  G.territories.iberia.troops = 7;
  const beforeFrance = G.territories.france.troops;

  const result = moveTroops(G, "0", "0", "iberia", "france", 2);

  assert.equal(result.ok, true);
  assert.equal(G.territories.iberia.troops, 5);
  assert.equal(G.territories.france.troops, beforeFrance + 2);
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

test("aplica bonus de defensa por montana y capital", () => {
  const G = createInitialState();

  assert.equal(getTerrainDefenseBonus(G.territories.iberia), 2);
  assert.equal(getTerrainDefenseBonus(G.territories.alps), 1);
  assert.equal(getTerrainDefenseBonus(G.territories.france), 1);
  assert.equal(getTerrainDefenseBonus(G.territories["western-med"]), 0);
});

test("suma bonus de region al controlar una region completa", () => {
  const G = createInitialState();
  G.territories.ireland.ownerId = "0";

  assert.equal(getRegionControlBonus(G, "0"), 3);
  assert.equal(getPlayerResources(G, "0"), 15);
});

test("incluye el bonus de terreno en combate", () => {
  const G = createInitialState();
  G.phase = "battle";
  G.territories.france.troops = 10;
  G.territories.germany.ownerId = "1";
  G.territories.germany.troops = 2;

  const result = attackTerritory(G, "0", "0", "france", "germany", 3, () => 3);

  assert.equal(result.ok, true);
  assert.equal(result.battle?.terrainDefenseBonus, 2);
});

test("permite jugar una carta por turno y la elimina de la mano", () => {
  const G = createInitialState();
  G.hands["0"] = [{ id: "reserve-corps", title: "Cuerpo de reserva", kind: "reinforcement", text: "" }];
  const before = G.territories.iberia.troops;

  const result = playEventCard(G, "0", "0", "reserve-corps", "iberia");

  assert.equal(result.ok, true);
  assert.equal(G.territories.iberia.troops, before + 3);
  assert.equal(G.hands["0"]?.length, 0);
  assert.equal(G.cardsPlayedThisTurn["0"], true);
});

test("no permite jugar dos cartas en el mismo turno", () => {
  const G = createInitialState();
  G.hands["0"] = [
    { id: "reserve-corps", title: "Cuerpo de reserva", kind: "reinforcement", text: "" },
    { id: "local-militia", title: "Milicia local", kind: "reinforcement", text: "" }
  ];

  assert.equal(playEventCard(G, "0", "0", "reserve-corps", "iberia").ok, true);
  assert.equal(playEventCard(G, "0", "0", "local-militia", "france").ok, false);
});

test("mantiene maximo tres cartas al robar al nuevo turno", () => {
  const G = createInitialState();
  G.hands["0"] = [
    { id: "reserve-corps", title: "Cuerpo de reserva", kind: "reinforcement", text: "" },
    { id: "local-militia", title: "Milicia local", kind: "reinforcement", text: "" },
    { id: "field-works", title: "Obras de campana", kind: "defense", text: "" }
  ];
  G.phase = "consolidation";

  const result = advancePhase(G, "0", "0");

  assert.equal(result.ok, true);
  assert.equal(G.hands["0"]?.length, 3);
});

test("aplica sabotaje solo sobre enemigo adyacente", () => {
  const G = createInitialState();
  G.phase = "battle";
  G.hands["0"] = [{ id: "supply-sabotage", title: "Sabotaje logistico", kind: "sabotage", text: "" }];
  G.territories.benelux.ownerId = "1";
  G.territories.benelux.troops = 4;

  const result = playEventCard(G, "0", "0", "supply-sabotage", "benelux");

  assert.equal(result.ok, true);
  assert.equal(G.territories.benelux.troops, 3);
});

test("niebla ligera oculta tropas exactas lejanas", () => {
  const G = createInitialState();
  G.territories.russia.troops = 7;

  const view = getPlayerView(G, "0");

  assert.equal(view.territories.russia.troops, 8);
  assert.equal(view.territories.france.troops, G.territories.france.troops);
});

test("declara victoria por puntos de poder", () => {
  const G = createInitialState({ powerTarget: 10 });

  assert.equal(getPowerScore(G, "0") >= 10, true);
  assert.equal(checkWinner(G), "0");
});
