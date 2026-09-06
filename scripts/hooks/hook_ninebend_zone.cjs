// Anchored, EOL-preserving edits that register the Ninebend zone (src/sim/content/ninebend.ts):
// the data.ts merges, the river terrain applier, the world-entity i18n id and the five M16
// non-Latin fills for its name, welcome and points of interest. Every anchor must match
// exactly once in its scope or the script throws. Re-running is a no-op.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:/Dev/simpleMMO/reference/world-of-claudecraft';
const abs = (p) => path.join(ROOT, p);

function readLines(file) {
  const text = fs.readFileSync(abs(file), 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { eol, lines: text.split(eol) };
}
function writeLines(file, doc) {
  fs.writeFileSync(abs(file), doc.lines.join(doc.eol));
}
function only(lines, pred, label, from = 0, to = lines.length) {
  const hits = [];
  for (let i = from; i < to; i++) if (pred(lines[i], i)) hits.push(i);
  if (hits.length !== 1) throw new Error(`${label}: expected one anchor, found ${hits.length}`);
  return hits[0];
}
/** The first code line of an insertion: the presence check that makes a re-run a no-op. */
function marker(newLines) {
  return newLines.find((l) => /\S/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l)) ?? newLines[0];
}
/** Insert after the line `anchor` whose NEXT line is `next` (the pair pins a repeated line). */
function insertAfterPair(file, anchor, next, newLines) {
  const doc = readLines(file);
  if (doc.lines.includes(marker(newLines))) return console.log(`${file}: present, skipped`);
  const at = only(
    doc.lines,
    (l, i) => l === anchor && doc.lines[i + 1] === next,
    `${file} pair "${anchor.trim()}" + "${next.trim()}"`,
  );
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}
function insertAfterLine(file, anchor, newLines) {
  const doc = readLines(file);
  if (doc.lines.includes(marker(newLines))) return console.log(`${file}: present, skipped`);
  const at = only(doc.lines, (l) => l === anchor, `${file} anchor "${anchor.trim()}"`);
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}
function insertBeforeLine(file, anchor, newLines, startsWith = false) {
  const doc = readLines(file);
  if (doc.lines.includes(marker(newLines))) return console.log(`${file}: present, skipped`);
  const at = only(
    doc.lines,
    (l) => (startsWith ? l.startsWith(anchor) : l === anchor),
    `${file} anchor "${anchor.trim()}"`,
  );
  doc.lines.splice(at, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) before "${anchor.trim()}"`);
}
function replaceLine(file, from, to) {
  const doc = readLines(file);
  const lines = Array.isArray(to) ? to : [to];
  if (doc.lines.includes(marker(lines))) return console.log(`${file}: replaced already, skipped`);
  const at = only(doc.lines, (l) => l === from, `${file} line "${from.trim()}"`);
  doc.lines.splice(at, 1, ...lines);
  writeLines(file, doc);
  console.log(`${file}: replaced "${from.trim()}"`);
}

// 1. data.ts: import everything the zone exports and merge each piece where its siblings are.
const DATA = 'src/sim/data.ts';
replaceLine(DATA, "import { NINEBEND_MOBS } from './content/ninebend';", [
  'import {',
  '  NINEBEND_CAMPS,',
  '  NINEBEND_ITEMS,',
  '  NINEBEND_MOBS,',
  '  NINEBEND_PORTALS,',
  '  NINEBEND_PROPS,',
  '  NINEBEND_ROADS,',
  '  NINEBEND_ZONE,',
  "} from './content/ninebend';",
]);
insertAfterPair(DATA, '  PROVING_SHORE_ITEMS,', '  DUNGEON_KEEPSAKE_ITEMS,', ['  NINEBEND_ITEMS,']);
insertAfterLine(DATA, '  ...PROVING_SHORE_CAMPS,', ['  ...NINEBEND_CAMPS,']);
insertAfterLine(DATA, '  ...PROVING_SHORE_ROADS,', ['  ...NINEBEND_ROADS,']);
insertAfterLine(DATA, '  ...PROVING_SHORE_PORTALS,', ['  ...NINEBEND_PORTALS,']);
insertAfterPair(DATA, '  PROVING_SHORE_PROPS,', ']);', ['  NINEBEND_PROPS,']);
insertAfterPair(DATA, '  PROVING_SHORE_ZONE,', '];', ['  NINEBEND_ZONE,']);

// 2. The river applier: id + bounds, the carve, the dispatch, and a south fade on the vale
//    coast so its old hard edge at z -215 does not print a seam inside the new band.
const IDX = 'src/sim/terrain_region_index.ts';
insertAfterLine(IDX, '  gardenwalkWestPass: 36,', ['  ninebendRiver: 37,']);
{
  const doc = readLines(IDX);
  const boundsLine = '  [bounds(-188, 188, -548, -172)],';
  if (!doc.lines.includes(boundsLine)) {
    const open = only(
      doc.lines,
      (l) => l.startsWith('export const TERRAIN_APPLIER_BOUNDS'),
      'bounds open',
    );
    const close = doc.lines.findIndex((l, i) => i > open && l === '];');
    if (close < 0) throw new Error('bounds close not found');
    doc.lines.splice(
      close,
      0,
      '  // the Nine Bend River: the whole Ninebend band, skirted so the carve fades',
      '  // inside the border before either seam.',
      boundsLine,
    );
    writeLines(IDX, doc);
    console.log(`${IDX}: appended the ninebendRiver bounds`);
  } else console.log(`${IDX}: bounds present, skipped`);
}
const WORLD = 'src/sim/world.ts';
insertBeforeLine(WORLD, "import { VALE_BAYS, VALE_LAND_LOBES } from './content/vale_coast';", [
  "import { NINEBEND_RECT, NINEBEND_RIVER } from './content/ninebend';",
]);
insertBeforeLine(WORLD, "// The Braids: the Willowfen's east water-meadows dissolve into winding", [
  "// The Nine Bend River: Ninebend's river is carved along NINEBEND_RIVER's",
  '// centreline, a channel bed below the waterline inside halfWidth with banks',
  '// that ease out over `bank` yards (about a 0.5 rise/run at the marsh flats,',
  '// so every bank is a walk, never a scramble). Roads never cross it (the weir',
  '// carries the only crossing, as a prop) and camps flatten first and stay dry',
  '// through the same gate the fen braids use; the band edges feather so the',
  '// carve never prints a seam on either border.',
  'function ninebendRiverDistance(x: number, z: number): number {',
  '  const pts = NINEBEND_RIVER.points;',
  '  let best = Number.POSITIVE_INFINITY;',
  '  for (let i = 0; i + 1 < pts.length; i++) {',
  '    const a = pts[i];',
  '    const b = pts[i + 1];',
  '    const abx = b.x - a.x;',
  '    const abz = b.z - a.z;',
  '    const len2 = abx * abx + abz * abz;',
  '    let t = len2 > 0 ? ((x - a.x) * abx + (z - a.z) * abz) / len2 : 0;',
  '    t = Math.max(0, Math.min(1, t));',
  '    const d = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t));',
  '    if (d < best) best = d;',
  '  }',
  '  return best;',
  '}',
  'function applyNinebendRiver(x: number, z: number, h: number): number {',
  '  if (x < NINEBEND_RECT.xMin - 8 || x > NINEBEND_RECT.xMax + 8) return h;',
  '  if (z < NINEBEND_RECT.zMin + 8 || z > NINEBEND_RECT.zMax - 8) return h;',
  '  const { halfWidth, bank } = NINEBEND_RIVER;',
  '  const d = ninebendRiverDistance(x, z);',
  '  if (d > halfWidth + bank) return h;',
  '  let channel = 1 - smoothstep(halfWidth, halfWidth + bank, d);',
  '  channel *=',
  '    smoothstep(NINEBEND_RECT.zMin + 8, NINEBEND_RECT.zMin + 40, z) *',
  '    (1 - smoothstep(NINEBEND_RECT.zMax - 40, NINEBEND_RECT.zMax - 8, z));',
  '  for (const camp of CAMPS) {',
  '    if (camp.center.z < NINEBEND_RECT.zMin || camp.center.z >= NINEBEND_RECT.zMax) continue;',
  '    const dc = Math.hypot(x - camp.center.x, z - camp.center.z);',
  '    channel *= smoothstep(camp.radius * 1.6, camp.radius * 2.4, dc);',
  '  }',
  '  if (channel <= 0) return h;',
  '  const bed = WATER_LEVEL - 2.4;',
  '  return h + (Math.min(h, bed) - h) * channel;',
  '}',
  '',
]);
insertAfterPair(WORLD, '    h = applyProvingMoat(x, z, h);', '  }', [
  '  if (terrainRegionHas(region, TERRAIN_APPLIER.ninebendRiver)) {',
  '    h = applyNinebendRiver(x, z, h);',
  '  }',
]);
replaceLine(
  WORLD,
  '  const w = (1 - smoothstep(178, 190, x)) * (1 - smoothstep(162, 178, z));',
  [
    '  // ...and the south edge fades too, now that Ninebend fills the band below',
    '  // z -180 (the carve used to stop dead at z -215 behind the old world rim).',
    '  const w =',
    '    (1 - smoothstep(178, 190, x)) * (1 - smoothstep(162, 178, z)) * smoothstep(-215, -200, z);',
  ],
);

// 3. World-entity i18n: the zone id (its English name, welcome and poi labels flow from ZONES).
const I18N = 'src/ui/world_entity_i18n.ts';
{
  const doc = readLines(I18N);
  if (!doc.lines.includes("  'ninebend',")) {
    const open = only(doc.lines, (l) => l === 'const ZONE_IDS = [', 'ZONE_IDS open');
    const close = doc.lines.findIndex((l, i) => i > open && l === '] as const;');
    const at = only(doc.lines, (l) => l === "  'proving_shore',", 'proving_shore in ZONE_IDS', open, close);
    doc.lines.splice(
      at + 1,
      0,
      '  // Ninebend, the simpleMMO starting ring (src/sim/content/ninebend.ts).',
      "  'ninebend',",
    );
    writeLines(I18N, doc);
    console.log(`${I18N}: ninebend added to ZONE_IDS`);
  } else console.log(`${I18N}: ZONE_IDS present, skipped`);
}

// 4. M16: the five non-Latin fills for every wordy English value the zone adds.
const FILLS = {
  zh_CN: {
    name: '九曲镇',
    welcome: '九曲镇守着堰，堰也守着九曲镇。天黑后当心芦苇丛：河水会归还它夺走的东西，但归还得并不温柔。',
    pois: ['九曲镇', '堰', '溺者芦苇丛', '渡口', '绿门'],
  },
  zh_TW: {
    name: '九曲鎮',
    welcome: '九曲鎮守著堰，堰也守著九曲鎮。天黑後當心蘆葦叢：河水會歸還它奪走的東西，但歸還得並不溫柔。',
    pois: ['九曲鎮', '堰', '溺者蘆葦叢', '渡口', '綠門'],
  },
  ja_JP: {
    name: 'ナインベンド',
    welcome:
      'ナインベンドは堰を守り、堰はナインベンドを守る。日暮れ後の葦原には気をつけろ。川は奪ったものを返してくるが、優しく返してはくれない。',
    pois: ['ナインベンド', '堰', '溺れ人の葦原', '渡し場', '緑の門'],
  },
  ko_KR: {
    name: '나인벤드',
    welcome:
      '나인벤드는 둑을 지키고, 둑은 나인벤드를 지킨다. 해가 진 뒤 갈대밭을 조심하라. 강은 빼앗은 것을 돌려주지만, 곱게 돌려주지는 않는다.',
    pois: ['나인벤드', '둑', '익사자의 갈대밭', '나루터', '녹색 문'],
  },
  ru_RU: {
    name: 'Найнбенд',
    welcome:
      'Найнбенд хранит плотину, а плотина хранит Найнбенд. Берегись камышей после заката: река возвращает то, что забрала, но возвращает недобро.',
    pois: ['Найнбенд', 'Плотина', 'Камыши утопленников', 'Паромная пристань', 'Зелёные ворота'],
  },
};
for (const [locale, f] of Object.entries(FILLS)) {
  const file = `src/ui/i18n.locales/${locale}.ts`;
  const lines = [
    `  'entities.zones.ninebend.name': '${f.name}',`,
    `  'entities.zones.ninebend.welcome': '${f.welcome}',`,
    ...f.pois.map((label, i) => `  'entities.zones.ninebend.pois.${i}.label': '${label}',`),
  ];
  insertBeforeLine(file, "  'entities.zones.proving_shore.welcome':", lines, true);
}
