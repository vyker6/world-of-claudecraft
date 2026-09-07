// The race approval sheets: one 1536x1024 opaque plate per race with the male and female
// figures side by side, then a swatch strip of the race's six skin and six hair presets
// composited under it so the presets are judged on the same image as the race.
//
//   node scripts/asset_pipeline/concept_race_sheets.mjs --out tmp/asset_pipeline/races/sheets
//        [--only <id substring>] [--parallel 2] [--dry-run]
//
// Sheets are not framing-gated: the studio backdrop is opaque and the pose is free. Each
// sheet is one generation. Re-running skips cells whose manifest row and PNG both exist.
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { makeLedger, makeLogger, writeWebCopy } from './lib/concept_ledger.mjs';
import { buildRaceSheetJobs, presetsJson, RACES } from './lib/concept_races.mjs';
import { priceOpenAiUsage } from './lib/cost.mjs';
import { hasOpenAi } from './lib/env.mjs';
import { generateConceptImage, IMAGE_MODEL } from './lib/openai_image.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUALITY = 'high';
const WEB = { width: 1152, height: 900 };

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

/** The swatch strip: six skin swatches over six hair swatches, hex labels under each. */
function swatchStripSvg(race, width) {
  const cell = Math.floor(width / 6);
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="160">`;
  svg += `<rect x="0" y="0" width="${width}" height="160" fill="#18161a"/>`;
  race.presets.skin.forEach((hex, i) => {
    svg += `<rect x="${i * cell + 8}" y="12" width="${cell - 16}" height="52" fill="${hex}"/>`;
    svg += `<text x="${i * cell + 12}" y="78" font-family="monospace" font-size="16" fill="#f0eadc">skin ${hex}</text>`;
  });
  race.presets.hair.forEach((hex, i) => {
    svg += `<rect x="${i * cell + 8}" y="88" width="${cell - 16}" height="52" fill="${hex}"/>`;
    svg += `<text x="${i * cell + 12}" y="154" font-family="monospace" font-size="16" fill="#f0eadc">hair ${hex}</text>`;
  });
  return `${svg}</svg>`;
}

async function withSwatches(race, fullPath, outPath) {
  const meta = await sharp(fullPath).metadata();
  await sharp(fullPath)
    .extend({ bottom: 160, background: { r: 24, g: 22, b: 26, alpha: 1 } })
    .composite([
      { input: Buffer.from(swatchStripSvg(race, meta.width)), top: meta.height, left: 0 },
    ])
    .png()
    .toFile(outPath);
}

async function renderSheet(job, ctx) {
  const race = RACES.find((r) => r.id === job.race);
  const full = join(ctx.fullDir, `${job.id}.png`);
  const started = Date.now();
  const { usage } = await generateConceptImage({
    prompt: job.prompt,
    dest: full,
    size: job.size,
    quality: QUALITY,
    background: job.background,
  });
  const swatched = join(ctx.fullDir, `${job.id}_swatches.png`);
  await withSwatches(race, full, swatched);
  const web = join(ctx.webDir, `${job.id}.webp`);
  const webBytes = await writeWebCopy(swatched, web, WEB);
  const usd = Math.round(priceOpenAiUsage(usage) * 10000) / 10000;
  await ctx.prompts.upsert({
    id: job.id,
    kind: job.kind,
    provider: IMAGE_MODEL,
    quality: QUALITY,
    size: job.size,
    background: job.background,
    prompt: job.prompt,
  });
  await ctx.manifest.upsert({
    id: job.id,
    subject: job.subject,
    style: job.style,
    kind: job.kind,
    full: `full/${job.id}.png`,
    swatches: `full/${job.id}_swatches.png`,
    web: `web/${job.id}.webp`,
    web_bytes: webBytes,
    usd,
    attempts: 1,
    framing: null,
  });
  ctx.log(`${job.id} done in ${((Date.now() - started) / 1000).toFixed(0)}s, $${usd}`);
  return usd;
}

async function main() {
  const out = opt('out');
  if (!out) throw new Error('--out <dir> is required');
  const only = opt('only', '');
  const parallel = Number(opt('parallel', '2'));
  const jobs = buildRaceSheetJobs().filter((j) => !only || j.id.includes(only));
  if (!jobs.length) throw new Error(`--only ${only} matched no sheet`);
  if (flag('dry-run')) {
    for (const j of jobs) console.log(`${j.id} ${j.size} ${j.background}\n${j.prompt}\n`);
    console.log(`${jobs.length} sheets; no images requested`);
    return;
  }
  if (!hasOpenAi())
    throw new Error('OPENAI_API_KEY is not set (the fork .env or the process environment)');
  const outDir = resolve(REPO_ROOT, out);
  const fullDir = join(outDir, 'full');
  const webDir = join(outDir, 'web');
  for (const d of [fullDir, webDir]) mkdirSync(d, { recursive: true });
  const ctx = {
    fullDir,
    webDir,
    log: makeLogger(join(outDir, 'run.log')),
    manifest: makeLedger(join(outDir, 'manifest.json')),
    prompts: makeLedger(join(outDir, 'prompts.json')),
  };
  await writeFile(join(outDir, 'presets.json'), `${JSON.stringify(presetsJson(), null, 2)}\n`);
  const pending = jobs.filter(
    (j) => !(ctx.manifest.has(j.id) && existsSync(join(fullDir, `${j.id}.png`))),
  );
  ctx.log(
    `${IMAGE_MODEL} ${QUALITY}: ${pending.length} of ${jobs.length} sheets pending, ${parallel} parallel`,
  );
  let total = 0;
  let failed = 0;
  const queue = [...pending];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        // Read `total` after the await: `total += await ...` reads it before, so two
        // workers finishing over one another lose an update and under-report the spend.
        const usd = await renderSheet(job, ctx);
        total += usd;
      } catch (err) {
        failed++;
        ctx.log(`${job.id} FAILED: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  ctx.log(`finished: ${pending.length - failed} rendered, ${failed} failed, $${total.toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
