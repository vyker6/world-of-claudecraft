// The run ledger the concept runners share: an append-only log, JSON row files upserted by
// id (manifest.json, prompts.json) with writes chained so parallel workers never interleave,
// and the webp review copy. Extracted from concept_matrix.mjs so the race runners reuse it.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

export function makeLogger(path) {
  return (line) => {
    const stamped = `${new Date().toISOString()} ${line}`;
    appendFileSync(path, `${stamped}\n`);
    console.log(stamped);
  };
}

export function makeLedger(path) {
  const rows = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  let chain = Promise.resolve();
  const has = (id) => rows.some((r) => r.id === id);
  const get = (id) => rows.find((r) => r.id === id);
  const upsert = (row) => {
    // An updated row keeps its position. The matrix runner used to drop and push, which moved a
    // rerun cell to the end and made every reread of the ledger a different file; a stable order
    // across reruns is deliberate.
    const at = rows.findIndex((r) => r.id === row.id);
    if (at >= 0) rows[at] = row;
    else rows.push(row);
    chain = chain.then(() => writeFile(path, `${JSON.stringify(rows, null, 2)}\n`));
    return chain;
  };
  return { rows, has, get, upsert };
}

export async function writeWebCopy(fullPath, webPath, { width, height }) {
  await sharp(fullPath)
    .resize(width, height, { fit: 'inside' })
    .webp({ quality: 80 })
    .toFile(webPath);
  return (await stat(webPath)).size;
}

/** A CLI count that must be a whole number of at least one: --parallel, --attempts. */
export function positiveInt(name, value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`--${name} must be a positive integer, got ${JSON.stringify(value)}`);
  }
  return n;
}
