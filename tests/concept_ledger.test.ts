import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  makeLedger,
  makeLogger,
  writeWebCopy,
} from '../scripts/asset_pipeline/lib/concept_ledger.mjs';
import { syntheticPlate, tposeFigure } from './helpers/synthetic_plate';

describe('concept_ledger', () => {
  it('upserts rows by id and rewrites the file each time, in order', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const file = join(dir, 'manifest.json');
    const ledger = makeLedger(file);
    await ledger.upsert({ id: 'a', n: 1 });
    await ledger.upsert({ id: 'b', n: 2 });
    await ledger.upsert({ id: 'a', n: 3 });
    expect(ledger.has('a')).toBe(true);
    expect(ledger.get('a')).toEqual({ id: 'a', n: 3 });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual([
      { id: 'a', n: 3 },
      { id: 'b', n: 2 },
    ]);
    const reopened = makeLedger(file);
    expect(reopened.rows).toHaveLength(2);
  });
  it('appends timestamped log lines', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ledger-'));
    const file = join(dir, 'run.log');
    const log = makeLogger(file);
    log('hello');
    log('world');
    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/world$/);
  });
  it('writes a webp review copy inside the requested box and reports its size', async () => {
    const full = await syntheticPlate(
      'web',
      256,
      tposeFigure(256, { skin: '#c8956b', hair: '#5a3a24', garment: '#404044', accent: '#7a6a3a' }),
    );
    const web = full.replace(/\.png$/, '.webp');
    const bytes = await writeWebCopy(full, web, { width: 128, height: 128 });
    expect(existsSync(web)).toBe(true);
    expect(bytes).toBeGreaterThan(100);
  });
});
