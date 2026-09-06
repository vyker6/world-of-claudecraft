// Anchored, EOL-preserving source edits that register the reaver_axe item in the WoC tree:
// ItemDef, English catalog name, the five M16 non-Latin fills, the weapon-type row, and the
// mapping.json provenance batch. Every anchor must match exactly once or the script throws.
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

const EN_NAME = "Reaver's Bearded Axe";

// 1. ItemDef: the osrs_genshin combat-slice starter axe, same starter stats as rusty_hatchet.
insertAfterBlock('src/sim/content/items.ts', '  rusty_hatchet: {', '  },', [
  '  reaver_axe: {',
  "    id: 'reaver_axe',",
  `    name: "${EN_NAME}",`,
  "    kind: 'weapon',",
  "    slot: 'mainhand',",
  "    quality: 'common',",
  '    weapon: { min: 2, max: 5, speed: 2.2 },',
  '    sellValue: 10,',
  '  },',
]);

// 2. English catalog: appended ids pair an ITEM_ENTITY_IDS entry with an APPENDED_ITEM_NAMES row.
insertAfterLine('src/ui/i18n.catalog/items.ts', "  'wand_of_quenched_sparks',", [
  "  'reaver_axe',",
]);
insertAfterLine(
  'src/ui/i18n.catalog/items.ts',
  "  wand_of_quenched_sparks: 'Wand of Quenched Sparks',",
  [`  reaver_axe: "${EN_NAME}",`],
);

// 3. The five non-Latin fills the M16 rule requires in the same change as a wordy English value.
const FILLS = {
  zh_CN: '掠夺者的胡须斧',
  zh_TW: '掠奪者的鬍鬚斧',
  ja_JP: 'リーヴァーの髭斧',
  ko_KR: '약탈자의 수염 도끼',
  ru_RU: 'Бородатый топор разорителя',
};
for (const [locale, name] of Object.entries(FILLS)) {
  const file = `src/ui/i18n.locales/${locale}.ts`;
  const doc = readLines(file);
  const key = "'entities.items.reaver_axe.name'";
  if (doc.lines.some((l) => l.includes(key))) {
    console.log(`${file}: already filled, skipped`);
    continue;
  }
  const at = onlyIndex(
    doc.lines,
    (l) => l.startsWith("  'entities.items.wand_of_quenched_sparks.name':"),
    `${file} wand anchor`,
  );
  doc.lines.splice(at + 1, 0, `  ${key}: '${name}',`);
  writeLines(file, doc);
  console.log(`${file}: filled ${name}`);
}

// 4. Weapon-type classification (every kind:'weapon' item must classify; axe skins apply).
insertAfterLine('src/sim/content/weapon_skin_rules.ts', "  rusty_hatchet: 'axe',", [
  "  reaver_axe: 'axe',",
]);

// 5. Inventory-art provenance batch (tests/item_icons.test.ts guard F: one owner per icon).
const AXE_PROMPT =
  'a one-handed bearded war axe, the starter weapon of a grim warrior: a single heavy ' +
  'blackened iron axe head with a deep hooked beard and a chipped, notched edge, a short ' +
  'blunt hammer poll on the back, a riveted bronze cheek plate where the head meets the ' +
  'haft, a straight dark hardwood haft about the length of a forearm and a half, the grip ' +
  'wrapped in worn dark leather cord, a small iron cap on the butt end. Total proportions: ' +
  'the head takes about the top quarter of the length';
const mappingFile = 'public/ui/items/mapping.json';
const mappingText = fs.readFileSync(abs(mappingFile), 'utf8');
const mappingEol = mappingText.includes('\r\n') ? '\r\n' : '\n';
const mapping = JSON.parse(mappingText);
const BATCH_ID = 'simplemmo-slice-weapons-2026-09-05';
if (!mapping.generatedBatches.some((b) => b.batchId === BATCH_ID)) {
  mapping.generatedBatches.push({
    batchId: BATCH_ID,
    source:
      'OpenAI gpt-image-2 (scripts/asset_pipeline/lib/openai_image.mjs concept stage, transparent ' +
      'background), composited onto an opaque painted vignette with sharp',
    owner: 'simpleMMO',
    license: 'simpleMMO project-generated art, project asset, rights reserved',
    styleReference:
      'The locked simpleMMO art direction: the osrs_genshin fusion recipe in ' +
      'scripts/asset_pipeline/lib/concept_matrix.mjs (STYLES id osrs_genshin: Old School ' +
      'RuneScape low-poly design language rendered with Genshin Impact cel shading). The icon ' +
      'is the weapon lane concept plate for the reaver_axe held model (job ' +
      'tmp/asset_pipeline/weapon_reaver_axe_v1), turned to the inventory diagonal, so the ' +
      'bag art and the held model share one source drawing.',
    commonPrompt: AXE_PROMPT,
    provenanceRecord: 'tmp/asset_pipeline/weapon_reaver_axe_v1/job.json',
    itemIds: ['reaver_axe'],
  });
  fs.writeFileSync(
    abs(mappingFile),
    JSON.stringify(mapping, null, 2).replace(/\n/g, mappingEol) + mappingEol,
  );
  console.log(`${mappingFile}: appended batch ${BATCH_ID}`);
} else {
  console.log(`${mappingFile}: batch already present, skipped`);
}
