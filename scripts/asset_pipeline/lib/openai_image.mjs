// Optional gpt-image-2 concept-image stage (used when OPENAI_API_KEY is set and
// no input image was given). Facts this client encodes (July 2026 docs):
// - POST https://api.openai.com/v1/images/generations, model must be explicit
//   (the endpoint default is a legacy model), GPT image models return ONLY
//   b64_json (no hosted URL) and reject `response_format`.
// - Concept generations ask for background:"transparent" (PNG with alpha) so the
//   same image serves image-to-model AND the UI (portraits, ability cut-ins)
//   without a matting pass; `background` is a parameter so a caller that needs
//   an opaque scene (an environment plate) can say so.
// - /v1/images/edits (multipart) accepts image[] reference inputs; used for the
//   atlas-repaint skin lane and for style-reference generation.
import { readFile, writeFile } from 'node:fs/promises';
import { openaiKey } from './env.mjs';

const OPENAI_BASE = 'https://api.openai.com/v1';
export const IMAGE_MODEL = process.env.ASSET_PIPELINE_IMAGE_MODEL || 'gpt-image-2';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Backoff with jitter, capped: 520 bursts under CONCURRENT images/edits calls
// last minutes, so a short fixed backoff burns every retry inside the burst.
// Serialize concept stages across processes where possible (see CLAUDE.md).
const backoff = (attempt) => Math.min(45000, 3000 * 2 ** attempt) * (0.7 + Math.random() * 0.6);

async function openaiFetch(path, init, { retries = 5 } = {}) {
  const key = openaiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not set (the gpt-image-2 stage is optional)');
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(`${OPENAI_BASE}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, ...(init.headers ?? {}) },
      });
    } catch (err) {
      // Network error: retry with backoff.
      lastErr = err;
      await sleep(backoff(attempt));
      continue;
    }
    const json = await res.json().catch(() => null);
    if (res.ok) return json;
    const msg = `OpenAI ${path} HTTP ${res.status}: ${json?.error?.message ?? 'unknown error'}`;
    // Transient statuses (rate limit, upstream/Cloudflare 5xx) retry; real
    // client errors fail fast.
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(msg);
      await sleep(backoff(attempt));
      continue;
    }
    throw new Error(msg);
  }
  throw new Error(`OpenAI request failed after ${retries + 1} attempts: ${lastErr?.message}`);
}

function firstImageB64(json) {
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI response had no b64_json image');
  return Buffer.from(b64, 'base64');
}

export const IMAGE_BACKGROUNDS = Object.freeze(['transparent', 'opaque', 'auto']);

function checkBackground(background) {
  if (!IMAGE_BACKGROUNDS.includes(background)) {
    throw new Error(
      `background must be one of ${IMAGE_BACKGROUNDS.join(', ')}, got ${JSON.stringify(background)}`,
    );
  }
  return background;
}

/** Generate a concept image to `dest` (png, alpha channel when `background` is
 *  'transparent', the default). Returns {dest, usage}. */
export async function generateConceptImage({
  prompt,
  dest,
  size = '1024x1024',
  quality = 'high',
  background = 'transparent',
}) {
  const json = await openaiFetch('/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      size,
      quality,
      background: checkBackground(background),
      n: 1,
      output_format: 'png',
    }),
  });
  await writeFile(dest, firstImageB64(json));
  return { dest, usage: json.usage ?? null };
}

/** Edit one or more reference images with a prompt (multipart image[]). Used for
 *  the atlas-repaint skin lane and style-referenced concepts. `background` is
 *  only sent when given: an atlas repaint must keep the atlas opaque, a
 *  style-referenced concept asks for 'transparent'. */
export async function editImages({ prompt, images, dest, size, quality = 'high', background }) {
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('prompt', prompt);
  if (size) form.append('size', size);
  form.append('quality', quality);
  if (background !== undefined) form.append('background', checkBackground(background));
  for (const path of images) {
    const buf = await readFile(path);
    const name = path.split('/').pop();
    const type = /\.png$/.test(name)
      ? 'image/png'
      : /\.webp$/.test(name)
        ? 'image/webp'
        : 'image/jpeg';
    form.append('image[]', new Blob([buf], { type }), name);
  }
  const json = await openaiFetch('/images/edits', { method: 'POST', body: form });
  await writeFile(dest, firstImageB64(json));
  return { dest, usage: json.usage ?? null };
}
