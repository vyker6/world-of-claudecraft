// Anchored, EOL-preserving source edits that wire the River Drowned (the first Ninebend
// resident, src/sim/content/ninebend.ts) into the WoC tree: the MOBS merge, the render
// VisualDef and MOB_KEYS route, the world-entity i18n id, and the five M16 non-Latin name
// fills. Every anchor must match exactly once or the script throws. Re-running is a no-op.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:/Dev/simpleMMO/reference/world-of-claudecraft';
const abs = (p) => path.join(ROOT, p);

function readLines(file) {
  const text = fs.readFileSync(abs(file), 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  return { eol, lines };
}

function writeLines(file, { eol, lines }) {
  fs.writeFileSync(abs(file), lines.join(eol));
}

function onlyIndex(lines, pred, label) {
  const hits = lines.map((l, i) => (pred(l) ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) throw new Error(`${label}: expected one anchor, found ${hits.length}`);
  return hits[0];
}

function insertAfterLine(file, anchor, newLines) {
  const doc = readLines(file);
  if (doc.lines.some((l) => newLines.includes(l))) {
    console.log(`${file}: already contains the insertion, skipped`);
    return;
  }
  const at = onlyIndex(doc.lines, (l) => l === anchor, `${file} anchor "${anchor}"`);
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}

function insertAfterBlock(file, openLine, closeLine, newLines) {
  const doc = readLines(file);
  if (doc.lines.includes(newLines[0])) {
    console.log(`${file}: already contains the block, skipped`);
    return;
  }
  const open = onlyIndex(doc.lines, (l) => l === openLine, `${file} block "${openLine}"`);
  const close = doc.lines.findIndex((l, i) => i > open && l === closeLine);
  if (close < 0) throw new Error(`${file}: no "${closeLine}" after "${openLine}"`);
  doc.lines.splice(close + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted block after ${openLine.trim()} ... ${closeLine.trim()}`);
}

// 1. Sim: merge the Ninebend residents into MOBS (import sits in sorted position between
//    nightbloom and noticeboards; the spread goes after the last existing zone spread).
insertAfterLine('src/sim/data.ts', "} from './content/nightbloom';", [
  "import { NINEBEND_MOBS } from './content/ninebend';",
]);
insertAfterLine('src/sim/data.ts', '  ...PROVING_SHORE_MOBS,', ['  ...NINEBEND_MOBS,']);

// 2. Render: the VisualDef and the template -> visual route.
insertAfterBlock('src/render/characters/manifest.ts', '  mob_bandit: {', '  },', [
  '  // River Drowned (src/sim/content/ninebend.ts): the first simpleMMO creature-lane rig',
  '  // in the locked osrs_genshin direction. Tripo auto-rigs face +X in the file, so the',
  '  // quarter turn brings it to the facing-0 (+Z) convention; the entity tint lets the',
  '  // template colour (waterlogged green) read through the authored albedo.',
  '  mob_river_drowned: {',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: inserted source text, the placeholder must land verbatim
  '    url: `${CREATURES}/river_drowned.glb`,',
  '    height: 2.5,',
  '    yaw: -Math.PI / 2,',
  '    clips: CREATURE_LANE,',
  "    tint: 'entity',",
  '    tintStrength: 0.35,',
  '  },',
]);
insertAfterLine('src/render/characters/manifest.ts', "  derelict_mech: 'mob_mech',", [
  "  river_drowned: 'mob_river_drowned',",
]);

// 3. World-entity i18n id: the English name flows from MOBS via makeEnglishWorldEntities.
insertAfterLine('src/ui/world_entity_i18n.ts', "  'wildheart_high_priest',", [
  '  // Ninebend, the simpleMMO starting ring (src/sim/content/ninebend.ts).',
  "  'river_drowned',",
]);

// 4. M16: "River Drowned" is a wordy English value, so the five non-Latin fills land in the
//    same change (tests/i18n_completeness.test.ts reds on byte-identical English otherwise).
const FILLS = {
  zh_CN: '河溺亡者',
  zh_TW: '河溺亡者',
  ja_JP: '川の溺死者',
  ko_KR: '강의 익사자',
  ru_RU: 'Речной утопленник',
};
for (const [locale, name] of Object.entries(FILLS)) {
  const file = `src/ui/i18n.locales/${locale}.ts`;
  const doc = readLines(file);
  const key = "'entities.mobs.river_drowned.name'";
  if (doc.lines.some((l) => l.includes(key))) {
    console.log(`${file}: already filled, skipped`);
    continue;
  }
  const at = onlyIndex(
    doc.lines,
    (l) => l.startsWith("  'entities.mobs.wildheart_high_priest.name':"),
    `${file} high priest anchor`,
  );
  doc.lines.splice(at + 1, 0, `  ${key}: '${name}',`);
  writeLines(file, doc);
  console.log(`${file}: filled ${name}`);
}
