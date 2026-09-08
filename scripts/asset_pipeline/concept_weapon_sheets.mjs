// The three composites of the weapon round, from whatever gated plates exist: a three-shape
// strip per type (the plates side by side with shape id, measured aspect and pairwise
// distances printed under them), a tier strip per type (shape a recoloured through the eight
// tier hexes), and one scale sheet (shape a of every type at the type table's Length beside a
// race body plate at height 1.0, on a common baseline). Pure sharp; no generation.
//
//   node scripts/asset_pipeline/concept_weapon_sheets.mjs --plates tmp/asset_pipeline/weapons
//        --out tmp/asset_pipeline/weapons/sheets --figure <path to a race body plate> [--only <type>]
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { measureFraming } from './lib/concept_frame.mjs';
import { tierStrip } from './lib/concept_recolor.mjs';
import { measureShape, shapeDistance } from './lib/concept_shape.mjs';
import { TIER_LADDER } from './lib/concept_tiers.mjs';
import { tintRulesFor, WEAPON_TYPES, zonesFor } from './lib/concept_weapons.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STYLE = 'osrs_genshin';
const GROUND = { r: 24, g: 22, b: 26, alpha: 1 };
const INK = '#f0eadc';

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const platePath = (dir, type, shape) => join(dir, 'full', `${type.id}__${shape.id}__${STYLE}.png`);

async function cropToBox(path, bbox, height) {
  return sharp(path)
    .extract({
      left: bbox.left,
      top: bbox.top,
      width: bbox.right - bbox.left + 1,
      height: bbox.bottom - bbox.top + 1,
    })
    .resize({ height: Math.max(1, Math.round(height)) })
    .png()
    .toBuffer();
}

// Shared by shapeStrip and scaleSheet: composites the cells and the label SVG onto a GROUND
// canvas and writes dest.
async function paintCanvas(width, height, composites, svg, dest) {
  await sharp({ create: { width, height, channels: 4, background: GROUND } })
    .composite([...composites, { input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(dest);
  return dest;
}

// The type's shape plates that exist and measure to a real silhouette, gathered out of
// shapeStrip to keep its own cyclomatic complexity under the project limit.
async function measuredShapes(type, dir) {
  const rows = [];
  for (const shape of type.shapes) {
    const path = platePath(dir, type, shape);
    if (!existsSync(path)) continue;
    const measure = await measureShape(path);
    if (!measure.bbox) continue;
    rows.push({ id: shape.id, path, measure });
  }
  return rows;
}

async function shapeStrip(type, dir, dest, cell = 384) {
  const rows = await measuredShapes(type, dir);
  if (!rows.length) return null;
  const width = cell * 3;
  const height = cell + 104;
  const composites = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const buf = await sharp(r.path).resize(cell, cell, { fit: 'inside' }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    composites.push({
      input: buf,
      left: i * cell + Math.round((cell - meta.width) / 2),
      top: cell - meta.height,
    });
    svg += `<text x="${i * cell + 8}" y="${cell + 24}" font-family="sans-serif" font-size="18" fill="${INK}">${type.id} ${r.id}</text>`;
    svg += `<text x="${i * cell + 8}" y="${cell + 46}" font-family="sans-serif" font-size="18" fill="${INK}">aspect ${r.measure.aspect.toFixed(2)}</text>`;
  }
  const pairs = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++)
      pairs.push(
        `${rows[i].id} vs ${rows[j].id} ${shapeDistance(rows[i].measure, rows[j].measure).toFixed(3)}`,
      );
  svg += `<text x="8" y="${cell + 80}" font-family="sans-serif" font-size="18" fill="${INK}">distance at icon scale: ${pairs.join('   ')}</text></svg>`;
  return paintCanvas(width, height, composites, svg, dest);
}

async function scaleSheet(types, dir, figurePath, dest, figureH = 900) {
  const fig = await measureFraming(figurePath);
  if (!fig.bbox) throw new Error(`no figure found in ${figurePath}`);
  const cells = [{ label: 'figure 1.00', buf: await cropToBox(figurePath, fig.bbox, figureH) }];
  for (const type of types) {
    const path = platePath(dir, type, type.shapes[0]);
    if (!existsSync(path)) continue;
    const m = await measureShape(path);
    if (!m.bbox) continue;
    cells.push({
      label: `${type.id} ${type.length.toFixed(2)}`,
      buf: await cropToBox(path, m.bbox, figureH * type.length),
    });
  }
  const metas = await Promise.all(cells.map((c) => sharp(c.buf).metadata()));
  const gap = 24;
  const width = metas.reduce((w, m) => w + m.width + gap, gap);
  const height = Math.round(figureH * 1.2) + 80;
  const baseline = Math.round(figureH * 1.2) + 8;
  const composites = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `<line x1="0" y1="${baseline}" x2="${width}" y2="${baseline}" stroke="#7fb8ff" stroke-width="2"/>`;
  let x = gap;
  cells.forEach((c, i) => {
    composites.push({ input: c.buf, left: x, top: baseline - metas[i].height });
    svg += `<text x="${x}" y="${baseline + 40}" font-family="sans-serif" font-size="16" fill="${INK}" transform="rotate(-45 ${x} ${baseline + 40})">${c.label}</text>`;
    x += metas[i].width + gap;
  });
  svg += '</svg>';
  return paintCanvas(width, height, composites, svg, dest);
}

// Split out of main() to keep its cyclomatic complexity under the project limit: the
// three-clause required-args check alone counts as three decision points, which pushed the
// original single function to the boundary once the two loops and the tier existsSync check
// are counted alongside it.
function parseArgs() {
  const plates = opt('plates');
  const out = opt('out');
  const figure = opt('figure');
  if (!plates || !out || !figure) {
    throw new Error('--plates <run dir>, --out <dir> and --figure <race body plate> are required');
  }
  const only = opt('only', '');
  const types = WEAPON_TYPES.filter((t) => !only || t.id.includes(only));
  if (only && !types.length) throw new Error(`--only ${only} matched no weapon type`);
  return { plates, out, figure, only, types };
}

// One type's shape strip and, when a first-shape plate exists, its tier strip.
async function buildTypeSheets(type, dir, outDir) {
  const strip = await shapeStrip(type, dir, join(outDir, 'shapes', `${type.id}.png`));
  console.log(strip ? `shapes/${type.id}.png` : `${type.id}: no plates yet`);
  const a = platePath(dir, type, type.shapes[0]);
  if (!existsSync(a)) return;
  await tierStrip({
    path: a,
    zones: zonesFor(type),
    zone: type.tierZone,
    ladder: TIER_LADDER,
    dest: join(outDir, 'tiers', `${type.id}.png`),
    assign: tintRulesFor(type).assign,
  });
  console.log(`tiers/${type.id}.png`);
}

async function main() {
  const { plates, out, figure, only, types } = parseArgs();
  const dir = resolve(REPO_ROOT, plates);
  const outDir = resolve(REPO_ROOT, out);
  for (const d of ['shapes', 'tiers']) mkdirSync(join(outDir, d), { recursive: true });
  for (const type of types) await buildTypeSheets(type, dir, outDir);
  if (!only) {
    await scaleSheet(
      WEAPON_TYPES,
      dir,
      resolve(REPO_ROOT, figure),
      join(outDir, 'scale_sheet.png'),
    );
    console.log('scale_sheet.png');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
