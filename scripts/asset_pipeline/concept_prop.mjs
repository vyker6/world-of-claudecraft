#!/usr/bin/env node
// Environment-prop concept in the locked art direction, for the prop lane's --image input.
//
// The lane's own concept stage (pipeline.mjs prop --prompt) carries the KayKit-era STYLE_CORE,
// so a prop in the simpleMMO direction brings its own plate: the brief, a STYLES recipe from
// concept_matrix.mjs (osrs_genshin by default), the lane's proven object framing block and
// the explicit margin language go to gpt-image; the result is measured by the framing gate;
// a cropped attempt is retried with a corrective note instead of being handed to Tripo.
//
//   node scripts/asset_pipeline/concept_prop.mjs --name ninebend_sluice_gate \
//     --brief "a timber weir sluice gate ..." [--style osrs_genshin] [--attempts 3]
//     [--out tmp/asset_pipeline/concepts/<name>.png]
//
// Every attempt is kept as <name>_try<N>.png; the first that passes the gate is copied to
// --out. Needs OPENAI_API_KEY.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConceptFraming, describeFraming } from './lib/concept_frame.mjs';
import { STYLES } from './lib/concept_matrix.mjs';
import { REPO_ROOT } from './lib/env.mjs';
import { generateConceptImage } from './lib/openai_image.mjs';
import { LAYOUT_OBJECT } from './lib/prompts.mjs';

export const PROP_MARGIN_RULE =
  'the ENTIRE object sits well inside the image with generous empty background around it: ' +
  'the object fills no more than two thirds of the image width and height, with about one ' +
  'sixth of the image clear on every side; nothing touches or crosses the image edge';

export function propConceptPromptFor(brief, style, attempt) {
  const corrective =
    attempt > 1
      ? ' The previous render was cropped at the image edge: pull the camera further back so ' +
        'the object occupies roughly three quarters of the image, centered.'
      : '';
  return (
    `${brief}, a fantasy game environment prop resting on the ground, upright, ` +
    `in ${style.fusion}: ${style.technique}; ${style.design}; ${style.avoid}. ` +
    `${LAYOUT_OBJECT}, ${PROP_MARGIN_RULE}.${corrective}`
  );
}

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main() {
  const name = opt('name');
  const brief = opt('brief');
  if (!name || !brief) throw new Error('usage: --name <slug> --brief "<prop brief>"');
  const styleId = opt('style', 'osrs_genshin');
  const style = STYLES.find((s) => s.id === styleId);
  if (!style) {
    throw new Error(`unknown style ${styleId}; known: ${STYLES.map((s) => s.id).join(', ')}`);
  }
  const out = resolve(opt('out', resolve(REPO_ROOT, 'tmp/asset_pipeline/concepts', `${name}.png`)));
  const attempts = Number(opt('attempts', '3'));
  mkdirSync(dirname(out), { recursive: true });

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const dest = out.replace(/\.png$/, `_try${attempt}.png`);
    const prompt = propConceptPromptFor(brief, style, attempt);
    console.log(`[${name}] attempt ${attempt}/${attempts}: gpt-image (${prompt.length} chars)`);
    await generateConceptImage({ prompt, dest });
    const { ok, problems, measure } = await checkConceptFraming(dest);
    console.log(`[${name}]   ${describeFraming(measure)}`);
    if (ok) {
      copyFileSync(dest, out);
      console.log(`[${name}] framed concept -> ${out}`);
      return;
    }
    for (const p of problems) console.log(`[${name}]   rejected: ${p}`);
  }
  throw new Error(`${name}: no attempt passed the framing gate after ${attempts} tries`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
