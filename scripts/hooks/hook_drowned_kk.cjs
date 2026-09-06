// Anchored, EOL-preserving edits that move the River Drowned onto the hero skeleton (the
// rig-manual build river_drowned_kk: KayKit joint names, the 27 re-baked knight clips) and
// tint the water per biome. Every anchor must match exactly once or the script throws.
// Re-running is a no-op.
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
function only(lines, pred, label) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) if (pred(lines[i], i)) hits.push(i);
  if (hits.length !== 1) throw new Error(`${label}: expected one anchor, found ${hits.length}`);
  return hits[0];
}
function replaceLine(file, from, to, presence) {
  const doc = readLines(file);
  const marker = presence ?? (Array.isArray(to) ? to[0] : to);
  if (doc.lines.includes(marker)) return console.log(`${file}: present, skipped`);
  const at = only(doc.lines, (l) => l === from, `${file} line "${from.trim()}"`);
  doc.lines.splice(at, 1, ...(Array.isArray(to) ? to : [to]));
  writeLines(file, doc);
  console.log(`${file}: replaced "${from.trim()}"`);
}
function removeLine(file, line, scope) {
  const doc = readLines(file);
  let a = 0;
  let b = doc.lines.length;
  if (scope) {
    a = doc.lines.indexOf(scope[0]);
    if (a < 0) throw new Error(`${file}: scope "${scope[0].trim()}" not found`);
    b = doc.lines.findIndex((l, i) => i > a && l === scope[1]);
    if (b < 0) throw new Error(`${file}: scope close "${scope[1].trim()}" not found`);
  }
  const hits = doc.lines
    .map((l, i) => (l === line && i >= a && i <= b ? i : -1))
    .filter((i) => i >= 0);
  if (hits.length === 0) return console.log(`${file}: "${line.trim()}" already gone`);
  if (hits.length > 1) throw new Error(`${file}: "${line.trim()}" found ${hits.length} times`);
  doc.lines.splice(hits[0], 1);
  writeLines(file, doc);
  console.log(`${file}: removed "${line.trim()}"`);
}
function removeBlock(file, openLine, closeLine) {
  const doc = readLines(file);
  const open = doc.lines.indexOf(openLine);
  if (open < 0) return console.log(`${file}: block "${openLine.trim()}" already gone`);
  const close = doc.lines.findIndex((l, i) => i > open && l === closeLine);
  if (close < 0) throw new Error(`${file}: no "${closeLine}" after "${openLine}"`);
  let start = open;
  while (start > 0 && doc.lines[start - 1].startsWith('//')) start--;
  doc.lines.splice(start, close - start + 1);
  if (doc.lines[start] === '' && doc.lines[start - 1] === '') doc.lines.splice(start, 1);
  writeLines(file, doc);
  console.log(`${file}: removed block ${openLine.trim()} ... ${closeLine.trim()}`);
}
function insertAfterLine(file, anchor, newLines, presence) {
  const doc = readLines(file);
  if (doc.lines.includes(presence)) return console.log(`${file}: present, skipped`);
  const at = only(doc.lines, (l) => l === anchor, `${file} anchor "${anchor.trim()}"`);
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}

// 1. The River Drowned rides the hero skeleton: knight clip vocabulary, faces +Z already.
const MANIFEST = 'src/render/characters/manifest.ts';
replaceLine(
  MANIFEST,
  '    clips: CREATURE_LANE,',
  "    clips: kaykit(['Punch_A', '1H_Melee_Attack_Chop']),",
);
removeLine(MANIFEST, '    yaw: -Math.PI / 2,', ['  mob_river_drowned: {', '  },']);
replaceLine(
  MANIFEST,
  '  // River Drowned (src/sim/content/ninebend.ts): the first simpleMMO creature-lane rig',
  [
    '  // River Drowned (src/sim/content/ninebend.ts): the first simpleMMO creature, a Tripo',
    '  // image-to-model body bound onto the hero skeleton by rig-manual (river_drowned_kk),',
    '  // so it shares the KayKit joint names and the knight clip library: bare-handed',
    '  // swings, real hit reactions and a death. The entity tint lets the template',
    '  // colour (waterlogged green) read through the authored albedo.',
  ],
);
removeLine(
  MANIFEST,
  '  // in the locked osrs_genshin direction. Tripo auto-rigs face +X in the file, so the',
);
removeLine(
  MANIFEST,
  '  // quarter turn brings it to the facing-0 (+Z) convention; the entity tint lets the',
);
removeLine(MANIFEST, '  // template colour (waterlogged green) read through the authored albedo.');
removeBlock(MANIFEST, 'const CREATURE_LANE: ClipMap = {', '};');

// 2. Water tinted by the biome the player stands in (the plane is one mesh; the camera is
//    always near the player, and a short lerp hides the crossing).
const WATER = 'src/render/water.ts';
replaceLine(
  WATER,
  "import type { ZoneDef } from '../sim/types';",
  "import type { BiomeId, ZoneDef } from '../sim/types';",
);
insertAfterLine(
  WATER,
  'export const SHALLOW_COLOR = new THREE.Color(0x2d8077);',
  [
    '',
    '// Per-biome water: the plane is one mesh over the whole world, so the tint follows the',
    '// biome the player stands in (the camera is always near them) and lerps across a zone',
    '// crossing. Biomes without a row keep the sea palette above. The marsh runs dark and',
    "// murky: Ninebend's river is black water between reed beds, not a lagoon.",
    'const WATER_PALETTE_BY_BIOME: Partial<Record<BiomeId, { deep: number; shallow: number }>> = {',
    '  marsh: { deep: 0x1a2416, shallow: 0x4f5d2e },',
    '};',
    'const SEA_DEEP = DEEP_COLOR.clone();',
    'const SEA_SHALLOW = SHALLOW_COLOR.clone();',
    'const targetDeep = new THREE.Color();',
    'const targetShallow = new THREE.Color();',
    '/** Ease the shared water colours toward the biome palette; call once per frame. */',
    'export function setWaterBiome(biome: BiomeId, dt: number): void {',
    '  const row = WATER_PALETTE_BY_BIOME[biome];',
    '  if (row) {',
    '    targetDeep.setHex(row.deep);',
    '    targetShallow.setHex(row.shallow);',
    '  } else {',
    '    targetDeep.copy(SEA_DEEP);',
    '    targetShallow.copy(SEA_SHALLOW);',
    '  }',
    '  const k = 1 - Math.exp(-Math.max(0, dt) * 1.5);',
    '  DEEP_COLOR.lerp(targetDeep, k);',
    '  SHALLOW_COLOR.lerp(targetShallow, k);',
    '}',
  ],
  'export function setWaterBiome(biome: BiomeId, dt: number): void {',
);
const RENDERER = 'src/render/renderer.ts';
replaceLine(
  RENDERER,
  "import { buildWater, setWaterDayNight, setWaterSunDirection, type WaterView } from './water';",
  [
    'import {',
    '  buildWater,',
    '  setWaterBiome,',
    '  setWaterDayNight,',
    '  setWaterSunDirection,',
    '  type WaterView,',
    "} from './water';",
  ],
  '  setWaterBiome,',
);
insertAfterLine(
  RENDERER,
  '    sharedUniforms.uCarpetRing.value.set(p.pos.x, p.pos.z, GFX.bladeCarpetRadius);',
  ['    setWaterBiome(zoneBiomeAt(p.pos.x, p.pos.z), dt);'],
  '    setWaterBiome(zoneBiomeAt(p.pos.x, p.pos.z), dt);',
);
