import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { EuropaGameState, Phase, TerritoryState } from "@europa/shared";

type MapCanvasProps = {
  G: EuropaGameState;
  selectedId: string;
  targetId: string;
  playerID: string | null;
  phase: Phase;
  effect: VisualEffect | null;
  onSelect: (id: string) => void;
};

type VisualEffect = {
  type: "recruit" | "move" | "attack" | "conquer" | "fortify" | "card";
  fromId?: string;
  toId?: string;
  territoryId?: string;
  nonce: number;
};

const ownerColors: Record<string, number> = {
  "0": 0x3f84c5,
  "1": 0xc13f31,
  "2": 0xe0b447,
  "3": 0x4e9b72,
  "4": 0x8d6bc2,
  "5": 0xd47b36,
  neutral: 0x9a8460
};

const terrainColors: Record<TerritoryState["terrain"], number> = {
  plains: 0xd7be84,
  mountain: 0xb38e65,
  forest: 0x89a75c,
  urban: 0xc4925d,
  coast: 0x83a9b8
};

export function MapCanvas({ G, selectedId, targetId, playerID, phase, effect, onSelect }: MapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Container | null>(null);
  const appRef = useRef<Application | null>(null);
  const mapLayerRef = useRef<Container | null>(null);
  const effectLayerRef = useRef<Container | null>(null);
  const transformRef = useRef({ scale: 0.82, x: 22, y: 8 });
  const [hoveredId, setHoveredId] = useState("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  function redrawMap() {
    const mapLayer = mapLayerRef.current;
    if (!mapLayer) return;

    mapLayer.removeChildren();
    drawBackplate(mapLayer);
    drawConnections(mapLayer, G, selectedId, targetId);
    for (const territory of Object.values(G.territories)) {
      drawTerritory(
        mapLayer,
        territory,
        {
          selected: territory.id === selectedId,
          targeted: territory.id === targetId,
          hovered: territory.id === hoveredId,
          own: Boolean(playerID && territory.ownerId === playerID),
          actionable: isActionable(phase, territory, playerID)
        }
      );
    }
  }

  function toMapPoint(clientX: number, clientY: number) {
    const host = hostRef.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const transform = transformRef.current;
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale
    };
  }

  function findTerritoryAt(clientX: number, clientY: number) {
    const point = toMapPoint(clientX, clientY);
    if (!point) return undefined;
    return Object.values(G.territories)
      .map((candidate) => ({
        territory: candidate,
        distance: Math.hypot(candidate.x - point.x, candidate.y - point.y)
      }))
      .filter(({ distance }) => distance <= 44)
      .sort((a, b) => a.distance - b.distance)[0]?.territory;
  }

  function handleCanvasPointer(event: PointerEvent<HTMLDivElement>) {
    const territory = findTerritoryAt(event.clientX, event.clientY);
    if (territory) onSelectRef.current(territory.id);
  }

  function handleCanvasHover(event: PointerEvent<HTMLDivElement>) {
    const host = hostRef.current;
    if (!host) return;
    const territory = findTerritoryAt(event.clientX, event.clientY);
    const next = territory?.id ?? "";
    if (next !== hoveredId) {
      setHoveredId(next);
      host.style.cursor = next ? "pointer" : "default";
    }
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application({
      backgroundColor: 0xc9b083,
      antialias: true,
      resizeTo: host
    });
    app.ticker.maxFPS = 30;
    host.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    const stage = new Container();
    stage.eventMode = "passive";
    stageRef.current = stage;
    app.stage.addChild(stage);

    const mapLayer = new Container();
    const effectLayer = new Container();
    mapLayer.eventMode = "passive";
    effectLayer.eventMode = "none";
    stage.addChild(mapLayer);
    stage.addChild(effectLayer);
    mapLayerRef.current = mapLayer;
    effectLayerRef.current = effectLayer;

    const resizeMap = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      const mapWidth = 1044;
      const mapHeight = 934;
      const scale = Math.max(0.42, Math.min(width / mapWidth, height / mapHeight) * 0.985);
      const x = Math.max(0, (width - mapWidth * scale) / 2);
      const y = Math.max(0, (height - mapHeight * scale) / 2);
      transformRef.current = { scale, x, y };
      stage.scale.set(scale);
      stage.x = x;
      stage.y = y;
      redrawMap();
    };
    const observer = new ResizeObserver(resizeMap);
    observer.observe(host);
    resizeMap();

    return () => {
      observer.disconnect();
      appRef.current = null;
      stageRef.current = null;
      mapLayerRef.current = null;
      effectLayerRef.current = null;
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, []);

  useEffect(() => {
    redrawMap();
  }, [G, selectedId, targetId, hoveredId, playerID, phase]);

  useEffect(() => {
    const app = appRef.current;
    const effectLayer = effectLayerRef.current;
    if (!app || !effectLayer) return;

    let pulse = 0;
    const drawEffectLayer = () => {
      effectLayer.removeChildren();
      drawEffect(effectLayer, G, effect, pulse);
    };
    const tickEffect = () => {
      pulse += 0.08;
      drawEffectLayer();
    };

    drawEffectLayer();
    if (effect) app.ticker.add(tickEffect);

    return () => {
      app.ticker?.remove(tickEffect);
      effectLayer.removeChildren();
    };
  }, [G, effect]);

  return (
    <div
      className="map-frame"
      ref={hostRef}
      onPointerDown={handleCanvasPointer}
      onPointerMove={handleCanvasHover}
      onPointerLeave={() => setHoveredId("")}
      aria-label="Mapa interactivo de Europa"
    />
  );
}

function drawBackplate(stage: Container) {
  const ocean = new Graphics();
  ocean.beginFill(0x22a7ca, 1);
  ocean.drawRoundedRect(20, 22, 1004, 900, 22);
  ocean.endFill();
  ocean.lineStyle(8, 0x111820, 0.62);
  ocean.drawRoundedRect(20, 22, 1004, 900, 22);
  stage.addChild(ocean);

  const oceanGrid = new Graphics();
  oceanGrid.lineStyle(1, 0xffffff, 0.12);
  for (let x = 64; x < 980; x += 86) {
    oceanGrid.moveTo(x, 60);
    oceanGrid.lineTo(x + 80, 895);
  }
  for (let y = 74; y < 900; y += 62) {
    oceanGrid.moveTo(58, y);
    oceanGrid.lineTo(984, y - 38);
  }
  stage.addChild(oceanGrid);

  const paper = new Graphics();
  paper.beginFill(0xd8c38d, 0.88);
  paper.drawRoundedRect(42, 42, 960, 850, 18);
  paper.endFill();
  paper.lineStyle(4, 0x111820, 0.76);
  paper.drawRoundedRect(42, 42, 960, 850, 18);
  stage.addChild(paper);

  const sea = new Graphics();
  sea.beginFill(0x7ed1df, 0.42);
  sea.drawEllipse(320, 510, 245, 360);
  sea.drawEllipse(720, 520, 320, 350);
  sea.endFill();
  sea.lineStyle(1, 0x5f7f82, 0.24);
  for (let y = 120; y < 850; y += 44) {
    sea.moveTo(80, y);
    sea.bezierCurveTo(280, y + 18, 510, y - 18, 940, y + 10);
  }
  stage.addChild(sea);

  drawRegionPatch(stage, [95, 280, 245, 210, 380, 330, 335, 505, 175, 565, 95, 455], 0x62a8dc, 0.42);
  drawRegionPatch(stage, [335, 115, 705, 95, 710, 300, 470, 335, 340, 260], 0x8cc56f, 0.42);
  drawRegionPatch(stage, [330, 345, 610, 300, 690, 540, 510, 650, 340, 540], 0xe5b955, 0.38);
  drawRegionPatch(stage, [680, 300, 890, 320, 900, 680, 720, 690, 675, 520], 0xd75b4b, 0.4);
  drawRegionPatch(stage, [160, 590, 470, 655, 835, 690, 850, 840, 230, 845, 145, 750], 0xd8894e, 0.38);

  addMapLabel(stage, "ATLANTIC", 215, 215, 0x5e503c, 17);
  addMapLabel(stage, "EUROPA", 480, 205, 0x614126, 24);
  addMapLabel(stage, "MEDITERRANEO", 455, 760, 0x5e503c, 16);
  addMapLabel(stage, "OCCIDENTE +3", 225, 500, 0x284f70, 15);
  addMapLabel(stage, "NORTE +2", 585, 115, 0x315b34, 15);
  addMapLabel(stage, "IMPERIAL +4", 535, 520, 0x6f5220, 15);
  addMapLabel(stage, "ORIENTE +3", 805, 480, 0x742d28, 15);
  addMapLabel(stage, "SUR +3", 510, 820, 0x75451f, 15);
  addCompass(stage);
}

function drawConnections(stage: Container, G: EuropaGameState, selectedId: string, targetId: string) {
  const base = new Graphics();
  const highlight = new Graphics();

  for (const territory of Object.values(G.territories)) {
    for (const connection of territory.connections) {
      const other = G.territories[connection];
      if (!other || territory.id > other.id) continue;
      const isSelectedRoute = territory.id === selectedId || other.id === selectedId;
      const isTargetRoute = targetId && ((territory.id === selectedId && other.id === targetId) || (territory.id === targetId && other.id === selectedId));
      const layer = isSelectedRoute || isTargetRoute ? highlight : base;
      layer.lineStyle(isTargetRoute ? 6 : isSelectedRoute ? 4 : 2, isTargetRoute ? 0x7d251d : 0x6a4b2f, isTargetRoute ? 0.9 : isSelectedRoute ? 0.6 : 0.32);
      layer.moveTo(territory.x, territory.y);
      layer.lineTo(other.x, other.y);
    }
  }

  stage.addChild(base);
  stage.addChild(highlight);
}

function drawTerritory(
  stage: Container,
  territory: TerritoryState,
  state: { selected: boolean; targeted: boolean; hovered: boolean; own: boolean; actionable: boolean }
) {
  const color = ownerColors[territory.ownerId ?? "neutral"];
  const terrain = terrainColors[territory.terrain];
  const radius = territory.isCapital ? 34 : 27;
  const pulseSize = state.selected || state.targeted || state.hovered ? 3 : 0;
  const border = state.targeted ? 0x7d251d : state.selected ? 0xffffff : state.hovered ? 0x101010 : state.own ? 0xf3d59c : 0x5f4630;

  const halo = new Graphics();
  halo.beginFill(color, state.selected || state.targeted ? 0.26 : 0.08);
  halo.drawCircle(territory.x, territory.y, radius + 13 + pulseSize);
  halo.endFill();
  stage.addChild(halo);

  if (territory.isCapital) {
    const capitalRing = new Graphics();
    capitalRing.lineStyle(3, 0x6e2b1f, 0.88);
    capitalRing.drawCircle(territory.x, territory.y, radius + 8);
    capitalRing.beginFill(0xffd08a, 0.42);
    capitalRing.drawPolygon([
      territory.x,
      territory.y - radius - 22,
      territory.x + 9,
      territory.y - radius - 13,
      territory.x,
      territory.y - radius - 4,
      territory.x - 9,
      territory.y - radius - 13
    ]);
    capitalRing.endFill();
    stage.addChild(capitalRing);
  }

  const plate = new Graphics();
  plate.lineStyle(1, 0x5b3b23, 0.4);
  plate.beginFill(terrain, 0.78);
  plate.drawCircle(territory.x + 4, territory.y + 5, radius + 5);
  plate.endFill();
  stage.addChild(plate);

  const shadow = new Graphics();
  shadow.beginFill(0x1e130d, 0.34);
  shadow.drawCircle(territory.x + 5, territory.y + 6, radius + 1);
  shadow.endFill();
  stage.addChild(shadow);

  const node = new Graphics();
  node.lineStyle(state.selected || state.targeted || state.hovered ? 5 : 3, border, 0.98);
  node.beginFill(color, territory.ownerId ? 0.9 : 0.62);
  node.drawCircle(territory.x, territory.y, radius);
  node.endFill();
  node.lineStyle(1, 0xffffff, 0.28);
  node.drawCircle(territory.x - 4, territory.y - 5, Math.max(5, radius - 9));
  stage.addChild(node);

  if (state.actionable) {
    const actionRing = new Graphics();
    actionRing.lineStyle(2, state.own ? 0x355c30 : 0x7d251d, 0.48);
    actionRing.drawCircle(territory.x, territory.y, radius + 5);
    stage.addChild(actionRing);
  }

  const troops = new Text(String(territory.troops), new TextStyle({ fill: 0xffffff, fontSize: territory.isCapital ? 22 : 19, fontWeight: "900", stroke: 0x1d120b, strokeThickness: 4 }));
  troops.anchor.set(0.5);
  troops.x = territory.x;
  troops.y = territory.y - 2;
  stage.addChild(troops);

  const label = new Text(territory.name, new TextStyle({ fill: state.selected || state.hovered ? 0x28160e : 0x4d3526, fontSize: territory.isCapital ? 13 : 12, fontWeight: territory.isCapital ? "900" : "800", stroke: 0xf0ddaf, strokeThickness: 3 }));
  label.anchor.set(0.5, 0);
  label.x = territory.x;
  label.y = territory.y + radius + 5;
  stage.addChild(label);
}

function drawEffect(stage: Container, G: EuropaGameState, effect: VisualEffect | null, pulse: number) {
  if (!effect) return;
  const flash = 0.45 + Math.abs(Math.sin(pulse * 1.8)) * 0.45;

  if (effect.fromId && effect.toId) {
    const from = G.territories[effect.fromId];
    const to = G.territories[effect.toId];
    if (!from || !to) return;
    const line = new Graphics();
    line.lineStyle(7, effect.type === "attack" ? 0xa63024 : 0x2f6d8b, flash);
    line.moveTo(from.x, from.y);
    line.lineTo(to.x, to.y);
    line.beginFill(effect.type === "attack" ? 0xa63024 : 0x2f6d8b, flash);
    line.drawCircle(to.x, to.y, 8 + Math.sin(pulse) * 3);
    line.endFill();
    stage.addChild(line);
    return;
  }

  if (effect.territoryId) {
    const territory = G.territories[effect.territoryId];
    if (!territory) return;
    const color = effect.type === "attack" ? 0xa63024 : effect.type === "fortify" ? 0xffd08a : 0x7aa653;
    const ring = new Graphics();
    ring.lineStyle(6, color, flash);
    ring.drawCircle(territory.x, territory.y, 34 + Math.sin(pulse) * 6);
    stage.addChild(ring);
  }
}

function drawRegionPatch(stage: Container, points: number[], color: number, alpha: number) {
  const patch = new Graphics();
  patch.lineStyle(5, 0x111820, 0.42);
  patch.beginFill(color, alpha);
  patch.drawPolygon(points);
  patch.endFill();
  stage.addChild(patch);
}

function addMapLabel(stage: Container, text: string, x: number, y: number, color: number, size: number) {
  const label = new Text(text, new TextStyle({ fill: color, fontSize: size, fontFamily: "Georgia", fontStyle: "italic", fontWeight: "700" }));
  label.anchor.set(0.5);
  label.x = x;
  label.y = y;
  stage.addChild(label);
}

function addCompass(stage: Container) {
  const compass = new Graphics();
  compass.lineStyle(2, 0x6f4d2d, 0.65);
  compass.drawCircle(350, 300, 28);
  compass.moveTo(350, 258);
  compass.lineTo(350, 342);
  compass.moveTo(308, 300);
  compass.lineTo(392, 300);
  compass.beginFill(0xa33b2d, 0.78);
  compass.drawPolygon([350, 265, 359, 300, 350, 292, 341, 300]);
  compass.endFill();
  stage.addChild(compass);
}

function isActionable(phase: Phase, territory: TerritoryState, playerID: string | null) {
  if (!playerID) return false;
  if (phase === "production" || phase === "movement" || phase === "consolidation") {
    return territory.ownerId === playerID;
  }
  return territory.ownerId !== playerID;
}
