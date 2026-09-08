// The 51 weapon plates: 17 types by three shapes, 1024x1024 transparent, generated then held
// to four gates before one is kept. Framing (nothing touches an edge), tint (each zone painted
// in its declared base colour, the tier zone carrying its share), aspect (the silhouette's
// height over width sits in the type's band), then distinctness once a type's three plates have
// passed the first three: every pair at least SHAPE_RULES.minDistance apart at icon scale, and
// a failing pair regenerates the later shape with a corrective naming its sibling. Cross-type
// distance is reported in the manifest and the log, never gated. Three misses write
// <id>_FAILED.json; nothing failed is ever copied to <id>.png.
//
//   OPENAI_API_KEY=... node scripts/asset_pipeline/concept_weapon_types.mjs --out tmp/asset_pipeline/weapons
//        [--only <id substring>] [--pilot] [--parallel 2] [--attempts 3] [--dry-run]
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConceptFraming, describeFraming, FRAME_RULES } from './lib/concept_frame.mjs';
import { makeLedger, makeLogger, positiveInt, writeWebCopy } from './lib/concept_ledger.mjs';
import {
  checkConceptAspect,
  distinctnessProblems,
  measureShape,
  nearestNeighbours,
  SHAPE_RULES,
  shapeDistance,
} from './lib/concept_shape.mjs';
import { checkConceptTint } from './lib/concept_tint.mjs';
import {
  aspectCorrective,
  buildWeaponJobs,
  CORRECTIVE,
  distinctCorrective,
  styleNamed,
  tintRulesFor,
  typeNamed,
  weaponPrompt,
  zonesFor,
} from './lib/concept_weapons.mjs';
import { priceOpenAiUsage } from './lib/cost.mjs';
import { hasOpenAi } from './lib/env.mjs';
import { generateConceptImage, IMAGE_MODEL } from './lib/openai_image.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const QUALITY = 'high';
const WEB = { width: 512, height: 512 };

// Weapon plates clear the edge at 2 percent, not the shared 4 percent, as the race bodies do. A
// positive margin already means nothing is clipped, which is all the reconstruction needs; the
// second pilot lost every first attempt at 2 to 3 percent with nothing touching an edge.
const WEAPON_FRAME_RULES = { ...FRAME_RULES, minMargin: 0.02 };

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

async function gates(path, type) {
  const [framing, tint, aspect] = await Promise.all([
    checkConceptFraming(path, WEAPON_FRAME_RULES),
    checkConceptTint(path, zonesFor(type), tintRulesFor(type)),
    checkConceptAspect(path, type.aspect, type.name),
  ]);
  return { framing, tint, aspect, ok: framing.ok && tint.ok && aspect.ok };
}

function tintSummary(measure) {
  return Object.fromEntries(
    Object.entries(measure.zones).map(([k, v]) => [
      k,
      { share: v.share, distanceToBase: v.distanceToBase },
    ]),
  );
}

/** The one-line try summary logged after each attempt's three gates have run. */
function describeTry(job, ctx, attempt, g) {
  return (
    `${job.id} try ${ctx.tryBase + attempt}: framing ${g.framing.ok ? 'ok' : 'FAIL'}, ` +
    `tint ${g.tint.ok ? 'ok' : 'FAIL'}, aspect ${g.aspect.ok ? 'ok' : 'FAIL'}; ` +
    `${describeFraming(g.framing.measure)}; aspect ${g.aspect.measure.aspect.toFixed(2)}`
  );
}

/** One log line per problem a gate raised on this attempt. */
function logGateProblems(ctx, job, attempt, g) {
  for (const [gate, result] of Object.entries({
    framing: g.framing,
    tint: g.tint,
    aspect: g.aspect,
  })) {
    for (const problem of result.problems)
      ctx.log(`${job.id} try ${ctx.tryBase + attempt} ${gate}: ${problem}`);
  }
}

/** The standing corrective plus one new sentence per gate that failed this attempt. */
function buildCorrective(standing, g, type) {
  const failed = [
    g.framing.ok ? null : CORRECTIVE.framing,
    g.tint.ok ? null : CORRECTIVE.tint,
    g.aspect.ok ? null : aspectCorrective(type),
  ];
  return [standing, ...failed].filter(Boolean).join(' ');
}

/** One plate through framing, tint and aspect, with an optional standing corrective. */
async function renderPlate(job, ctx, standing = '') {
  const type = typeNamed(job.subject);
  const shape = type.shapes.find((s) => s.id === job.shape);
  const style = styleNamed(job.style);
  const started = Date.now();
  const tries = [];
  let usd = 0;
  let corrective = standing;
  for (let attempt = 1; attempt <= ctx.attempts; attempt++) {
    const prompt = weaponPrompt(type, shape, style, corrective);
    const tryPath = join(ctx.fullDir, `${job.id}_try${ctx.tryBase + attempt}.png`);
    const { usage } = await generateConceptImage({
      prompt,
      dest: tryPath,
      size: job.size,
      quality: QUALITY,
      background: job.background,
    });
    usd += priceOpenAiUsage(usage);
    const g = await gates(tryPath, type);
    tries.push({
      n: ctx.tryBase + attempt,
      framing: g.framing.problems,
      tint: g.tint.problems,
      aspect: g.aspect.problems,
    });
    ctx.log(describeTry(job, ctx, attempt, g));
    logGateProblems(ctx, job, attempt, g);
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
        shape: job.shape,
        style: job.style,
        kind: job.kind,
        full: `full/${job.id}.png`,
        web: `web/${job.id}.webp`,
        web_bytes: webBytes,
        usd: rounded,
        attempts: ctx.tryBase + attempt,
        gates: {
          framing: describeFraming(g.framing.measure),
          tint: tintSummary(g.tint.measure),
          aspect: g.aspect.measure.aspect,
        },
        distances: {},
        nearest: null,
      });
      ctx.log(
        `${job.id} done in ${((Date.now() - started) / 1000).toFixed(0)}s, ${attempt} attempt(s), $${rounded}`,
      );
      return { usd: rounded, ok: true, measure: g.aspect.measure };
    }
    corrective = buildCorrective(standing, g, type);
  }
  await writeFile(
    join(ctx.fullDir, `${job.id}_FAILED.json`),
    `${JSON.stringify({ id: job.id, attempts: tries }, null, 2)}\n`,
  );
  ctx.log(
    `${job.id} FAILED all ${ctx.attempts} attempts, $${usd.toFixed(4)}; see ${job.id}_FAILED.json`,
  );
  return { usd, ok: false, measure: null };
}

/** A type's three base plates: render what is missing, reuse what is already on disk. */
async function renderTypeBaseline(jobs, ctx) {
  let usd = 0;
  let failed = 0;
  const rows = [];
  for (const job of jobs) {
    const done = ctx.manifest.has(job.id) && existsSync(join(ctx.fullDir, `${job.id}.png`));
    const r = done
      ? { usd: 0, ok: true, measure: await measureShape(join(ctx.fullDir, `${job.id}.png`)) }
      : await renderPlate(job, { ...ctx, tryBase: 0 }, '');
    usd += r.usd;
    if (r.ok) rows.push({ id: job.id, job, measure: r.measure });
    else failed++;
  }
  return { rows, usd, failed };
}

/** Regenerate the later shape of a failing pair, once per pass, with the sibling named; write
 *  the type's DISTINCT_FAILED file when a pair is still under the floor once passes are spent. */
async function enforceDistinctness(type, typeId, rows, ctx) {
  let usd = 0;
  let failed = 0;
  for (let pass = 0; pass < 2 && distinctnessProblems(rows, SHAPE_RULES).length; pass++) {
    const problems = distinctnessProblems(rows, SHAPE_RULES);
    for (const p of problems) ctx.log(`${typeId} distinctness: ${p}`);
    const later = rows.findIndex((row, i) =>
      rows
        .slice(0, i)
        .some((prev) => shapeDistance(prev.measure, row.measure) < SHAPE_RULES.minDistance),
    );
    if (later < 0) break;
    const sibling = rows
      .slice(0, later)
      .find((prev) => shapeDistance(prev.measure, rows[later].measure) < SHAPE_RULES.minDistance);
    const shape = type.shapes.find((s) => s.id === rows[later].job.shape);
    const sib = type.shapes.find((s) => s.id === sibling.job.shape);
    const r = await renderPlate(
      rows[later].job,
      { ...ctx, tryBase: ctx.attempts * (pass + 1) },
      distinctCorrective(type, shape, sib),
    );
    usd += r.usd;
    if (r.ok) rows[later] = { ...rows[later], measure: r.measure };
    else failed++;
  }
  const remaining = distinctnessProblems(rows, SHAPE_RULES);
  if (remaining.length) {
    await writeFile(
      join(ctx.fullDir, `${typeId}_DISTINCT_FAILED.json`),
      `${JSON.stringify({ type: typeId, problems: remaining }, null, 2)}\n`,
    );
    ctx.log(
      `${typeId} DISTINCT FAILED: ${remaining.length} pair(s) still under the floor; see ${typeId}_DISTINCT_FAILED.json`,
    );
    failed++;
  }
  return { rows, usd, failed };
}

/** Every kept row's manifest entry gets its distances to its type's other kept siblings. */
async function recordDistances(rows, ctx) {
  for (const row of rows) {
    const distances = Object.fromEntries(
      rows
        .filter((o) => o !== row)
        .map((o) => [o.id, Math.round(shapeDistance(row.measure, o.measure) * 1000) / 1000]),
    );
    const existing = ctx.manifest.get(row.id);
    if (existing) await ctx.manifest.upsert({ ...existing, distances });
  }
}

/** A type's three plates, then the within-type distinctness gate over the ones that passed. */
async function renderType(typeId, jobs, ctx) {
  const type = typeNamed(typeId);
  const baseline = await renderTypeBaseline(jobs, ctx);
  const distinct = await enforceDistinctness(type, typeId, baseline.rows, ctx);
  const usd = baseline.usd + distinct.usd;
  const failed = baseline.failed + distinct.failed;
  await recordDistances(distinct.rows, ctx);
  ctx.log(`${typeId}: ${distinct.rows.length} of ${jobs.length} plates kept, $${usd.toFixed(2)}`);
  return { usd, failed, rows: distinct.rows };
}

/** Every kept plate's measured shape, for the cross-type nearest-neighbour report. */
async function measureKeptPlates(ctx) {
  const rows = [];
  for (const m of ctx.manifest.rows) {
    const full = join(ctx.fullDir, `${m.id}.png`);
    if (existsSync(full))
      rows.push({ id: m.id, subject: m.subject, measure: await measureShape(full) });
  }
  return rows;
}

/** Each row's nearest plate of a different type, recorded onto its manifest entry. */
async function nearestAcrossTypes(rows, ctx) {
  const byType = rows.map((row) => {
    const others = rows.filter((o) => o.subject !== row.subject);
    return { id: row.id, measure: row.measure, others };
  });
  const pairs = [];
  for (const row of byType) {
    const nn = nearestNeighbours([
      { id: row.id, measure: row.measure },
      ...row.others.map((o) => ({ id: o.id, measure: o.measure })),
    ]).find((n) => n.id === row.id);
    const existing = ctx.manifest.get(row.id);
    if (existing && nn)
      await ctx.manifest.upsert({
        ...existing,
        nearest: { id: nn.nearest, distance: Math.round(nn.distance * 1000) / 1000 },
      });
    if (nn) pairs.push({ a: row.id, b: nn.nearest, d: nn.distance });
  }
  return pairs;
}

/** The ten closest cross-type pairs, deduplicated by unordered id pair. */
function closestPairs(pairs) {
  pairs.sort((p, q) => p.d - q.d);
  const seen = new Set();
  return pairs
    .filter((p) => {
      const key = [p.a, p.b].sort().join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function crossTypeReport(ctx) {
  const rows = await measureKeptPlates(ctx);
  const pairs = await nearestAcrossTypes(rows, ctx);
  const closest = closestPairs(pairs);
  ctx.log(`cross-type report: ${closest.length} closest pairs (reported, not gated)`);
  for (const p of closest) ctx.log(`  ${p.a} vs ${p.b}: ${p.d.toFixed(3)}`);
}

async function main() {
  const out = opt('out');
  if (!out) throw new Error('--out <dir> is required');
  const only = opt('only', '');
  const parallel = positiveInt('parallel', opt('parallel', '2'));
  const attempts = positiveInt('attempts', opt('attempts', '3'));
  const jobs = buildWeaponJobs('osrs_genshin', { only, pilot: flag('pilot') });
  if (flag('dry-run')) {
    for (const j of jobs) console.log(`${j.id} ${j.size} ${j.background}\n${j.prompt}\n`);
    console.log(`${jobs.length} plates; no images requested`);
    return;
  }
  if (!hasOpenAi()) throw new Error('OPENAI_API_KEY is not set in the process environment');
  const outDir = resolve(REPO_ROOT, out);
  const fullDir = join(outDir, 'full');
  const webDir = join(outDir, 'web');
  for (const d of [fullDir, webDir]) mkdirSync(d, { recursive: true });
  const ctx = {
    fullDir,
    webDir,
    attempts,
    tryBase: 0,
    log: makeLogger(join(outDir, 'run.log')),
    manifest: makeLedger(join(outDir, 'manifest.json')),
    prompts: makeLedger(join(outDir, 'prompts.json')),
  };
  const types = [...new Set(jobs.map((j) => j.subject))];
  const pending = jobs.filter(
    (j) => !(ctx.manifest.has(j.id) && existsSync(join(fullDir, `${j.id}.png`))),
  );
  ctx.log(
    `${IMAGE_MODEL} ${QUALITY}: ${pending.length} of ${jobs.length} plates pending across ${types.length} types, ${parallel} parallel, ${attempts} attempts`,
  );
  let total = 0;
  let failed = 0;
  const queue = [...types];
  const worker = async () => {
    for (let typeId = queue.shift(); typeId; typeId = queue.shift()) {
      try {
        const r = await renderType(
          typeId,
          jobs.filter((j) => j.subject === typeId),
          ctx,
        );
        total += r.usd;
        failed += r.failed;
      } catch (err) {
        failed++;
        ctx.log(`${typeId} ERROR: ${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, parallel) }, worker));
  await crossTypeReport(ctx);
  ctx.log(`finished: ${failed} failure(s), $${total.toFixed(2)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
