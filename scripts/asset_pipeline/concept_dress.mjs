#!/usr/bin/env node
// Dress an existing framed character plate in new attire, in the locked art direction.
//
// The body plate that a hero was modelled from is the one silhouette Tripo has already
// reconstructed at the game's proportions. Armour for that hero must come from the SAME
// figure in the SAME T-pose and framing, or the armoured mesh will not sit on the hero's
// skeleton after the manual rig. So the armour concept is an image EDIT of the body plate
// (gpt-image edits with the plate as the reference input), not a fresh generation: the
// prompt describes only the attire and pins everything else to the input.
//
//   node scripts/asset_pipeline/concept_dress.mjs --name hero_warrior_leather \
//     --plate docs/.../hero_reaver_body_tpose_v1_framed.png \
//     --brief "the same figure now wearing ..." [--style osrs_genshin] [--attempts 3]
//     [--out tmp/asset_pipeline/concepts/<name>.png]
//
// Every attempt is kept as <name>_try<N>.png; the first that passes the framing gate is
// copied to --out. Needs OPENAI_API_KEY.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARGIN_RULE } from './concept_character.mjs';
import { checkConceptFraming, describeFraming } from './lib/concept_frame.mjs';
import { STYLES } from './lib/concept_matrix.mjs';
import { REPO_ROOT } from './lib/env.mjs';
import { editImages } from './lib/openai_image.mjs';

export const KEEP_FIGURE =
  'Keep the identical character from the input image: the same face, horns, hair, skin, ' +
  'scars, body proportions and the same standing T-pose with both arms straight out ' +
  'horizontally, seen from the same camera at the same scale and position in the frame, ' +
  'on a fully transparent background with nothing else in the image';

export function dressPromptFor(brief, style, attempt) {
  const corrective =
    attempt > 1
      ? ' The previous render was cropped at the image edge: keep the whole figure inside ' +
        'the frame with clear background on every side.'
      : '';
  return (
    `${KEEP_FIGURE}. Change only the clothing and equipment: ${brief}. ` +
    `Render it in ${style.fusion}: ${style.technique}; ${style.design}; ${style.avoid}. ` +
    `${MARGIN_RULE}.${corrective}`
  );
}

function opt(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main() {
  const name = opt('name');
  const plate = opt('plate');
  const brief = opt('brief');
  if (!name || !plate || !brief) {
    throw new Error('usage: --name <slug> --plate <framed body plate> --brief "<attire>"');
  }
  const styleId = opt('style', 'osrs_genshin');
  const style = STYLES.find((s) => s.id === styleId);
  if (!style)
    throw new Error(`unknown style ${styleId}; known: ${STYLES.map((s) => s.id).join(', ')}`);
  const out = resolve(opt('out', resolve(REPO_ROOT, 'tmp/asset_pipeline/concepts', `${name}.png`)));
  const attempts = Number(opt('attempts', '3'));
  mkdirSync(dirname(out), { recursive: true });

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const dest = out.replace(/\.png$/, `_try${attempt}.png`);
    const prompt = dressPromptFor(brief, style, attempt);
    console.log(
      `[${name}] attempt ${attempt}/${attempts}: edit of ${plate} (${prompt.length} chars)`,
    );
    await editImages({
      prompt,
      images: [resolve(plate)],
      dest,
      size: '1024x1024',
      background: 'transparent',
    });
    const { ok, problems, measure } = await checkConceptFraming(dest);
    console.log(`[${name}]   ${describeFraming(measure)}`);
    if (ok) {
      copyFileSync(dest, out);
      console.log(`[${name}] dressed concept -> ${out}`);
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
