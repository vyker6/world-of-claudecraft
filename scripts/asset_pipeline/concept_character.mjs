#!/usr/bin/env node
// Grimdark character concept for the creature lane.
//
// The lane's own concept stage (pipeline.mjs --prompt) is written for the
// KayKit chibi art direction and rides a style board of shipped chibi assets, so
// a realistic grimdark cast has to bring its own concept via --image. This tool
// produces that image: the brief, the grimdark style block, the lane's proven
// biped framing recipe (LAYOUT_CHARACTER) and explicit margin language go to
// gpt-image-2; the result is measured with the framing gate; a cropped attempt
// is retried with a corrective note instead of being handed to Tripo.
//
//   node scripts/asset_pipeline/concept_character.mjs --name reaver \
//     --brief "a grimdark berserker ..." [--out tmp/asset_pipeline/concepts/reaver.png]
//     [--attempts 3]
//
// Every attempt is kept next to the output as <name>_try<N>.png so the operator
// can look at what was rejected. Needs OPENAI_API_KEY (repo-root .env or env).
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkConceptFraming, describeFraming } from './lib/concept_frame.mjs';
import { REPO_ROOT } from './lib/env.mjs';
import { generateConceptImage } from './lib/openai_image.mjs';
import { LAYOUT_CHARACTER } from './lib/prompts.mjs';

export const GRIMDARK_STYLE =
  'grimdark dark-fantasy realism in the manner of Diablo IV and Elden Ring, realistic human ' +
  'proportions, photoreal PBR materials (worn iron, scarred leather, weathered stone, matted ' +
  'fur), battle-worn and weathered, muted desaturated palette with gold as the only saturated ' +
  'accent, no cartoon or chibi stylization';

// The framing gate measures what the prompt only asks for; this block asks for
// it in pixel terms the image model reliably honors.
export const MARGIN_RULE =
  'the ENTIRE figure including the top of the head, the fingertips of both outstretched arms, ' +
  'any weapon tips and the soles of the boots sits well inside the image with generous empty ' +
  'background around it: about one tenth of the image height clear above the head and below ' +
  'the feet, and clear background beyond both hands; nothing touches or crosses the image edge';

export function conceptPromptFor(brief, attempt) {
  const corrective =
    attempt > 1
      ? ' The previous render was cropped at the image edge: pull the camera further back so ' +
        'the figure occupies roughly three quarters of the image height, centered.'
      : '';
  return `${brief}, ${GRIMDARK_STYLE}, ${LAYOUT_CHARACTER}, ${MARGIN_RULE}.${corrective}`;
}

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main() {
  const name = opt('name');
  const brief = opt('brief');
  if (!name || !brief) throw new Error('usage: --name <slug> --brief "<character brief>"');
  const out = resolve(opt('out', resolve(REPO_ROOT, 'tmp/asset_pipeline/concepts', `${name}.png`)));
  const attempts = Number(opt('attempts', '3'));
  mkdirSync(dirname(out), { recursive: true });

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const dest = out.replace(/\.png$/, `_try${attempt}.png`);
    const prompt = conceptPromptFor(brief, attempt);
    console.log(`[${name}] attempt ${attempt}/${attempts}: gpt-image-2 (${prompt.length} chars)`);
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
