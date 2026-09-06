// Ninebend (levels 1-5). The simpleMMO starting ring: a weir town on a slow
// marsh river, nine bends of black water between reed beds and rotting piers,
// the first zone built in the locked osrs_genshin art direction. It occupies
// the strip column south of Eastbrook Vale (z -540..-180); the vale's south
// bay is Ninebend's north shore and the Green Gate road climbs out of the
// town toward that border. The river itself is carved by world.ts's
// ninebendRiver applier from NINEBEND_RIVER below.

import type { CampDef, ItemDef, MobTemplate, PortalDef, ZoneDef, ZonePropsDef } from '../types';
import { emptyZoneProps } from '../types';

export const NINEBEND_RECT = { xMin: -180, xMax: 180, zMin: -540, zMax: -180 } as const;

export function isInNinebend(x: number, z: number): boolean {
  return (
    x >= NINEBEND_RECT.xMin &&
    x < NINEBEND_RECT.xMax &&
    z >= NINEBEND_RECT.zMin &&
    z < NINEBEND_RECT.zMax
  );
}

// The Nine Bend River's centreline: nine authored bends, west strait to east
// strait, smoothed into a Catmull-Rom curve so the channel meanders instead of
// zigzagging between the authored points. The town sits on the north bank of
// the sixth bend and the weir spans the reach below it. Half-width is the
// channel at water level; the banks fade out over NINEBEND_RIVER.bank beyond it.
const NINEBEND_RIVER_BENDS = [
  { x: -196, z: -372 },
  { x: -150, z: -345 },
  { x: -110, z: -392 },
  { x: -70, z: -352 },
  { x: -30, z: -398 },
  { x: 10, z: -358 },
  { x: 50, z: -400 },
  { x: 90, z: -352 },
  { x: 130, z: -395 },
  { x: 170, z: -360 },
  { x: 196, z: -372 },
] as const;

function catmullRom(pts: readonly { x: number; z: number }[], perSegment: number) {
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < perSegment; s++) {
      const u = s / perSegment;
      const u2 = u * u;
      const u3 = u2 * u;
      const x =
        0.5 *
        (2 * p1.x +
          (-p0.x + p2.x) * u +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
      const z =
        0.5 *
        (2 * p1.z +
          (-p0.z + p2.z) * u +
          (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 +
          (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3);
      out.push({ x: +x.toFixed(2), z: +z.toFixed(2) });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

export const NINEBEND_RIVER = {
  points: catmullRom(NINEBEND_RIVER_BENDS, 8),
  halfWidth: 9,
  bank: 20,
} as const;

// The band is open sea by default, like every column zone: these lobes raise the
// weir town's flood plain out of it, edge to edge between the column straits and
// from the south rim up to the vale's bay (world.ts ninebendLandness).
export const NINEBEND_LAND_LOBES = [
  { x: -130, z: -470, r: 72 },
  { x: -45, z: -470, r: 72 },
  { x: 45, z: -470, r: 72 },
  { x: 130, z: -470, r: 72 },
  { x: -130, z: -400, r: 72 },
  { x: -45, z: -400, r: 72 },
  { x: 45, z: -400, r: 72 },
  { x: 130, z: -400, r: 72 },
  { x: -130, z: -330, r: 72 },
  { x: -45, z: -330, r: 72 },
  { x: 45, z: -330, r: 72 },
  { x: 130, z: -330, r: 72 },
  { x: -130, z: -260, r: 72 },
  { x: -45, z: -260, r: 72 },
  { x: 45, z: -260, r: 72 },
  { x: 130, z: -260, r: 72 },
] as const;

export const NINEBEND_BAYS = [
  { x: 14, z: -352, r: 10 }, // the ferry landing's pool at the town crest
] as const;

export const NINEBEND_ZONE: ZoneDef = {
  id: 'ninebend',
  name: 'Ninebend',
  ...NINEBEND_RECT,
  levelRange: [1, 5],
  biome: 'marsh',
  hub: { x: 0, z: -322, radius: 14, name: 'Ninebend' },
  graveyard: { x: -24, z: -300 },
  lakes: [],
  pois: [
    { x: 0, z: -322, label: 'Ninebend', id: 'ninebend_town' },
    { x: 30, z: -379, label: 'The Weir', id: 'the_weir' },
    { x: -20, z: -424, label: 'The Drowned Reeds', id: 'the_drowned_reeds' },
    { x: 14, z: -350, label: 'The Ferry Landing', id: 'the_ferry_landing' },
    { x: 0, z: -196, label: 'The Green Gate', id: 'the_green_gate' },
  ],
  welcome:
    'Ninebend keeps the weir, and the weir keeps Ninebend. Mind the reeds after dark: the river ' +
    'gives back what it takes, and it does not give it back kindly.',
  sealedSouthBorder: true,
};

export const NINEBEND_ROADS: { x: number; z: number }[][] = [
  [
    { x: 0, z: -196 },
    { x: 4, z: -240 },
    { x: -2, z: -282 },
    { x: 0, z: -316 },
  ], // the Green Gate road, down to the town
  [
    { x: 2, z: -332 },
    { x: 24, z: -346 },
    { x: 34, z: -364 },
  ], // the town to the weir head
  [
    { x: 0, z: -332 },
    { x: 8, z: -340 },
    { x: 14, z: -348 },
  ], // the town to the ferry landing
];

export const NINEBEND_PORTALS: PortalDef[] = [];

export const NINEBEND_ARRIVAL = { x: 8, z: -330, facing: Math.PI } as const;

// The River Drowned: fishermen the weir pools took and gave back. Slow and
// waterlogged, they hit harder than a bandit of the same level but wear no
// armour worth the name, and they shamble rather than run a player down.
export const NINEBEND_MOBS: Record<string, MobTemplate> = {
  river_drowned: {
    id: 'river_drowned',
    name: 'River Drowned',
    minLevel: 3,
    maxLevel: 5,
    family: 'undead',
    hpBase: 44,
    hpPerLevel: 18,
    dmgBase: 6,
    dmgPerLevel: 2.0,
    attackSpeed: 2.4,
    armorPerLevel: 12,
    moveSpeed: 6,
    aggroRadius: 11,
    loot: [
      { copper: 22, chance: 1 },
      { itemId: 'linen_scrap', chance: 0.3 },
    ],
    scale: 1.0,
    color: 0x6f8a6a,
  },
};

export const NINEBEND_ITEMS: Record<string, ItemDef> = {};

// The Drowned keep to the reed beds of the south bank and the pool under the
// weir. Every camp sits on dry bank: a camp spawns AT its centre and the
// river carve gates itself off camp ground the way the fen braids do.
export const NINEBEND_CAMPS: CampDef[] = [
  { mobId: 'river_drowned', center: { x: 58, z: -420 }, radius: 5, count: 3, offStream: true },
  { mobId: 'river_drowned', center: { x: -60, z: -424 }, radius: 5, count: 2, offStream: true },
  { mobId: 'river_drowned', center: { x: 4, z: -430 }, radius: 5, count: 2, offStream: true },
  { mobId: 'river_drowned', center: { x: 96, z: -424 }, radius: 5, count: 2, offStream: true },
];

// Reed beds along both banks: two rows per side, one at the waterline and
// one up the bank, so the river reads as reed-fringed from every angle.
function reedBeds(): [number, number][] {
  const out: [number, number][] = [];
  const pts = NINEBEND_RIVER.points;
  const rows = [NINEBEND_RIVER.halfWidth + 10, NINEBEND_RIVER.halfWidth + 17];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const nx = -(b.z - a.z) / len;
    const nz = (b.x - a.x) / len;
    for (let t = 0.2; t < 1; t += 0.3) {
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (x < NINEBEND_RECT.xMin + 6 || x > NINEBEND_RECT.xMax - 6) continue;
      for (const off of rows) {
        out.push([+(x + nx * off).toFixed(1), +(z + nz * off).toFixed(1)]);
        out.push([+(x - nx * off).toFixed(1), +(z - nz * off).toFixed(1)]);
      }
    }
  }
  return out;
}

export const NINEBEND_PROPS: ZonePropsDef = {
  ...emptyZoneProps(),
  marshReeds: reedBeds(),
  campfires: [[-6, -318]],
  decorProps: [
    // The weir: five sluice bays side by side across the reach below the town,
    // square to the current (the channel runs about 45 degrees here); each bay
    // rides the waterline. Measured bay footprint 1.28 x 3.2, so 3.2 apart.
    {
      key: 'ninebendSluiceGate',
      x: 30 - 4.53,
      z: -379 - 4.53,
      rot: Math.PI / 4,
      r: 1.6,
      h: 3.2,
      float: 0.3,
    },
    {
      key: 'ninebendSluiceGate',
      x: 30 - 2.26,
      z: -379 - 2.26,
      rot: Math.PI / 4,
      r: 1.6,
      h: 3.2,
      float: 0.3,
    },
    { key: 'ninebendSluiceGate', x: 30, z: -379, rot: Math.PI / 4, r: 1.6, h: 3.2, float: 0.3 },
    {
      key: 'ninebendSluiceGate',
      x: 30 + 2.26,
      z: -379 + 2.26,
      rot: Math.PI / 4,
      r: 1.6,
      h: 3.2,
      float: 0.3,
    },
    {
      key: 'ninebendSluiceGate',
      x: 30 + 4.53,
      z: -379 + 4.53,
      rot: Math.PI / 4,
      r: 1.6,
      h: 3.2,
      float: 0.3,
    },
    // The ferry landing: the pier off the town crest (scaled up: the lane
    // normalized it to its mooring post, leaving a stub deck), the barge and a
    // rowboat moored beside it at their draft.
    { key: 'ninebendWeirPier', x: 14, z: -352, rot: 0, r: 2.1, h: 4, scale: 2.2 },
    { key: 'ninebendRiverBarge', x: 24, z: -362, rot: 0.6, r: 3.3, h: 2.4, float: 0.4 },
    { key: 'rowboat', x: 6, z: -358, rot: -0.9, r: 1.4, h: 1.2, float: 0.3 },
    // Four stilt huts ring the hub disc just outside its edge, doors toward the
    // square, scaled up a quarter so a house reads as a house beside the
    // 28-yard disc; the watchtower stands at the west edge with the river in view.
    { key: 'ninebendStiltHut', x: -19, z: -334, rot: 0.6, r: 2.6, h: 6.5, scale: 1.25 },
    { key: 'ninebendStiltHut', x: 21, z: -330, rot: -0.6, r: 2.6, h: 6.5, scale: 1.25 },
    { key: 'ninebendStiltHut', x: -14, z: -306, rot: 2.9, r: 2.6, h: 6.5, scale: 1.25 },
    { key: 'ninebendStiltHut', x: 17, z: -305, rot: -2.6, r: 2.6, h: 6.5, scale: 1.25 },
    { key: 'ninebendWatchtower', x: -31, z: -318, rot: 0.8, r: 2.4, h: 8.5 },
    // The shrine stone east of the square, the racks by the water, the banners
    // flanking the Green Gate road where it enters the square, and the working
    // clutter of a river town: barrels and crates against the huts.
    { key: 'ninebendShrineStone', x: 30, z: -318, rot: -1.2, r: 0.7, h: 1.9 },
    { key: 'ninebendFishRack', x: -24, z: -346, rot: 0.4, r: 1.0, h: 2.1, scale: 1.2 },
    { key: 'ninebendFishRack', x: 28, z: -342, rot: -0.3, r: 1.0, h: 2.1, scale: 1.2 },
    { key: 'ninebendBannerPole', x: -8, z: -302, rot: 0, r: 0.6, h: 6 },
    { key: 'ninebendBannerPole', x: 8, z: -302, rot: 0, r: 0.6, h: 6 },
    { key: 'barrel', x: -23, z: -329, rot: 0.3, r: 0.6, h: 1.2 },
    { key: 'barrel', x: -24.4, z: -330.2, rot: 1.1, r: 0.6, h: 1.2 },
    { key: 'barrel', x: 25, z: -334, rot: 0.7, r: 0.6, h: 1.2 },
    { key: 'crateWooden', x: 18, z: -336, rot: 0.4, r: 0.7, h: 1.2 },
    { key: 'crateWooden', x: -18, z: -310, rot: -0.5, r: 0.7, h: 1.2 },
    // Lantern posts down the Green Gate road and at the landing, at the same
    // scale the hub's own streetlamps are placed.
    { key: 'ninebendLanternPost', x: -6, z: -252, rot: 0, r: 0.5, h: 5.4, scale: 1.6 },
    { key: 'ninebendLanternPost', x: 6, z: -290, rot: 0, r: 0.5, h: 5.4, scale: 1.6 },
    { key: 'ninebendLanternPost', x: 18, z: -345, rot: 0, r: 0.5, h: 5.4, scale: 1.6 },
    { key: 'ninebendLanternPost', x: -26, z: -330, rot: 0, r: 0.5, h: 5.4, scale: 1.6 },
  ],
};
