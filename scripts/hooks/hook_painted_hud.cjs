// Painted HUD, phase 1: the paintedHud setting and its body class, the option rows, the
// catalog strings with their five non-Latin fills, and the four tests that pin the rows.
// Anchored, EOL-preserving, idempotent (each edit skips when its presence marker exists).
// Every anchor must match exactly once or the script throws. Re-running is a no-op.
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
function insertAfterLine(file, anchor, newLines, presence) {
  const doc = readLines(file);
  if (doc.lines.includes(presence)) return console.log(`${file}: present, skipped`);
  const at = only(doc.lines, (l) => l === anchor, `${file} anchor "${anchor.trim()}"`);
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}

// 1. The stylesheet joins the cascade in the empty `hud` layer, after components.css so a
//    tie against a components rule goes to the layer order, not to source order.
const INDEX_CSS = 'src/styles/index.css';
insertAfterLine(
  INDEX_CSS,
  '@import "./components.css";',
  ['@import "./hud.painted.css" layer(hud);'],
  '@import "./hud.painted.css" layer(hud);',
);

// 2. The setting. settings.all() fills defaults in, and main.ts's boot loop applies every
//    key it returns, so a default of true puts the body class on at boot with no extra code.
const SETTINGS = 'src/game/settings.ts';
insertAfterLine(
  SETTINGS,
  '  hideUnusedActionSlots: { def: false },',
  [
    '  // ON by default: the simpleMMO Painted HUD theme layer (styles/hud.painted.css) over',
    '  // the combat HUD. Off restores the WoC HUD unchanged.',
    '  paintedHud: { def: true },',
  ],
  '  paintedHud: { def: true },',
);

const MAIN = 'src/main.ts';
// The applier goes before the action-bar visibility applier: replace that anchor line with
// the new block plus itself (replaceLine skips when the presence marker already exists).
replaceLine(
  MAIN,
  "    if (key === 'showSecondaryActionBar' || key === 'showThirdActionBar') {",
  [
    "    if (key === 'paintedHud') {",
    '      // The simpleMMO Painted HUD theme layer: a body class the hud.painted.css rules',
    '      // read, plus the width probes the theme positions the level plate and target',
    '      // level from (metrics.ts). Purely presentational.',
    "      const on = settings.set('paintedHud', !!value);",
    "      document.body.classList.toggle('hud-painted', on);",
    "      if (on) armPaintedWidthProbes(document.getElementById('ui'));",
    '      return;',
    '    }',
    "    if (key === 'showSecondaryActionBar' || key === 'showThirdActionBar') {",
  ],
  "    if (key === 'paintedHud') {",
);
// Biome's organizeImports assist sorts this block by specifier, so the import lands at its
// sorted place (./ui/ota_update_overlay < ./ui/painted/metrics < ./ui/perf_metrics_sampler)
// rather than beside the applier it feeds. Anywhere else and `biome check` rewrites it.
insertAfterLine(
  MAIN,
  "import { hideOtaUpdateOverlay, renderOtaUpdateOverlay } from './ui/ota_update_overlay';",
  ["import { armPaintedWidthProbes } from './ui/painted/metrics';"],
  "import { armPaintedWidthProbes } from './ui/painted/metrics';",
);

// 3. The two menus that own the interface toggles: the Frames Settings dropdown draws the
//    row, and the Interface tab's off-menu list makes its reset reach the key.
const UNLOCK = 'src/ui/interface_unlock_menu_core.ts';
insertAfterLine(
  UNLOCK,
  "  ['hideUnusedActionSlots', 'hudChrome.options.hideUnusedActionSlots'],",
  ["  ['paintedHud', 'hudChrome.options.paintedHud'],"],
  "  ['paintedHud', 'hudChrome.options.paintedHud'],",
);
const OPTIONS = 'src/ui/options_window.ts';
insertAfterLine(
  OPTIONS,
  "        'hideUnusedActionSlots',",
  ["        'paintedHud',"],
  "        'paintedHud',",
);

// 4. The English strings. One property per line: Biome collapses nothing here, and the
//    catalog reads as a documented list rather than a packed row.
const CATALOG = 'src/ui/i18n.catalog/hud_chrome.ts';
insertAfterLine(
  CATALOG,
  "    hideUnusedActionSlots: 'Hide Unused Action Slots',",
  [
    '    // Interface panel toggle (ON by default): the simpleMMO Painted HUD theme layer',
    '    // (styles/hud.painted.css) repaints the combat HUD over the same DOM. Off restores',
    "    // the WoC HUD unchanged; nothing about the sim or a slot's behaviour moves either way.",
    "    paintedHud: 'Painted HUD',",
    '    // The word stacked above the level number on the painted player plate. Short by',
    '    // design: the plate is a fixed painted well, so a locale supplies its own casing.',
    "    paintedLevelWord: 'LEVEL',",
  ],
  "    paintedHud: 'Painted HUD',",
);
const FILLS = {
  zh_CN: ['彩绘界面', '等级'],
  zh_TW: ['彩繪介面', '等級'],
  ja_JP: ['ペイントHUD', 'レベル'],
  ko_KR: ['페인티드 HUD', '레벨'],
  ru_RU: ['Рисованный интерфейс', 'УРОВЕНЬ'],
};
for (const [locale, [hud, level]] of Object.entries(FILLS)) {
  const file = `src/ui/i18n.locales/${locale}.ts`;
  const doc = readLines(file);
  if (doc.lines.some((l) => l.startsWith("  'hudChrome.options.paintedHud':"))) {
    console.log(`${file}: present, skipped`);
    continue;
  }
  const at = only(
    doc.lines,
    (l) => l.startsWith("  'hudChrome.options.hideUnusedActionSlots':"),
    `${file} row`,
  );
  doc.lines.splice(
    at + 1,
    0,
    `  'hudChrome.options.paintedHud': '${hud}',`,
    `  'hudChrome.options.paintedLevelWord': '${level}',`,
  );
  writeLines(file, doc);
  console.log(`${file}: filled`);
}

// 5. The three tests that pin the interface option rows gain the new key beside its
//    neighbour, in the same order the menus list them.
for (const file of [
  'tests/options_window.test.ts',
  'tests/interface_unlock_menu_core.test.ts',
  'tests/options_view.test.ts',
]) {
  const doc = readLines(file);
  if (doc.lines.some((l) => l.trim() === "'paintedHud',")) {
    console.log(`${file}: present, skipped`);
    continue;
  }
  const at = only(doc.lines, (l) => l.trim() === "'hideUnusedActionSlots',", `${file} row`);
  const indent = doc.lines[at].slice(0, doc.lines[at].indexOf("'"));
  doc.lines.splice(at + 1, 0, `${indent}'paintedHud',`);
  writeLines(file, doc);
  console.log(`${file}: pinned`);
}

// 6. The fourth pin: a default/persistence test beside its hideUnusedActionSlots neighbour.
//    `  });` is not unique in the file, so the neighbour's closing brace is found as the
//    first one after its unique last assertion.
const SETTINGS_TEST = 'tests/settings.test.ts';
{
  const doc = readLines(SETTINGS_TEST);
  if (doc.lines.some((l) => l === "    expect(a.get('paintedHud')).toBe(true);")) {
    console.log(`${SETTINGS_TEST}: present, skipped`);
  } else {
    const lastAssert = only(
      doc.lines,
      (l) => l === "    expect(b.get('hideUnusedActionSlots')).toBe(true);",
      `${SETTINGS_TEST} neighbour`,
    );
    const close = doc.lines.findIndex((l, i) => i > lastAssert && l === '  });');
    if (close < 0) throw new Error(`${SETTINGS_TEST}: no close after the neighbour test`);
    doc.lines.splice(
      close + 1,
      0,
      '',
      '  // The Painted HUD theme layer ships on: a new player sees the painted HUD, and',
      '  // turning it off has to survive the reload that a theme swap invites.',
      "  it('defaults paintedHud on and persists disabling it across instances', () => {",
      '    const a = new Settings();',
      "    expect(a.get('paintedHud')).toBe(true);",
      "    a.set('paintedHud', false);",
      '    const b = new Settings();',
      "    expect(b.get('paintedHud')).toBe(false);",
      '  });',
    );
    writeLines(SETTINGS_TEST, doc);
    console.log(`${SETTINGS_TEST}: inserted the paintedHud default test`);
  }
}
