// Anchored, EOL-preserving edits that give Ninebend the content every shipped zone carries
// (the tests that pin the world enumerate these): gather nodes of all three types, the
// node material rows, the fishing rod tier, the guide's world-page teaser (stem, copy and
// the five M16 fills). Every anchor must match exactly once or the script throws.
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
function marker(newLines) {
  return newLines.find((l) => /\S/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l)) ?? newLines[0];
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
/** Insert before the LAST line equal to `anchor` (a file's closing bracket). */
function insertBeforeLast(file, anchor, newLines) {
  const doc = readLines(file);
  if (doc.lines.includes(marker(newLines))) return console.log(`${file}: present, skipped`);
  const at = doc.lines.lastIndexOf(anchor);
  if (at < 0) throw new Error(`${file}: no "${anchor}" line`);
  doc.lines.splice(at, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) before the last "${anchor.trim()}"`);
}

// 1. Gather nodes: six of every type, on dry flats away from the river, the bay, the straits
//    and the roads (tests/gather_node_placement.test.ts holds every node to dry land with no
//    water in reach). Level snapshots the zone's band like every other zone's rows.
const NODES = {
  ore: [
    [-150, -300],
    [-120, -262],
    [140, -300],
    [120, -262],
    [-140, -478],
    [148, -470],
  ],
  wood: [
    [-90, -250],
    [-40, -472],
    [60, -250],
    [90, -478],
    [-150, -440],
    [150, -440],
  ],
  herb: [
    [-70, -300],
    [70, -300],
    [-100, -470],
    [100, -462],
    [-32, -258],
    [40, -262],
  ],
};
const nodeLines = [];
for (const [type, spots] of Object.entries(NODES)) {
  spots.forEach(([x, z], i) => {
    nodeLines.push(
      '  {',
      `    id: '${type}_ninebend_${i + 1}',`,
      "    zoneId: 'ninebend',",
      `    type: '${type}',`,
      `    pos: { x: ${x}, z: ${z} },`,
      '    level: 3,',
      '    tier: 1,',
      '  },',
    );
  });
}
insertBeforeLast('src/sim/content/gather_nodes.ts', '];', [
  '  // Ninebend (src/sim/content/ninebend.ts): the simpleMMO starting ring, a level',
  '  // 1-5 weir town, so every row takes the starting tier. The rows keep to the',
  '  // dry flats north and south of the river, clear of the bay, the straits and',
  '  // the Green Gate road.',
  ...nodeLines,
]);

// 2. Node materials: the starting tier, the same rows the vale ships.
const MATS = 'src/sim/professions/gathering_materials.ts';
for (const [type, itemId] of [
  ['ore', 'copper_ore'],
  ['wood', 'ironbark_log'],
  ['herb', 'silverleaf_herb'],
]) {
  insertAfterLine(MATS, `    eastbrook_vale: { itemId: '${itemId}', qtyByRarity: MATERIAL_QTY_BY_RARITY },`, [
    `    ninebend: { itemId: '${itemId}', qtyByRarity: MATERIAL_QTY_BY_RARITY },`,
  ]);
}
void 'wood';

// 3. Fishing: a river town fishes at the first rod tier.
insertAfterLine('src/sim/professions/fishing_zones.ts', '  farshore_isle: 1,', ['  ninebend: 1,']);

// 4. The guide's world page: Ninebend renders in the marsh biome (the Mirefen's stem), so it
//    takes its own stem, its own copy, and the five fills its wordy blurb needs (M16).
insertAfterLine('src/guide/data.ts', "  proving_shore: 'proving',", [
  '  // Ninebend renders in the marsh biome, which the Mirefen already speaks for.',
  "  ninebend: 'ninebend',",
]);
insertAfterLine(
  'src/ui/i18n.catalog/guide.ts',
  "        'A quiet training island across the strait, where new adventurers find their feet before the vale asks anything of them.',",
  [
    '      // Ninebend shares the marsh biome with the Mirefen, so it carries its own',
    '      // slug and copy (the simpleMMO starting ring).',
    "      ninebendName: 'Ninebend',",
    '      ninebendBlurb:',
    "        'A weir town on the Nine Bend River, where the sluices close at night and the reeds give back what the water took.',",
  ],
);
const FILLS = {
  zh_CN: ['九曲镇', '九曲河畔的堰镇：水闸夜里会自行关上，芦苇丛会把河水夺走的东西还回来。'],
  zh_TW: ['九曲鎮', '九曲河畔的堰鎮：水閘夜裡會自行關上，蘆葦叢會把河水奪走的東西還回來。'],
  ja_JP: ['ナインベンド', '九曲川のほとりの堰の町。夜になると水門がひとりでに閉まり、葦原は川が奪ったものを返してよこす。'],
  ko_KR: ['나인벤드', '아홉 굽이 강가의 둑 마을. 밤이면 수문이 저절로 닫히고, 갈대밭은 강이 앗아간 것을 되돌려 준다.'],
  ru_RU: ['Найнбенд', 'Городок у плотины на Реке Девяти Излучин: по ночам шлюзы закрываются сами, а камыши возвращают то, что забрала вода.'],
};
for (const [locale, [name, blurb]] of Object.entries(FILLS)) {
  insertBeforeLine(
    `src/ui/i18n.locales/${locale}.ts`,
    "  'guide.home.world.provingName':",
    [
      `  'guide.home.world.ninebendName': '${name}',`,
      `  'guide.home.world.ninebendBlurb': '${blurb}',`,
    ],
    true,
  );
}
