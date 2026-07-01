import { useEffect, useRef } from "react";
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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  function handleCanvasPointer(event: PointerEvent<HTMLDivElement>) {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const mapX = (event.clientX - rect.left - 22) / 0.82;
    const mapY = (event.clientY - rect.top - 8) / 0.82;
    const territory = Object.values(G.territories)
      .map((candidate) => ({
        territory: candidate,
        distance: Math.hypot(candidate.x - mapX, candidate.y - mapY)
      }))
      .filter(({ distance }) => distance <= 34)
      .sort((a, b) => a.distance - b.distance)[0]?.territory;

    if (territory) onSelectRef.current(territory.id);
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

    const stage = new Container();
    stage.eventMode = "passive";
    stage.scale.set(0.82);
    stage.x = 22;
    stage.y = 8;
    app.stage.addChild(stage);

    const mapLayer = new Container();
    const effectLayer = new Container();
    mapLayer.eventMode = "passive";
    effectLayer.eventMode = "none";
    stage.addChild(mapLayer);
    stage.addChild(effectLayer);

    let hoveredId = "";
    let pulse = 0;

    const drawMap = () => {
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
            actionable: isActionable(phase, territory, playerID),
            pulse
          },
          onSelectRef.current,
          (id) => {
            hoveredId = id;
            drawMap();
          }
        );
      }
    };

    const drawEffectLayer = () => {
      effectLayer.removeChildren();
      drawEffect(effectLayer, G, effect, pulse);
    };

    const tickEffect = () => {
      pulse += 0.08;
      drawEffectLayer();
    };

    drawMap();
    drawEffectLayer();
    if (effect) app.ticker.add(tickEffect);

    return () => {
      app.ticker.remove(tickEffect);
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, [G, selectedId, targetId, playerID, phase, effect]);

  return <div className="map-frame" ref={hostRef} onPointerDown={handleCanvasPointer} aria-label="Mapa interactivo de Europa" />;
}

function drawBackplate(stage: Container) {
  const paper = new Graphics();
  paper.beginFill(0xd5bd89, 1);
  paper.drawRoundedRect(42, 42, 960, 850, 18);
  paper.endFill();
  paper.lineStyle(4, 0x5a3c24, 0.7);
  paper.drawRoundedRect(42, 42, 960, 850, 18);
  stage.addChild(paper);

  const sea = new Graphics();
  sea.beginFill(0x87aeb8, 0.32);
  sea.drawEllipse(320, 510, 245, 360);
  sea.drawEllipse(720, 520, 320, 350);
  sea.endFill();
  sea.lineStyle(1, 0x5f7f82, 0.24);
  for (let y = 120; y < 850; y += 44) {
    sea.moveTo(80, y);
    sea.bezierCurveTo(280, y + 18, 510, y - 18, 940, y + 10);
  }
  stage.addChild(sea);

  drawRegionPatch(stage, [140, 505, 255, 390, 430, 370, 500, 500, 435, 640, 260, 665], 0xd8c17f, 0.45);
  drawRegionPatch(stage, [440, 275, 690, 170, 830, 340, 760, 585, 560, 605, 445, 485], 0xbecf7c, 0.42);
  drawRegionPatch(stage, [210, 665, 460, 700, 810, 750, 825, 825, 395, 820, 185, 780], 0xdf9b65, 0.38);

  addMapLabel(stage, "ATLANTIC", 215, 215, 0x5e503c, 17);
  addMapLabel(stage, "EUROPA", 480, 205, 0x614126, 24);
  addMapLabel(stage, "MEDITERRANEO", 455, 760, 0x5e503c, 16);
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
  state: { selected: boolean; targeted: boolean; hovered: boolean; own: boolean; actionable: boolean; pulse: number },
  onSelect: (id: string) => void,
  onHover: (id: string) => void
) {
  const color = ownerColors[territory.ownerId ?? "neutral"];
  const terrain = terrainColors[territory.terrain];
  const radius = territory.isCapital ? 27 : 21;
  const pulseSize = (state.selected || state.targeted || state.hovered) ? Math.sin(state.pulse) * 2.5 : 0;
  const border = state.targeted ? 0x7d251d : state.selected ? 0xffffff : state.hovered ? 0xffd08a : state.own ? 0xf3d59c : 0x5f4630;

  const halo = new Graphics();
  halo.beginFill(color, state.selected || state.targeted ? 0.26 : state.hovered ? 0.2 : 0.08);
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
  node.lineStyle(state.selected || state.targeted || state.hovered ? 4 : 2, border, 0.98);
  node.beginFill(color, territory.ownerId ? 0.9 : 0.62);
  node.drawCircle(territory.x, territory.y, radius);
  node.endFill();
  node.lineStyle(1, 0xffffff, 0.28);
  node.drawCircle(territory.x - 4, territory.y - 5, Math.max(5, radius - 9));
  node.eventMode = "static";
  node.cursor = "pointer";
  node.on("pointerdown", () => onSelect(territory.id));
  node.on("pointerover", () => onHover(territory.id));
  node.on("pointerout", () => onHover(""));
  stage.addChild(node);

  if (state.actionable) {
    const actionRing = new Graphics();
    actionRing.lineStyle(2, state.own ? 0x355c30 : 0x7d251d, 0.48);
    actionRing.drawCircle(territory.x, territory.y, radius + 5);
    stage.addChild(actionRing);
  }

  const troops = new Text(String(territory.troops), new TextStyle({ fill: 0xffffff, fontSize: 17, fontWeight: "800", stroke: 0x1d120b, strokeThickness: 3 }));
  troops.anchor.set(0.5);
  troops.x = territory.x;
  troops.y = territory.y - 2;
  stage.addChild(troops);

  const label = new Text(territory.name, new TextStyle({ fill: state.hovered || state.selected ? 0x3b2115 : 0x4d3526, fontSize: territory.isCapital ? 12 : 11, fontWeight: territory.isCapital ? "800" : "700", stroke: 0xf0ddaf, strokeThickness: 2 }));
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
  patch.lineStyle(2, 0x6b4a2d, 0.24);
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
