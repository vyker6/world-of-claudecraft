// Look-dev duel renderer (the HD-2D fusion harness): render two lane creatures
// trading blows, each alone on a transparent canvas with its root at the world
// origin, plus a timeline.json the compositor (scripts/battle3d.py) places them
// by, in world units. Every number comes from measuring the skinned meshes in
// the browser entry (render_char_entry.js); the schedule itself is the pure
// builder in lib/duel_timeline.mjs.
//
//   node scripts/render_char.mjs [--hero models/creatures/reaver.glb] [--hero-height 2.5]
//     [--hero-attack-scale 5] [--enemy models/creatures/gilded_penitent.glb]
//     [--enemy-height 2.6] [--enemy-attack-scale 4] [--fps 14] [--out tmp/duel]
//
// GLB paths are relative to public/. The defaults mirror the mob_reaver and
// mob_gilded_penitent VisualDefs in src/render/characters/manifest.ts (height,
// attackTimeScale). Tripo rigs are authored facing +X, so both take the same
// modelYaw the manifest wires as `yaw: -Math.PI / 2`; on top of that the hero
// faces +X (screen right) and the enemy -X.
//
// Output: <out>/hero/f%04d.png and <out>/enemy/f%04d.png (960x1280 RGBA, one
// per timeline frame) plus <out>/timeline.json: the buildDuel result with, per
// fighter, the camera framing (`view`: width, height, groundPx = the canvas
// row of world y=0, pxPerUnit) and the measured per-clip boxes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as esbuild from 'esbuild';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { buildDuel } from './lib/duel_timeline.mjs';

const MODEL_YAW = -90;
const MEASURE_HZ = 60;
const CLIPS = ['Idle', 'Attack', 'Hit'];
const SIDES = {
  hero: { dir: 1, yaw: 90 },
  enemy: { dir: -1, yaw: -90 },
};

function readArgs() {
  const { values } = parseArgs({
    options: {
      hero: { type: 'string', default: 'models/creatures/reaver.glb' },
      'hero-height': { type: 'string', default: '2.5' },
      'hero-attack-scale': { type: 'string', default: '5' },
      enemy: { type: 'string', default: 'models/creatures/gilded_penitent.glb' },
      'enemy-height': { type: 'string', default: '2.6' },
      'enemy-attack-scale': { type: 'string', default: '4' },
      fps: { type: 'string', default: '14' },
      out: { type: 'string', default: 'tmp/duel' },
    },
  });
  const num = (key) => {
    const n = Number(values[key]);
    if (!(n > 0)) throw new Error(`--${key} must be a positive number, got ${values[key]}`);
    return n;
  };
  const spec = (side) => ({
    side,
    ...SIDES[side],
    url: values[side],
    height: num(`${side}-height`),
    attackTimeScale: num(`${side}-attack-scale`),
  });
  return { hero: spec('hero'), enemy: spec('enemy'), fps: num('fps'), out: values.out };
}

// Serves public/ (the GLBs) and an empty page the bundled entry is injected into.
async function serve(root) {
  const server = http.createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!doctype html><html><body></body></html>');
      return;
    }
    try {
      const body = await readFile(path.join(root, 'public', url));
      res.writeHead(200);
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, base: `http://localhost:${server.address().port}` };
}

async function openEntry(root, base) {
  const bundled = await esbuild.build({
    entryPoints: [path.join(root, 'scripts', 'render_char_entry.js')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    write: false,
  });
  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: 'new',
    args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message.slice(0, 300)));
  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  await page.waitForFunction('window.__ready===true', { timeout: 20000 });
  return { browser, page };
}

async function setupFighter(page, base, f) {
  const info = await page.evaluate((url, opts) => window.__setup(url, opts), `${base}/${f.url}`, {
    yaw: f.yaw,
    modelYaw: MODEL_YAW,
    height: f.height,
  });
  const durations = Object.fromEntries(info.clips.map((c) => [c.name, c.duration]));
  for (const clip of CLIPS) {
    if (!(durations[clip] > 0)) {
      const have = info.clips.map((c) => c.name).join(', ');
      throw new Error(`${f.url} has no ${clip} clip (found: ${have})`);
    }
  }
  return { durations, bindHeight: info.bindHeight };
}

async function measureFighter(page, base, f) {
  const { durations, bindHeight } = await setupFighter(page, base, f);
  const measures = {};
  const boxes = {};
  for (const clip of CLIPS) {
    const m = await page.evaluate((c, hz) => window.__measure(c, hz), clip, MEASURE_HZ);
    measures[clip] = { times: m.times, reach: m.reach, reachY: m.reachY };
    boxes[clip] = m.box;
  }
  const clipList = CLIPS.map((c) => `${c} ${durations[c].toFixed(2)}s`).join(', ');
  console.log(`${f.side}: ${f.url}, bind height ${bindHeight.toFixed(3)} scaled to ${f.height}`);
  console.log(`  clips: ${clipList}`);
  return {
    input: {
      name: path.basename(f.url, '.glb'),
      dir: f.dir,
      height: f.height,
      attackTimeScale: f.attackTimeScale,
      clips: { Idle: durations.Idle, Attack: durations.Attack, Hit: durations.Hit },
      measures: { Idle: measures.Idle, Attack: measures.Attack },
    },
    boxes,
  };
}

function unionBox(boxes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], b.min[i]);
      max[i] = Math.max(max[i], b.max[i]);
    }
  }
  return { min, max };
}

// Frames the camera on everything the fighter does across its three clips, then
// plays its timeline and saves one PNG per frame.
async function renderFighter(page, base, f, plan, outDir) {
  await setupFighter(page, base, f);
  const box = unionBox(Object.values(f.boxes));
  const view = await page.evaluate((b) => window.__frame({ box: b }), box);
  const segments = plan.fighters[f.side].segments;
  await page.evaluate((t) => window.__timeline(t), { fps: plan.fps, segments });
  mkdirSync(outDir, { recursive: true });
  for (let i = 0; i < plan.frames; i++) {
    const png = await page.evaluate(() => {
      const data = window.__png();
      window.__tick();
      return data;
    });
    const file = path.join(outDir, `f${String(i).padStart(4, '0')}.png`);
    writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
  }
  return view;
}

function report(plan) {
  const loop = (plan.frames / plan.fps).toFixed(2);
  console.log(
    `gap ${plan.gap.toFixed(3)} units, ${plan.frames} frames at ${plan.fps} fps (${loop} s)`,
  );
  for (const s of plan.strikes) {
    const at = `x ${s.x.toFixed(2)} y ${s.y.toFixed(2)}`;
    console.log(
      `  ${s.attacker} strikes on frame ${s.frame} at ${at}, ${s.penetration.toFixed(3)} deep`,
    );
    if (!(s.penetration > 0)) console.warn(`  WARNING: the ${s.attacker} strike misses its target`);
  }
}

async function main() {
  const args = readArgs();
  const root = process.cwd();
  const { server, base } = await serve(root);
  const { browser, page } = await openEntry(root, base);
  try {
    const measured = {};
    for (const side of ['hero', 'enemy'])
      measured[side] = await measureFighter(page, base, args[side]);
    const plan = buildDuel({
      fps: args.fps,
      hero: measured.hero.input,
      enemy: measured.enemy.input,
    });
    report(plan);
    for (const side of ['hero', 'enemy']) {
      const f = { ...args[side], boxes: measured[side].boxes };
      const view = await renderFighter(page, base, f, plan, path.join(args.out, side));
      plan.fighters[side] = {
        ...plan.fighters[side],
        url: f.url,
        height: f.height,
        view,
        boxes: f.boxes,
      };
    }
    writeFileSync(path.join(args.out, 'timeline.json'), JSON.stringify(plan, null, 2));
    console.log(`wrote ${plan.frames} frames per fighter and timeline.json to ${args.out}`);
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
