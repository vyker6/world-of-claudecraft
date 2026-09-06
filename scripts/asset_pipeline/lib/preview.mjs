// Headless preview renderer: turntable views, per-clip pose frames, and the
// legacy weapon-model preview. Self-bundles preview_entry.js with programmatic
// esbuild (the render_model_stills.mjs pattern, no manual prebundle step) and
// drives headless system Chrome on the swiftshader path (no dev server; GLB
// bytes travel as base64). Frames are deterministic per machine but not across
// GPUs/drivers: consumers gate on existence, never byte-diffs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findBrowserPath } from '../../browser_path_resolve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Virtual origin the headless page is served from (never resolved on the
// network: every request is answered by the interceptor in launchPage).
const PREVIEW_ORIGIN = 'https://asset-pipeline-preview.local';
const BASIS_DIR = resolve(__dirname, '../../../public/basis');
const BASIS_FILES = {
  '/basis/basis_transcoder.js': {
    path: join(BASIS_DIR, 'basis_transcoder.js'),
    type: 'application/javascript',
  },
  '/basis/basis_transcoder.wasm': {
    path: join(BASIS_DIR, 'basis_transcoder.wasm'),
    type: 'application/wasm',
  },
};

let pagePromise = null;

export function moduleImportUrl(path) {
  // An absolute Windows path must form a proper drive URL even when this tool
  // runs on POSIX: pathToFileURL there treats "C:\\repo\\..." as relative and
  // resolves it against cwd with percent-encoded backslashes.
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    return new URL(`file:///${path.replaceAll('\\', '/')}`).href;
  }
  return pathToFileURL(path).href;
}

async function launchPage() {
  const esbuild = await import('esbuild');
  const puppeteer = (await import('puppeteer-core')).default;
  const { BROWSER_PATH } = await import(
    moduleImportUrl(resolve(__dirname, '../../browser_path.mjs'))
  );

  const bundlePath = join(tmpdir(), `asset_pipeline_preview_${process.pid}.js`);
  await esbuild.build({
    entryPoints: [resolve(__dirname, '../preview_entry.js')],
    bundle: true,
    format: 'iife',
    outfile: bundlePath,
    logLevel: 'silent',
    // KTX2Loader resolves its default transcoder URLs against import.meta.url
    // at module scope; an IIFE has none and `new URL(x, undefined)` throws
    // before the entry runs. Pin it to the virtual origin (the loader never
    // fetches these defaults: preview_entry.js sets its own transcoder path).
    define: { 'import.meta.url': JSON.stringify(`${PREVIEW_ORIGIN}/preview_entry.js`) },
  });

  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: [
      '--use-angle=swiftshader',
      '--use-gl=angle',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
      '--enable-webgl',
    ],
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => console.error('[preview page error]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[preview console]', msg.text());
  });
  // Shipped GLBs carry KTX2 textures, and the entry's KTX2Loader fetches its
  // transcoder (js + wasm) from a same-origin path. A setContent page has no
  // origin to fetch from, so the page is served from a virtual origin through
  // request interception: the bundle at "/", the transcoder from public/basis/
  // (the same files the game client and the library viewer serve). Nothing
  // else is reachable; GLB bytes still travel as base64.
  const html = `<!doctype html><html><body><script>${readFileSync(bundlePath, 'utf8')}</script></body></html>`;
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.origin !== PREVIEW_ORIGIN) return void req.abort();
    if (url.pathname === '/') {
      return void req.respond({ status: 200, contentType: 'text/html', body: html });
    }
    // Chrome asks for a favicon on every navigation; an abort logs a console
    // error, an empty 204 is silent.
    if (url.pathname === '/favicon.ico') return void req.respond({ status: 204 });
    const basis = BASIS_FILES[url.pathname];
    if (!basis) return void req.abort();
    req.respond({ status: 200, contentType: basis.type, body: readFileSync(basis.path) });
  });
  await page.goto(`${PREVIEW_ORIGIN}/`);
  await page.waitForFunction('window.__ready === true', { timeout: 30000 });
  return { browser, page };
}

async function withPage(fn) {
  if (!pagePromise) pagePromise = launchPage();
  const { page } = await pagePromise;
  return fn(page);
}

/** Close the shared browser (call once at process end). Never throws: a failed
 *  launch or close must not mask the command's own error in a finally block. */
export async function closePreview() {
  if (!pagePromise) return;
  const p = pagePromise;
  pagePromise = null;
  try {
    const { browser } = await p;
    await browser.close();
  } catch {
    // Launch or close failure: nothing to clean up.
  }
}

function writeDataUrl(dataUrl, dest) {
  const b64 = dataUrl.split(',')[1];
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(b64, 'base64'));
  return dest;
}

/** Render turntable + per-clip previews of a GLB into outDir. Returns paths.
 *  opts.views limits the turntable set (e.g. ['hero']); opts.clips toggles the
 *  per-animation pose frames. */
export async function renderPreviews(glbPath, outDir, { size = 512, views, clips } = {}) {
  const b64 = readFileSync(glbPath).toString('base64');
  const shots = await withPage((page) =>
    page.evaluate((data, opts) => window.renderViews(data, opts), b64, { size, views, clips }),
  );
  return shots.map((s) => writeDataUrl(s.dataUrl, join(outDir, `${s.name}.png`)));
}

/** True when a local headless browser is available for the render steps. */
export function previewBrowserAvailable() {
  return !!findBrowserPath();
}

/** `renderPreviews`, but a graceful no-op when no local browser is installed:
 *  returns `{ files: [], rendered: false }` instead of throwing. The static
 *  library index wants PNG thumbnails, but the web wizard renders GLBs LIVE in
 *  the operator's real browser, so a missing headless Chrome must never fail a
 *  whole generation run. Callers log the skip and fall back to the live viewer. */
export async function renderPreviewsIfPossible(glbPath, outDir, opts = {}) {
  if (!previewBrowserAvailable()) return { files: [], rendered: false };
  return { files: await renderPreviews(glbPath, outDir, opts), rendered: true };
}

/** Render a single hero-view thumbnail of a GLB to `dest`. */
export async function renderThumb(glbPath, dest, { size = 256 } = {}) {
  const b64 = readFileSync(glbPath).toString('base64');
  const shots = await withPage((page) =>
    page.evaluate((data, opts) => window.renderViews(data, opts), b64, {
      size,
      views: ['hero'],
      clips: false,
    }),
  );
  if (!shots.length) throw new Error(`no hero render for ${glbPath}`);
  return writeDataUrl(shots[0].dataUrl, dest);
}

/** Render several models at their in-game heights side by side on a common
 *  ground, for scale review against a reference. entries: [{glbPath, height, label}]. */
export async function renderScaleCompare(entries, dest, { size = 640 } = {}) {
  const payload = entries.map((e) => ({
    b64: readFileSync(e.glbPath).toString('base64'),
    height: e.height,
    label: e.label,
  }));
  const dataUrl = await withPage((page) =>
    page.evaluate((es, opts) => window.renderScaleCompare(es, opts), payload, { size }),
  );
  return writeDataUrl(dataUrl, dest);
}

/** Render a character GLB with an alternate skin atlas applied (the game's
 *  SKINS texture-swap semantics) to `dest`. */
export async function renderSkinThumb(charGlbPath, atlasPngPath, dest, { size = 256 } = {}) {
  const charB64 = readFileSync(charGlbPath).toString('base64');
  const atlasB64 = readFileSync(atlasPngPath).toString('base64');
  const dataUrl = await withPage((page) =>
    page.evaluate((c, a, opts) => window.renderSkin(c, a, opts), charB64, atlasB64, { size }),
  );
  return writeDataUrl(dataUrl, dest);
}

/** The seven class body models (every character a player can be). */
export const CLASS_MODEL_PATHS = [
  'knight',
  'paladin',
  'ranger',
  'rogue',
  'mage',
  'barbarian',
  'druid',
].map((m) => `public/models/chars/players/${m}.glb`);

/** Render the weapon attached to a character rig exactly as the game grips
 *  variant weapons (handslot.r + lift + right-hand flip + maxHeight clamp).
 *  Default character: the knight (player_warrior). opts.attack adds a mid-swing
 *  frame; opts.prefix renames outputs held_<prefix>_*. */
export async function renderHeldPreviews(
  weaponGlbPath,
  outDir,
  { character, lift, maxHeight, attack = true, prefix } = {},
) {
  const charPath =
    character ?? resolve(__dirname, '../../../public/models/chars/players/knight.glb');
  const charB64 = readFileSync(charPath).toString('base64');
  const weaponB64 = readFileSync(weaponGlbPath).toString('base64');
  const shots = await withPage((page) =>
    page.evaluate((c, w, opts) => window.renderHeld(c, w, opts), charB64, weaponB64, {
      lift: lift ?? 0.04,
      maxHeight: maxHeight ?? 2.0,
      attack,
    }),
  );
  return shots.map((s) => {
    const name = prefix ? s.name.replace(/^held_/, `held_${prefix}_`) : s.name;
    return writeDataUrl(s.dataUrl, join(outDir, `${name}.png`));
  });
}

/** Pose-matched handslot calibration between a reference rig and a generated
 *  rig (both posed at the same Idle frame in the browser; see preview_entry).
 *  Returns { r: {quat, errorBeforeDeg}, l: {...} }. */
export async function computeSlotCalibration(refGlbPath, genGlbPath) {
  const refB64 = readFileSync(refGlbPath).toString('base64');
  const genB64 = readFileSync(genGlbPath).toString('base64');
  return withPage((page) =>
    page.evaluate((r, g) => window.computeSlotCalibration(r, g), refB64, genB64),
  );
}

/** Render the weapon held + animated by EVERY class body model (idle grip, side
 *  view, and a mid-attack frame each), proving integration across all
 *  characters rather than just the knight. Returns every file path. */
export async function renderHeldAcross(weaponGlbPath, outDir, { lift, maxHeight } = {}) {
  const files = [];
  for (const charPath of CLASS_MODEL_PATHS) {
    const model = charPath
      .split('/')
      .pop()
      .replace(/\.glb$/, '');
    const abs = resolve(__dirname, '../../..', charPath);
    files.push(
      ...(await renderHeldPreviews(weaponGlbPath, outDir, {
        character: abs,
        lift,
        maxHeight,
        attack: true,
        prefix: model,
      })),
    );
  }
  return files;
}

/** Render the 128px model-preview JPG for a weapon GLB. */
export async function renderWeaponIcon(glbPath, dest) {
  const sharp = (await import('sharp')).default;
  const b64 = readFileSync(glbPath).toString('base64');
  const dataUrl = await withPage((page) => page.evaluate((data) => window.renderIcon(data), b64));
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(buf).resize(128, 128).jpeg({ quality: 84 }).toFile(dest);
  return dest;
}
