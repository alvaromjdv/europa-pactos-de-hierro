import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { EuropaGameState, TerritoryState } from "@europa/shared";

type MapCanvasProps = {
  G: EuropaGameState;
  selectedId: string;
  targetId: string;
  playerID: string | null;
  onSelect: (id: string) => void;
};

const ownerColors: Record<string, number> = {
  "0": 0x4ea1ff,
  "1": 0xe85d75,
  "2": 0xffc857,
  "3": 0x58c4a3,
  "4": 0xb78cff,
  "5": 0xf28f3b,
  neutral: 0x2b3442
};

export function MapCanvas({ G, selectedId, targetId, playerID, onSelect }: MapCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const app = new Application({
      backgroundColor: 0x08111f,
      antialias: true,
      resizeTo: host
    });
    host.appendChild(app.view as HTMLCanvasElement);

    const stage = new Container();
    stage.scale.set(0.82);
    stage.x = 22;
    stage.y = 8;
    app.stage.addChild(stage);

    const draw = () => {
      stage.removeChildren();
      drawConnections(stage, G);
      for (const territory of Object.values(G.territories)) {
        drawTerritory(stage, territory, territory.id === selectedId, territory.id === targetId, Boolean(playerID && territory.ownerId === playerID), onSelectRef.current);
      }
    };

    draw();
    return () => {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, [G, selectedId, targetId, playerID]);

  return <div className="map-frame" ref={hostRef} aria-label="Mapa interactivo de Europa" />;
}

function drawConnections(stage: Container, G: EuropaGameState) {
  const lines = new Graphics();
  lines.lineStyle(2, 0x37516f, 0.55);

  for (const territory of Object.values(G.territories)) {
    for (const connection of territory.connections) {
      const other = G.territories[connection];
      if (!other || territory.id > other.id) continue;
      lines.moveTo(territory.x, territory.y);
      lines.lineTo(other.x, other.y);
    }
  }

  stage.addChild(lines);
}

function drawTerritory(
  stage: Container,
  territory: TerritoryState,
  selected: boolean,
  targeted: boolean,
  own: boolean,
  onSelect: (id: string) => void
) {
  const color = ownerColors[territory.ownerId ?? "neutral"];
  const radius = territory.isCapital ? 23 : 18;
  const border = targeted ? 0xffd166 : selected ? 0xffffff : own ? 0x9bd2ff : 0x67809f;

  const halo = new Graphics();
  halo.beginFill(color, selected || targeted ? 0.22 : 0.12);
  halo.drawCircle(territory.x, territory.y, radius + 12);
  halo.endFill();
  stage.addChild(halo);

  const node = new Graphics();
  node.lineStyle(selected || targeted ? 4 : 2, border, 0.95);
  node.beginFill(color, territory.ownerId ? 0.82 : 0.55);
  node.drawCircle(territory.x, territory.y, radius);
  node.endFill();
  node.eventMode = "static";
  node.cursor = "pointer";
  node.on("pointertap", () => onSelect(territory.id));
  stage.addChild(node);

  const troops = new Text(String(territory.troops), new TextStyle({ fill: 0xffffff, fontSize: 16, fontWeight: "700" }));
  troops.anchor.set(0.5);
  troops.x = territory.x;
  troops.y = territory.y - 2;
  stage.addChild(troops);

  const label = new Text(territory.name, new TextStyle({ fill: 0xcbd8e8, fontSize: 11, fontWeight: territory.isCapital ? "700" : "500" }));
  label.anchor.set(0.5, 0);
  label.x = territory.x;
  label.y = territory.y + radius + 5;
  stage.addChild(label);
}
