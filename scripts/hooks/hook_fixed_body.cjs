// Anchored, EOL-preserving edits that retire the modular KayKit composer for classes whose
// body is a bespoke simpleMMO hero rig (the warrior today): FIXED_BODY_CLASSES in
// player_look_core.ts, consulted by the in-world look, the roster look and the helm toggle.
// Every anchor must match exactly once or the script throws. Re-running is a no-op.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:/Dev/simpleMMO/reference/world-of-claudecraft';
const FILE = 'src/render/characters/player_look_core.ts';
const abs = (p) => path.join(ROOT, p);

function readLines(file) {
  const text = fs.readFileSync(abs(file), 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { eol, lines: text.split(eol) };
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
  const marker = newLines.find((l) => /^\s*(export |if |return | \* A )/.test(l)) ?? newLines.find((l) => l.trim() !== '');
  if (doc.lines.includes(marker)) return console.log(`${file}: present, skipped`);
  const at = onlyIndex(doc.lines, (l) => l === anchor, `${file} anchor "${anchor.trim()}"`);
  doc.lines.splice(at + 1, 0, ...newLines);
  writeLines(file, doc);
  console.log(`${file}: inserted ${newLines.length} line(s) after "${anchor.trim()}"`);
}
function replaceLine(file, from, to) {
  const doc = readLines(file);
  if (doc.lines.includes(to[0] ?? to)) return console.log(`${file}: replaced already, skipped`);
  const at = onlyIndex(doc.lines, (l) => l === from, `${file} line "${from.trim()}"`);
  doc.lines.splice(at, 1, ...(Array.isArray(to) ? to : [to]));
  writeLines(file, doc);
  console.log(`${file}: replaced "${from.trim()}"`);
}

// 1. The set, right after the imports.
insertAfterLine(FILE, "} from './modular';", [
  '',
  '/**',
  ' * Classes whose body is a bespoke fixed rig instead of a composition over the modular',
  ' * KayKit part library: the simpleMMO heroes (the warrior wears hero_warrior_leather.glb,',
  " * VISUALS.player_warrior). A creator-authored look does not apply to them, so every",
  ' * surface in this module keeps their class rig and offers no helm toggle. Grows by one',
  ' * entry as each class receives its hero body.',
  ' */',
  "export const FIXED_BODY_CLASSES: ReadonlySet<PlayerClass> = new Set<PlayerClass>(['warrior']);",
]);

// 2. In-world look: doc line + gate.
insertAfterLine(FILE, ' * armour-set override without this core reading a store.', [
  ' * A FIXED_BODY_CLASSES class is null too: its bespoke body is never composed over.',
]);
insertAfterLine(FILE, "  if (e.kind !== 'player' || !e.modularAppearance) return null;", [
  '  if (FIXED_BODY_CLASSES.has(e.templateId as PlayerClass)) return null;',
]);

// 3. Roster look.
insertAfterLine(FILE, "  if (c.skinCatalog === 'mech') return null;", [
  '  if (FIXED_BODY_CLASSES.has(c.class)) return null;',
]);

// 4. Helm toggle availability.
insertAfterLine(FILE, ' * eye must not be offered at all (issue: "hide helmet does nothing").', [
  ' * A fixed-body class (FIXED_BODY_CLASSES) never composes a kit, so it is false as well.',
]);
replaceLine(FILE, "  return !isMech && slotCovered(fullSet(classArmorSet(cls)), 'head');", [
  '  if (isMech || FIXED_BODY_CLASSES.has(cls)) return false;',
  "  return slotCovered(fullSet(classArmorSet(cls)), 'head');",
]);
