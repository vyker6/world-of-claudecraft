// The twelve race body plates: one underlayer T-pose per race per gender, 1024x1024 with a
// transparent background, generated then held to three gates before it is kept: framing
// (nothing touches an edge, the figure fills enough of the frame), pose (a real frontal
// T-pose, measured off the arm line), tint (skin, hair, garment and accent painted in the
// declared base colours and separable for the dye shader). Each failed gate appends its own
// corrective sentence to the next attempt's prompt. Three failures write <id>_FAILED.json and
// the plate is left for a person to look at; nothing failed is ever copied to <id>.png.
//
//   node scripts/asset_pipeline/concept_race_bodies.mjs --out tmp/asset_pipeline/races/bodies
//        [--only <id substring>] [--parallel 2] [--attempts 3] [--dry-run]
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConceptFraming, describeFraming, FRAME_RULES } from './lib/concept_frame.mjs';
import { makeLedger, makeLogger, writeWebCopy } from './lib/concept_ledger.mjs';
import { checkConceptPose } from './lib/concept_pose.mjs';
import {
  bodyPrompt,
  buildRaceBodyJobs,
  RACES,
  styleNamed,
  zonesFor,
} from './lib/concept_races.mjs';
import { checkConceptTint } from './lib/concept_tint.mjs';
import { priceOpenAiUsage } from './lib/cost.mjs';
import { hasOpenAi } from './lib/env.mjs';
import { generateConceptImage, IMAGE_MODEL } from './lib/openai_image.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUALITY = 'high';
const WEB = { width: 768, height: 768 };

const CORRECTIVE = {
  framing:
    'The previous render was cropped at the image edge: pull the camera further back so the ' +
    'figure occupies roughly three quarters of the image height, centered, with clear ' +
    'background beyond both hands and above the head.',
  pose:
    'The previous render was not a T-pose: both arms must be straight out horizontally at ' +
    'shoulder height, palms down, the figure facing the camera squarely, legs straight and ' +
    'slightly apart.',
  tint:
    'The previous render used the wrong colours: paint the skin, the hair, the garment and ' +
    'the eyes as exact flat fills of the colours named in this prompt, with no gradients, so ' +
    'each is one clearly distinct colour.',
};

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

// Body plates clear the edge at 2%, not the shared 4%. A positive margin already means nothing
// is clipped, which is all the reconstruction needs; the 4% floor was tuned for plates carrying
// weapon tips, and against a bare T-pose it rejected renders at 2.3 to 3.8% with nothing touching
// an edge, costing an attempt on plate after plate. concept_frame.mjs itself is left alone.
const BODY_FRAME_RULES = { ...FRAME_RULES, minMargin: 0.02 };

async function gates(path, race) {
  const [framing, pose, tint] = await Promise.all([
    checkConceptFraming(path, BODY_FRAME_RULES),
    checkConceptPose(path),
    checkConceptTint(path, zonesFor(race)),
  ]);
  return { framing, pose, tint, ok: framing.ok && pose.ok && tint.ok };
}

function tintSummary(measure) {
  return Object.fromEntries(
    Object.entries(measure.zones).map(([k, v]) => [
      k,
      { share: v.share, distanceToBase: v.distanceToBase },
    ]),
  );
}

async function renderBody(job, ctx) {
  const race = RACES.find((r) => r.id === job.race);
  const style = styleNamed(job.style);
  const started = Date.now();
  const tries = [];
  let usd = 0;
  let corrective = '';
  for (let attempt = 1; attempt <= ctx.attempts; attempt++) {
    const prompt = bodyPrompt(race, job.gender, style, attempt, corrective);
    const tryPath = join(ctx.fullDir, `${job.id}_try${attempt}.png`);
    const { usage } = await generateConceptImage({
      prompt,
      dest: tryPath,
      size: job.size,
      quality: QUALITY,
      background: job.background,
    });
    usd += priceOpenAiUsage(usage);
    const g = await gates(tryPath, race);
    tries.push({
      n: attempt,
      framing: g.framing.problems,
      pose: g.pose.problems,
      tint: g.tint.problems,
    });
    ctx.log(
      `${job.id} try ${attempt}: framing ${g.framing.ok ? 'ok' : 'FAIL'}, ` +
        `pose ${g.pose.ok ? 'ok' : 'FAIL'}, tint ${g.tint.ok ? 'ok' : 'FAIL'}; ` +
        describeFraming(g.framing.measure),
    );
    for (const [gate, result] of Object.entries({
      framing: g.framing,
      pose: g.pose,
      tint: g.tint,
    })) {
      for (const problem of result.problems)
        ctx.log(`${job.id} try ${attempt} ${gate}: ${problem}`);
    }
    await ctx.prompts.upsert({
      id: job.id,
      kind: job.kind,
      provider: IMAGE_MODEL,
      quality: QUALITY,
      size: job.size,
      background: job.background,
      prompt,
    });
    if (g.ok) {
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
        full: `full/${job.id}.png`,
        web: `web/${job.id}.webp`,
        web_bytes: webBytes,
        usd: rounded,
        attempts: attempt,
        gates: {
          framing: describeFraming(g.framing.measure),
          pose: g.pose.measure,
          tint: tintSummary(g.tint.measure),
        },
      });
      ctx.log(
        `${job.id} done in ${((Date.now() - started) / 1000).toFixed(0)}s, ` +
          `${attempt} attempt(s), $${rounded}`,
      );
      return { usd: rounded, ok: true };
    }
    const failed = [
      g.framing.ok ? null : 'framing',
      g.pose.ok ? null : 'pose',
      g.tint.ok ? null : 'tint',
    ].filter(Boolean);
    corrective = failed.map((k) => CORRECTIVE[k]).join(' ');
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
  const only = opt('only', '');
  const parallel = Number(opt('parallel', '2'));
  const attempts = Number(opt('attempts', '3'));
  const jobs = buildRaceBodyJobs().filter((j) => !only || j.id.includes(only));
  if (!jobs.length) throw new Error(`--only ${only} matched no body plate`);
  if (flag('dry-run')) {
    for (const j of jobs) console.log(`${j.id} ${j.size} ${j.background}\n${j.prompt}\n`);
    console.log(`${jobs.length} plates; no images requested`);
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
    attempts,
    log: makeLogger(join(outDir, 'run.log')),
    manifest: makeLedger(join(outDir, 'manifest.json')),
    prompts: makeLedger(join(outDir, 'prompts.json')),
  };
  const pending = jobs.filter(
    (j) => !(ctx.manifest.has(j.id) && existsSync(join(fullDir, `${j.id}.png`))),
  );
  ctx.log(
    `${IMAGE_MODEL} ${QUALITY}: ${pending.length} of ${jobs.length} plates pending, ` +
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
        const r = await renderBody(job, ctx);
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
