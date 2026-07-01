import type { EventCard } from "./types";

export const eventCards: EventCard[] = [
  { id: "industrial-surge", title: "Impulso industrial", kind: "production", text: "+2 tropas en un territorio propio durante produccion." },
  { id: "rail-depots", title: "Depositos ferroviarios", kind: "production", text: "+2 tropas en un territorio propio durante produccion." },
  { id: "reserve-corps", title: "Cuerpo de reserva", kind: "reinforcement", text: "+3 tropas en un territorio propio." },
  { id: "local-militia", title: "Milicia local", kind: "reinforcement", text: "+2 tropas en un territorio propio." },
  { id: "supply-sabotage", title: "Sabotaje logistico", kind: "sabotage", text: "-1 tropa en un enemigo adyacente." },
  { id: "railway-cut", title: "Corte ferroviario", kind: "sabotage", text: "-1 tropa en un enemigo adyacente." },
  { id: "field-works", title: "Obras de campana", kind: "defense", text: "Fortifica un territorio propio." },
  { id: "citadel-orders", title: "Ordenes de ciudadela", kind: "defense", text: "Fortifica un territorio propio y suma +1 tropa." },
  { id: "supply-crisis", title: "Crisis de suministro", kind: "crisis", text: "-1 tropa en un enemigo adyacente; si es capital, solo queda desfortificado." },
  { id: "political-strike", title: "Huelga politica", kind: "crisis", text: "-1 tropa en un enemigo adyacente." },
  { id: "frontline-rations", title: "Raciones del frente", kind: "reinforcement", text: "+2 tropas en un territorio propio." },
  { id: "factory-shift", title: "Turno de fabrica", kind: "production", text: "+2 tropas en un territorio propio durante produccion." }
];

export const eventCardById = Object.fromEntries(eventCards.map((card) => [card.id, card]));
