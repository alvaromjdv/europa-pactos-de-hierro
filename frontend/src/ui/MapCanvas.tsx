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
  type: "recruit" | "move" | "attack" | "conquer" | "fortify";
  fromId?: string;
  toId?: string;
  territoryId?: string;
  nonce: number;
};

const ownerColors: Record<string, number> = {
  "0": 0x2f8cff,
  "1": 0xe34963,
  "2": 0xffc857,
  "3": 0x58c4a3,
  "4": 0xb78cff,
  "5": 0xf28f3b,
  neutral: 0x334153
};

const terrainColors: Record<TerritoryState["terrain"], number> = {
  plains: 0x44556b,
  mountain: 0x6f7382,
  forest: 0x315f55,
  urban: 0x59657a,
  coast: 0x315d83
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
      backgroundColor: 0x08111f,
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
  const coast = new Graphics();
  coast.beginFill(0x0d2035, 0.5);
  coast.drawRoundedRect(80, 80, 850, 790, 24);
  coast.endFill();
  coast.lineStyle(1, 0x28445f, 0.35);
  coast.drawRoundedRect(80, 80, 850, 790, 24);
  stage.addChild(coast);
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
      layer.lineStyle(isTargetRoute ? 6 : isSelectedRoute ? 4 : 2, isTargetRoute ? 0xffd166 : 0x6aa8d8, isTargetRoute ? 0.95 : isSelectedRoute ? 0.55 : 0.28);
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
  const radius = territory.isCapital ? 25 : 19;
  const pulseSize = (state.selected || state.targeted || state.hovered) ? Math.sin(state.pulse) * 2.5 : 0;
  const border = state.targeted ? 0xffd166 : state.selected ? 0xffffff : state.hovered ? 0x9bdcff : state.own ? 0x9bd2ff : 0x73879f;

  const halo = new Graphics();
  halo.beginFill(color, state.selected || state.targeted ? 0.28 : state.hovered ? 0.22 : 0.1);
  halo.drawCircle(territory.x, territory.y, radius + 13 + pulseSize);
  halo.endFill();
  stage.addChild(halo);

  if (territory.isCapital) {
    const capitalRing = new Graphics();
    capitalRing.lineStyle(3, 0xffd166, 0.88);
    capitalRing.drawCircle(territory.x, territory.y, radius + 8);
    capitalRing.beginFill(0xffd166, 0.16);
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
  plate.lineStyle(1, 0x0b111c, 0.7);
  plate.beginFill(terrain, 0.78);
  plate.drawCircle(territory.x + 3, territory.y + 4, radius + 2);
  plate.endFill();
  stage.addChild(plate);

  const node = new Graphics();
  node.lineStyle(state.selected || state.targeted || state.hovered ? 4 : 2, border, 0.98);
  node.beginFill(color, territory.ownerId ? 0.82 : 0.55);
  node.drawCircle(territory.x, territory.y, radius);
  node.endFill();
  node.eventMode = "static";
  node.cursor = "pointer";
  node.on("pointerdown", () => onSelect(territory.id));
  node.on("pointerover", () => onHover(territory.id));
  node.on("pointerout", () => onHover(""));
  stage.addChild(node);

  if (state.actionable) {
    const actionRing = new Graphics();
    actionRing.lineStyle(1, state.own ? 0x8fd0ff : 0xff9aa9, 0.55);
    actionRing.drawCircle(territory.x, territory.y, radius + 5);
    stage.addChild(actionRing);
  }

  const troops = new Text(String(territory.troops), new TextStyle({ fill: 0xffffff, fontSize: 16, fontWeight: "700" }));
  troops.anchor.set(0.5);
  troops.x = territory.x;
  troops.y = territory.y - 2;
  stage.addChild(troops);

  const label = new Text(territory.name, new TextStyle({ fill: state.hovered || state.selected ? 0xffffff : 0xcbd8e8, fontSize: territory.isCapital ? 12 : 11, fontWeight: territory.isCapital ? "700" : "500" }));
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
    line.lineStyle(7, effect.type === "attack" ? 0xff5d73 : 0x74d6ff, flash);
    line.moveTo(from.x, from.y);
    line.lineTo(to.x, to.y);
    line.beginFill(effect.type === "attack" ? 0xff5d73 : 0x74d6ff, flash);
    line.drawCircle(to.x, to.y, 8 + Math.sin(pulse) * 3);
    line.endFill();
    stage.addChild(line);
    return;
  }

  if (effect.territoryId) {
    const territory = G.territories[effect.territoryId];
    if (!territory) return;
    const color = effect.type === "attack" ? 0xff5d73 : effect.type === "fortify" ? 0xffd166 : 0x70e3a0;
    const ring = new Graphics();
    ring.lineStyle(6, color, flash);
    ring.drawCircle(territory.x, territory.y, 34 + Math.sin(pulse) * 6);
    stage.addChild(ring);
  }
}

function isActionable(phase: Phase, territory: TerritoryState, playerID: string | null) {
  if (!playerID) return false;
  if (phase === "production" || phase === "movement" || phase === "consolidation") {
    return territory.ownerId === playerID;
  }
  return territory.ownerId !== playerID;
}
