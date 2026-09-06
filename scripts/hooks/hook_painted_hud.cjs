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

// 7. Phase 2: the two HUD hooks. The class chrome (a data attribute plus the measured
//    --pt-* properties) is written once per change of class rather than per frame, and the
//    target plate's grade rides the same rank the elite/boss classes already come from.
const HUD = 'src/ui/hud.ts';
// Biome's organizeImports assist sorts this block by specifier, so both imports land at
// their sorted place (./options_window < ./painted/class_chrome < ./painted/metrics <
// ./painter_host) rather than beside the code they feed. Anywhere else and `biome check`
// rewrites them.
insertAfterLine(
  HUD,
  "import { OptionsWindow } from './options_window';",
  [
    "import { paintedChromeFor, paintedGradeFor } from './painted/class_chrome';",
    "import { applyPaintedMetrics, type PaintedChromeKey } from './painted/metrics';",
  ],
  "import { paintedChromeFor, paintedGradeFor } from './painted/class_chrome';",
);
// The player's class is on the sim config, not on the entity: `sim.player` is an Entity and
// Entity carries no `cls`, while `sim.cfg.playerClass` is what the rest of hud.ts reads.
insertAfterLine(
  HUD,
  '    playerFrame.name = p.name;',
  ['    this.syncPaintedChrome(sim.cfg.playerClass);'],
  '    this.syncPaintedChrome(sim.cfg.playerClass);',
);
insertAfterLine(
  HUD,
  "      this.toggleClass(this.targetFrameEl, 'boss', targetRank === 'boss');",
  [
    '      const grade = paintedGradeFor(targetRank);',
    '      if (this.targetFrameEl.dataset.grade !== grade) this.targetFrameEl.dataset.grade = grade;',
  ],
  '      const grade = paintedGradeFor(targetRank);',
);
// The method goes before toggleClass, so replace that line with the method plus itself.
replaceLine(
  HUD,
  '  private toggleClass(el: HTMLElement, cls: string, on: boolean): void {',
  [
    '  private paintedChrome: PaintedChromeKey | null = null;',
    '  /** The painted class chrome (hud.painted.css): a data attribute the theme picks the bar',
    '   *  painting by, and the measured --pt-* properties for that bar, written once per change',
    '   *  of class rather than per frame. The bar painting is picked off the body because',
    '   *  #bottom-bar precedes #player-frame in index.html. */',
    '  private syncPaintedChrome(cls: PlayerClass): void {',
    '    const key = paintedChromeFor(cls);',
    '    if (key === this.paintedChrome) return;',
    '    this.paintedChrome = key;',
    '    this.playerFrameEl.dataset.chrome = key;',
    '    document.body.dataset.paintedChrome = key;',
    "    const ui = document.getElementById('ui');",
    '    if (ui) applyPaintedMetrics(ui.style, key);',
    "    this.pfLevelEl.dataset.ptWord = t('hudChrome.options.paintedLevelWord');",
    '  }',
    '',
    '  private toggleClass(el: HTMLElement, cls: string, on: boolean): void {',
  ],
  '  private syncPaintedChrome(cls: PlayerClass): void {',
);

// 8. painted_hud.metrics.json is a generated artifact of simpleMMO's export script, not
//    hand-written source: Biome must not reformat it, or the next export churns the diff.
insertAfterLine(
  'biome.json',
  '      "!public",',
  ['      "!src/ui/painted/painted_hud.metrics.json",'],
  '      "!src/ui/painted/painted_hud.metrics.json",',
);

// 9. The drive registry that pins every statement-position call Hud.update() makes. The new
//    syncPaintedChrome call needs its row, in source order: it sits between the player frame
//    name write and the player frame paint. The row goes in by replacing the paint row's own
//    `call` line with the new row plus itself.
replaceLine(
  'tests/hud_update_drive.test.ts',
  "    call: 'this.playerFramePainter.paint',",
  [
    "    call: 'this.syncPaintedChrome',",
    "    band: 'frame',",
    "    gate: '',",
    "    surface: 'chrome',",
    "    why: 'the painted class chrome: the data attributes the theme picks its bar painting by plus the measured --pt-* properties, written only when the class key changes',",
    '  },',
    '  {',
    "    call: 'this.playerFramePainter.paint',",
  ],
  "    call: 'this.syncPaintedChrome',",
);

// 10. The same registry pins the surface split EXACTLY, so the new chrome row costs a
//     number here too. The running narrative above the assertion records each delta.
replaceLine(
  'tests/hud_update_drive.test.ts',
  '    ).toEqual({ window: 46, chrome: 84, none: 17 });',
  [
    '      // chrome 84 -> 85: the Painted HUD class chrome sync (painted/class_chrome.ts',
    '      // and painted/metrics.ts), which writes the data attributes and the --pt-*',
    '      // properties only when the class key changes.',
    '    ).toEqual({ window: 46, chrome: 85, none: 17 });',
  ],
  '    ).toEqual({ window: 46, chrome: 85, none: 17 });',
);

// 11. Boot order: the --pt-* properties have to be on #ui BEFORE any module measures a
//     themed box. syncPaintedChrome is driven from update(), which first runs after the
//     boot sequence, and ChatGeometryController.reapply() (attachStorePromoCard, main.ts)
//     FREEZES #chatlog-wrap's measured rect inline. A theme whose left/width are var()
//     references computes to `auto` until the properties land, so the box it froze was
//     WoC's untethered one and the painted chat column never took effect. Syncing once in
//     the constructor seats the properties first; update()'s own call then elides on the
//     key it just memoized, so this costs one write per boot and nothing per frame.
insertAfterLine(
  'src/ui/hud.ts',
  '    this.chatWindow.init();',
  [
    '    // Seat the Painted HUD chrome BEFORE the chat geometry controller, which measures',
    "    // #chatlog-wrap and freezes the rect inline: the theme's box is var()-derived and",
    '    // reads as `auto` until the --pt-* properties land on #ui.',
    '    this.syncPaintedChrome(this.sim.cfg.playerClass);',
  ],
  '    this.syncPaintedChrome(this.sim.cfg.playerClass);',
);

// 12. The other half of the same boot order: the body class. The apply-all loop below runs
//     applySetting for every key, and its 'uiScale' case calls hud.reapplySavedGeometry(),
//     which measures #chatlog-wrap and pins the rect it finds INLINE for the session.
//     'uiScale' is a numeric range and 'paintedHud' a boolean, so the loop always reaches
//     the freeze first and pinned WoC's untethered box; the painted chat column then never
//     took effect however correct its CSS. Toggling the class before the loop settles it.
//     applySetting('paintedHud') still runs inside the loop and re-toggles idempotently.
insertAfterLine(
  'src/main.ts',
  '  // apply persisted settings to the freshly-built subsystems',
  [
    "  // Before the loop, not inside it: its 'uiScale' case calls hud.reapplySavedGeometry(),",
    '  // which pins #chatlog-wrap at the rect it measures, and the painted chat column is',
    "  // var()-derived - unthemed it reads as WoC's own box and the pin makes that permanent.",
    "  document.body.classList.toggle('hud-painted', settings.get('paintedHud'));",
  ],
  "  document.body.classList.toggle('hud-painted', settings.get('paintedHud'));",
);
