// Anchored, EOL-preserving edits that register the nine Ninebend props (scripts/asset_pipeline
// prop lane, kit 'ninebend') in the render prop registry and lay the weir town out in
// NINEBEND_PROPS.decorProps. Every anchor must match exactly once or the script throws.
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
function insertAfterLine(file, anchor, newLines, presenceMarker) {
  const doc = readLines(file);
  if (doc.lines.includes(presenceMarker)) return console.log(`${file}: present, skipped`);
  const at = only(doc.lines, (l) => l === anchor, `${file} anchor "${anchor.trim()}"`);
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}
function replaceBlock(file, openLine, closeLine, newLines, presenceMarker) {
  const doc = readLines(file);
  if (doc.lines.includes(presenceMarker)) return console.log(`${file}: present, skipped`);
  const open = only(doc.lines, (l) => l === openLine, `${file} block "${openLine.trim()}"`);
  const close = doc.lines.findIndex((l, i) => i > open && l === closeLine);
  if (close < 0) throw new Error(`${file}: no "${closeLine}" after "${openLine}"`);
  doc.lines.splice(open, close - open + 1, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: replaced block ${openLine.trim()} ... ${closeLine.trim()}`);
}

// 1. The registry: nine generated props, one kit.
const PROPS = [
  ['ninebendSluiceGate', 'ninebend_sluice_gate'],
  ['ninebendWeirPier', 'ninebend_weir_pier'],
  ['ninebendRiverBarge', 'ninebend_river_barge'],
  ['ninebendStiltHut', 'ninebend_stilt_hut'],
  ['ninebendWatchtower', 'ninebend_watchtower'],
  ['ninebendLanternPost', 'ninebend_lantern_post'],
  ['ninebendShrineStone', 'ninebend_shrine_stone'],
  ['ninebendFishRack', 'ninebend_fish_rack'],
  ['ninebendBannerPole', 'ninebend_banner_pole'],
];
insertAfterLine(
  'src/render/props.ts',
  "  bonfire: { url: '/models/props/bonfire.glb', kit: 'village' },",
  [
    '  // Ninebend, the simpleMMO starting ring: the weir town set, generated through the',
    '  // prop lane in the locked osrs_genshin direction (concept_prop.mjs plates, Tripo,',
    '  // normalize). Placed via NINEBEND_PROPS.decorProps (src/sim/content/ninebend.ts).',
    ...PROPS.map(
      ([key, file]) => `  ${key}: { url: '/models/props/${file}.glb', kit: 'ninebend' },`,
    ),
  ],
  "  ninebendSluiceGate: { url: '/models/props/ninebend_sluice_gate.glb', kit: 'ninebend' },",
);

// 2. The town: on the north bank of the sixth bend around the hub disc (0, -322); the
//    water's edge runs about z -349 at the town crest (x 10). Radii are the measured
//    circumscribed footprints from each job report.
replaceBlock(
  'src/sim/content/ninebend.ts',
  '  decorProps: [',
  '  ],',
  [
    '  decorProps: [',
    '    // The weir: the sluice gate spans the reach below the town, square to the',
    '    // current (the channel runs about 45 degrees here). It rides the waterline.',
    "    { key: 'ninebendSluiceGate', x: 30, z: -379, rot: Math.PI / 4, r: 1.6, h: 3.2, float: 0.3 },",
    '    // The ferry landing: a pier off the town crest, a barge moored beside it.',
    "    { key: 'ninebendWeirPier', x: 14, z: -352, rot: 0, r: 2.2, h: 1.8 },",
    "    { key: 'ninebendRiverBarge', x: 24, z: -362, rot: 0.6, r: 2.8, h: 2.4, float: 0.4 },",
    '    // Three stilt huts ring the hub disc, doors toward the square; the',
    '    // watchtower stands at the west edge with the river in view.',
    "    { key: 'ninebendStiltHut', x: -22, z: -338, rot: 0.5, r: 2.6, h: 5.2 },",
    "    { key: 'ninebendStiltHut', x: 26, z: -332, rot: -0.7, r: 2.6, h: 5.2 },",
    "    { key: 'ninebendStiltHut', x: -12, z: -304, rot: 2.9, r: 2.6, h: 5.2 },",
    "    { key: 'ninebendWatchtower', x: -36, z: -318, rot: 0.8, r: 1.8, h: 8.5 },",
    '    // The shrine stone east of the square, the racks by the water, the',
    '    // banners flanking the Green Gate road where it enters the square.',
    "    { key: 'ninebendShrineStone', x: 38, z: -320, rot: -1.2, r: 0.9, h: 1.9 },",
    "    { key: 'ninebendFishRack', x: -30, z: -348, rot: 0.4, r: 1.3, h: 2.1 },",
    "    { key: 'ninebendFishRack', x: 32, z: -344, rot: -0.3, r: 1.3, h: 2.1 },",
    "    { key: 'ninebendBannerPole', x: -8, z: -302, rot: 0, r: 0.6, h: 6 },",
    "    { key: 'ninebendBannerPole', x: 8, z: -302, rot: 0, r: 0.6, h: 6 },",
    '    // Lantern posts down the Green Gate road and at the landing.',
    "    { key: 'ninebendLanternPost', x: -6, z: -252, rot: 0, r: 0.5, h: 3.4 },",
    "    { key: 'ninebendLanternPost', x: 6, z: -290, rot: 0, r: 0.5, h: 3.4 },",
    "    { key: 'ninebendLanternPost', x: 20, z: -346, rot: 0, r: 0.5, h: 3.4 },",
    "    { key: 'ninebendLanternPost', x: -30, z: -330, rot: 0, r: 0.5, h: 3.4 },",
    '  ],',
  ],
  "    { key: 'ninebendWeirPier', x: 14, z: -352, rot: 0, r: 2.2, h: 1.8 },",
);
