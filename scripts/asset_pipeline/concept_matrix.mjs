// Runs the art-direction concept matrix (lib/concept_matrix.mjs) through gpt-image-2:
// every subject in every fusion style, characters on a transparent background and
// framing-gated (lib/concept_frame.mjs) with the same retry clause as the concept
// lane, scenes opaque. Resumable: a cell whose full-size PNG already exists is
// skipped, so a crashed or interrupted run continues where it stopped.
//
//   node scripts/asset_pipeline/concept_matrix.mjs --out <dir> [--set matrix|regions]
//        [--parallel 3] [--attempts 3] [--only <id substring>] [--dry-run]
//
// --set regions swaps the job list for the region exploration (lib/concept_regions.mjs):
// the nine Solareth places in three views each, all scenes, in the chosen style.
//
// Writes <out>/full/<id>.png (the deliverable; characters keep alpha), a review
// copy <out>/web/<id>.webp, prompts.json (what was asked, per cell), manifest.json
// (what came back: sizes, cost, framing verdict) and run.log.
import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConceptFraming, describeFraming } from './lib/concept_frame.mjs';
import { makeLedger, makeLogger, writeWebCopy } from './lib/concept_ledger.mjs';
import {
  buildMatrix,
  conceptMatrixPrompt,
  STYLES,
  SUBJECTS,
  webSizeFor,
} from './lib/concept_matrix.mjs';
import { buildRegionJobs } from './lib/concept_regions.mjs';
import { priceOpenAiUsage } from './lib/cost.mjs';
import { generateConceptImage, IMAGE_MODEL } from './lib/openai_image.mjs';

const QUALITY = 'high';

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function positiveInt(name, fallback) {
  const n = Number(opt(name, fallback));
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} must be a positive integer`);
  return n;
}

function byId(list, id) {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`no entry ${id}`);
  return hit;
}

/** One character cell: generate, measure, retry with the pull-back clause; every attempt is
 *  kept as <id>_try<N>.png and the first passing one (or the last) becomes <id>.png. */
async function renderCharacter(job, ctx) {
  const subject = byId(SUBJECTS, job.subject);
  const style = byId(STYLES, job.style);
  let usd = 0;
  let last = null;
  for (let attempt = 1; attempt <= ctx.attempts; attempt++) {
    const prompt = conceptMatrixPrompt(subject, style, attempt);
    const tryPath = join(ctx.fullDir, `${job.id}_try${attempt}.png`);
    const { usage } = await generateConceptImage({
      prompt,
      dest: tryPath,
      size: job.size,
      quality: QUALITY,
      background: job.background,
    });
    usd += priceOpenAiUsage(usage) ?? 0;
    const framing = await checkConceptFraming(tryPath);
    last = { attempt, prompt, tryPath, framing };
    await ctx.log(`${job.id} try ${attempt}: ${describeFraming(framing.measure)}`);
    if (framing.ok) break;
    await ctx.log(`${job.id} try ${attempt} FAILED framing: ${framing.problems.join('; ')}`);
  }
  await copyFile(last.tryPath, join(ctx.fullDir, `${job.id}.png`));
  return { usd, attempts: last.attempt, prompt: last.prompt, framing: last.framing };
}

/** One scene cell: a single opaque plate, no framing gate. */
async function renderScene(job, ctx) {
  const { usage } = await generateConceptImage({
    prompt: job.prompt,
    dest: join(ctx.fullDir, `${job.id}.png`),
    size: job.size,
    quality: QUALITY,
    background: job.background,
  });
  return { usd: priceOpenAiUsage(usage) ?? 0, attempts: 1, prompt: job.prompt, framing: null };
}

async function runJob(job, ctx) {
  const result =
    job.kind === 'character' ? await renderCharacter(job, ctx) : await renderScene(job, ctx);
  const webBytes = await writeWebCopy(
    join(ctx.fullDir, `${job.id}.png`),
    join(ctx.webDir, `${job.id}.webp`),
    webSizeFor(job.kind),
  );
  await ctx.prompts.upsert({
    id: job.id,
    kind: job.kind,
    provider: IMAGE_MODEL,
    quality: QUALITY,
    size: job.size,
    background: job.background,
    prompt: result.prompt,
  });
  await ctx.manifest.upsert({
    id: job.id,
    subject: job.subject,
    style: job.style,
    kind: job.kind,
    full: `full/${job.id}.png`,
    web: `web/${job.id}.webp`,
    web_bytes: webBytes,
    usd: +result.usd.toFixed(4),
    attempts: result.attempts,
    framing: result.framing
      ? { ok: result.framing.ok, summary: describeFraming(result.framing.measure) }
      : null,
  });
  return result;
}

/** A fixed-width worker pool over `jobs`; a failing cell is logged and counted, never fatal
 *  to the run, because the other forty-nine cells are still worth having. */
async function runAll(jobs, ctx) {
  const queue = [...jobs];
  const tally = { done: 0, failed: [], usd: 0 };
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const t0 = Date.now();
      try {
        const result = await runJob(job, ctx);
        tally.done += 1;
        tally.usd += result.usd;
        const secs = ((Date.now() - t0) / 1000).toFixed(0);
        await ctx.log(`${job.id} done in ${secs}s, $${result.usd.toFixed(3)}`);
      } catch (err) {
        tally.failed.push(job.id);
        await ctx.log(`${job.id} FAILED: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(ctx.parallel, jobs.length) }, worker));
  return tally;
}

const JOB_SETS = { matrix: buildMatrix, regions: buildRegionJobs };

function selectJobs(set, only) {
  const build = JOB_SETS[set];
  if (!build) throw new Error(`--set must be one of ${Object.keys(JOB_SETS).join(', ')}`);
  const all = build();
  return only ? all.filter((j) => j.id.includes(only)) : all;
}

function printDryRun(jobs) {
  for (const job of jobs) {
    console.log(`\n[${job.id}] ${job.kind} ${job.size} ${job.background}\n${job.prompt}`);
  }
  console.log(`\n${jobs.length} cells; no images requested`);
}

async function main() {
  const out = opt('out', null);
  if (!out) throw new Error('--out <dir> is required');
  const jobs = selectJobs(opt('set', 'matrix'), opt('only', null));
  if (jobs.length === 0) throw new Error('--only matched no cells');
  if (flag('dry-run')) return printDryRun(jobs);
  const outDir = resolve(out);
  const ctx = {
    fullDir: join(outDir, 'full'),
    webDir: join(outDir, 'web'),
    parallel: positiveInt('parallel', 3),
    attempts: positiveInt('attempts', 3),
    log: makeLogger(join(outDir, 'run.log')),
    prompts: makeLedger(join(outDir, 'prompts.json')),
    manifest: makeLedger(join(outDir, 'manifest.json')),
  };
  await mkdir(ctx.fullDir, { recursive: true });
  await mkdir(ctx.webDir, { recursive: true });
  const pending = jobs.filter(
    (j) => !(ctx.manifest.has(j.id) && existsSync(join(ctx.fullDir, `${j.id}.png`))),
  );
  await ctx.log(
    `${IMAGE_MODEL} ${QUALITY}: ${pending.length} of ${jobs.length} cells pending, ` +
      `${ctx.parallel} parallel, ${ctx.attempts} attempts per character`,
  );
  const tally = await runAll(pending, ctx);
  await ctx.log(
    `finished: ${tally.done} rendered, ${tally.failed.length} failed, $${tally.usd.toFixed(2)}` +
      (tally.failed.length ? `; failed: ${tally.failed.join(', ')}` : ''),
  );
  if (tally.failed.length) process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
