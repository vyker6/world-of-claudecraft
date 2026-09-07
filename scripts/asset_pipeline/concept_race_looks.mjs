// The five armour looks, dressed once per gender onto the accepted human body plates with the
// image edits endpoint. The dress prompt pins the identical figure and changes only the
// attire; framing (the whole figure still inside the frame) is the gate that holds it there.
// Looks are class-neutral and race-neutral by design.
//
// There was a second gate here, a head diff, and it was deleted rather than retuned: it
// measured registration, not identity, so it could not do the job its name claimed. Three
// things were wrong with it. Its band was the top fifth of the figure, but on these T-poses the
// neck sits at 0.135 of the figure height (male) and 0.156 (female), so the band took in both
// shoulders and the inner arms, which every one of the five looks dresses by design. It
// compared raw pixels, and the source body plates are barefoot while every look adds boots, so
// the dressed figure is rescaled and shifted and no booted look can ever register against its
// own source. And the repairs measured worse than the disease: normalising the band over the
// bbox scored 1.4% for a genuinely different face against 1.2% for the same face dressed, which
// is blind, while a head-tight band overlapped (5.9 to 8.3% same, 8.2% different). Eight paid
// edits failed it with the message "the face or hair changed" and not one of them had changed.
// Face identity is checked by eye instead: the dress prompt's KEEP_FIGURE clause pins it, and
// the head is cut at 3x from the dressed plate and its source and the two are read side by side.
//
//   node scripts/asset_pipeline/concept_race_looks.mjs --out tmp/asset_pipeline/races/looks
//        [--bodies tmp/asset_pipeline/races/bodies/full] [--only <id substring>] [--parallel 2]
//        [--attempts 3] [--dry-run]
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConceptFraming, describeFraming } from './lib/concept_frame.mjs';
import { makeLedger, makeLogger, positiveInt, writeWebCopy } from './lib/concept_ledger.mjs';
import { buildRaceLookJobs, LOOKS, lookPrompt, styleNamed } from './lib/concept_races.mjs';
import { priceOpenAiUsage } from './lib/cost.mjs';
import { hasOpenAi } from './lib/env.mjs';
import { editImages, IMAGE_MODEL } from './lib/openai_image.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUALITY = 'high';
const WEB = { width: 768, height: 768 };

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

function sourceFor(job, bodiesDir) {
  const path = join(bodiesDir, `human__${job.gender}__body__${job.style}.png`);
  if (!existsSync(path)) {
    throw new Error(`${job.id}: source body plate missing at ${path}; run the body plates first`);
  }
  return path;
}

async function renderLook(job, ctx) {
  const look = LOOKS.find((l) => l.id === job.look);
  const style = styleNamed(job.style);
  const source = sourceFor(job, ctx.bodiesDir);
  const started = Date.now();
  const tries = [];
  let usd = 0;
  for (let attempt = 1; attempt <= ctx.attempts; attempt++) {
    const prompt = lookPrompt(look, style, attempt);
    const tryPath = join(ctx.fullDir, `${job.id}_try${attempt}.png`);
    const { usage } = await editImages({
      prompt,
      images: [source],
      dest: tryPath,
      size: job.size,
      quality: QUALITY,
      background: job.background,
    });
    usd += priceOpenAiUsage(usage);
    const framing = await checkConceptFraming(tryPath);
    tries.push({ n: attempt, framing: framing.problems });
    ctx.log(
      `${job.id} try ${attempt}: framing ${framing.ok ? 'ok' : 'FAIL'}; ` +
        describeFraming(framing.measure),
    );
    for (const problem of framing.problems) ctx.log(`${job.id} try ${attempt} framing: ${problem}`);
    await ctx.prompts.upsert({
      id: job.id,
      kind: job.kind,
      provider: IMAGE_MODEL,
      quality: QUALITY,
      size: job.size,
      background: job.background,
      prompt,
    });
    if (framing.ok) {
      const full = join(ctx.fullDir, `${job.id}.png`);
      copyFileSync(tryPath, full);
      const webBytes = await writeWebCopy(full, join(ctx.webDir, `${job.id}.webp`), WEB);
      const rounded = Math.round(usd * 10000) / 10000;
      await ctx.manifest.upsert({
        id: job.id,
        subject: job.subject,
        style: job.style,
        kind: job.kind,
        gender: job.gender,
        look: job.look,
        source: `human__${job.gender}__body__${job.style}.png`,
        full: `full/${job.id}.png`,
        web: `web/${job.id}.webp`,
        web_bytes: webBytes,
        usd: rounded,
        attempts: attempt,
        gates: { framing: describeFraming(framing.measure) },
      });
      ctx.log(
        `${job.id} done in ${((Date.now() - started) / 1000).toFixed(0)}s, ` +
          `${attempt} attempt(s), $${rounded}`,
      );
      return { usd: rounded, ok: true };
    }
  }
  await writeFile(
    join(ctx.fullDir, `${job.id}_FAILED.json`),
    `${JSON.stringify({ id: job.id, attempts: tries }, null, 2)}\n`,
  );
  ctx.log(
    `${job.id} FAILED all ${ctx.attempts} attempts, $${usd.toFixed(4)}; see ${job.id}_FAILED.json`,
  );
  return { usd, ok: false };
}

async function main() {
  const out = opt('out');
  if (!out) throw new Error('--out <dir> is required');
  const bodiesDir = resolve(REPO_ROOT, opt('bodies', 'tmp/asset_pipeline/races/bodies/full'));
  const only = opt('only', '');
  const parallel = positiveInt('parallel', opt('parallel', '2'));
  const attempts = positiveInt('attempts', opt('attempts', '3'));
  const jobs = buildRaceLookJobs().filter((j) => !only || j.id.includes(only));
  if (!jobs.length) throw new Error(`--only ${only} matched no look`);
  if (flag('dry-run')) {
    for (const j of jobs) console.log(`${j.id} ${j.size} ${j.background}\n${j.prompt}\n`);
    console.log(`${jobs.length} looks; no images requested`);
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
    bodiesDir,
    attempts,
    log: makeLogger(join(outDir, 'run.log')),
    manifest: makeLedger(join(outDir, 'manifest.json')),
    prompts: makeLedger(join(outDir, 'prompts.json')),
  };
  const pending = jobs.filter(
    (j) => !(ctx.manifest.has(j.id) && existsSync(join(fullDir, `${j.id}.png`))),
  );
  ctx.log(
    `${IMAGE_MODEL} ${QUALITY}: ${pending.length} of ${jobs.length} looks pending, ` +
      `${parallel} parallel, ${attempts} attempts`,
  );
  let total = 0;
  let failed = 0;
  const queue = [...pending];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        // Read `total` after the await: `total += await ...` reads it before, so two
        // workers finishing over one another lose an update and under-report the spend.
        const r = await renderLook(job, ctx);
        total += r.usd;
        if (!r.ok) failed++;
      } catch (err) {
        failed++;
        ctx.log(`${job.id} ERROR: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  ctx.log(`finished: ${pending.length - failed} passed, ${failed} failed, $${total.toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
