import type { TerritoryDefinition } from "./types";

export const territoryDefinitions: TerritoryDefinition[] = [
  { id: "iberia", name: "Iberia", x: 160, y: 520, terrain: "mountain", resources: 3, isCapital: true, startingOwner: "0", connections: ["france", "morocco", "western-med"] },
  { id: "france", name: "Francia", x: 270, y: 420, terrain: "plains", resources: 4, isCapital: true, startingOwner: "0", connections: ["iberia", "britain", "benelux", "germany", "italy"] },
  { id: "britain", name: "Britania", x: 240, y: 300, terrain: "coast", resources: 3, isCapital: false, startingOwner: "0", connections: ["ireland", "france", "benelux", "north-sea"] },
  { id: "ireland", name: "Irlanda", x: 150, y: 315, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["britain", "north-sea"] },
  { id: "benelux", name: "Benelux", x: 350, y: 355, terrain: "urban", resources: 3, isCapital: false, startingOwner: null, connections: ["france", "britain", "germany", "north-sea"] },
  { id: "germany", name: "Germania", x: 440, y: 380, terrain: "urban", resources: 5, isCapital: true, startingOwner: null, connections: ["france", "benelux", "denmark", "poland", "alps", "italy"] },
  { id: "denmark", name: "Dinamarca", x: 450, y: 285, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["germany", "scandinavia", "north-sea", "baltic"] },
  { id: "north-sea", name: "Mar del Norte", x: 350, y: 250, terrain: "coast", resources: 1, isCapital: false, startingOwner: null, connections: ["britain", "ireland", "benelux", "denmark", "scandinavia"] },
  { id: "scandinavia", name: "Escandinavia", x: 535, y: 150, terrain: "forest", resources: 3, isCapital: true, startingOwner: null, connections: ["north-sea", "denmark", "baltic", "finland"] },
  { id: "finland", name: "Finlandia", x: 680, y: 170, terrain: "forest", resources: 2, isCapital: false, startingOwner: null, connections: ["scandinavia", "baltic", "russia"] },
  { id: "baltic", name: "Baltico", x: 575, y: 285, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["denmark", "scandinavia", "finland", "poland", "russia"] },
  { id: "poland", name: "Polonia", x: 585, y: 380, terrain: "plains", resources: 4, isCapital: false, startingOwner: null, connections: ["germany", "baltic", "russia", "carpathia", "balkans"] },
  { id: "russia", name: "Rutenia", x: 780, y: 345, terrain: "plains", resources: 5, isCapital: true, startingOwner: "1", connections: ["finland", "baltic", "poland", "ukraine", "caucasus"] },
  { id: "ukraine", name: "Ucrania", x: 715, y: 460, terrain: "plains", resources: 4, isCapital: false, startingOwner: "1", connections: ["russia", "poland", "carpathia", "black-sea", "caucasus"] },
  { id: "carpathia", name: "Carpatia", x: 590, y: 480, terrain: "mountain", resources: 3, isCapital: false, startingOwner: null, connections: ["poland", "ukraine", "balkans", "alps"] },
  { id: "alps", name: "Alpes", x: 455, y: 485, terrain: "mountain", resources: 3, isCapital: false, startingOwner: null, connections: ["germany", "france", "italy", "balkans", "carpathia"] },
  { id: "italy", name: "Italia", x: 435, y: 590, terrain: "urban", resources: 4, isCapital: true, startingOwner: null, connections: ["france", "germany", "alps", "balkans", "central-med"] },
  { id: "balkans", name: "Balcanes", x: 560, y: 585, terrain: "mountain", resources: 3, isCapital: false, startingOwner: null, connections: ["italy", "alps", "carpathia", "poland", "greece", "black-sea"] },
  { id: "greece", name: "Grecia", x: 600, y: 695, terrain: "coast", resources: 3, isCapital: false, startingOwner: null, connections: ["balkans", "anatolia", "central-med", "eastern-med"] },
  { id: "anatolia", name: "Anatolia", x: 760, y: 660, terrain: "mountain", resources: 4, isCapital: true, startingOwner: "1", connections: ["greece", "black-sea", "caucasus", "eastern-med"] },
  { id: "black-sea", name: "Mar Negro", x: 730, y: 570, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["ukraine", "balkans", "anatolia", "caucasus"] },
  { id: "caucasus", name: "Caucaso", x: 865, y: 555, terrain: "mountain", resources: 3, isCapital: false, startingOwner: "1", connections: ["russia", "ukraine", "black-sea", "anatolia"] },
  { id: "western-med", name: "Mediterraneo Oeste", x: 260, y: 655, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["iberia", "morocco", "central-med"] },
  { id: "central-med", name: "Mediterraneo Central", x: 450, y: 700, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["western-med", "italy", "greece", "eastern-med", "tunisia"] },
  { id: "eastern-med", name: "Mediterraneo Este", x: 690, y: 745, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["central-med", "greece", "anatolia", "levant"] },
  { id: "morocco", name: "Magreb", x: 195, y: 760, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["iberia", "western-med", "tunisia"] },
  { id: "tunisia", name: "Ifriqiya", x: 390, y: 805, terrain: "coast", resources: 2, isCapital: false, startingOwner: null, connections: ["morocco", "central-med", "levant"] },
  { id: "levant", name: "Levante", x: 805, y: 805, terrain: "coast", resources: 3, isCapital: false, startingOwner: null, connections: ["eastern-med", "tunisia"] }
];

export const territoryById = Object.fromEntries(territoryDefinitions.map((territory) => [territory.id, territory]));

export const CAPITALS_TO_WIN = 3;
