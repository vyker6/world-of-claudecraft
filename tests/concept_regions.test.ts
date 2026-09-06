import { describe, expect, it } from 'vitest';
import {
  GRIMDARK_CORE,
  SCENE_SIZE,
  STYLES,
} from '../scripts/asset_pipeline/lib/concept_matrix.mjs';
import {
  buildRegionJobs,
  CHOSEN_STYLE_ID,
  lightnessWord,
  REGION_VIEWS,
  REGIONS,
  regionJobId,
  regionPrompt,
  styleNamed,
} from '../scripts/asset_pipeline/lib/concept_regions.mjs';

const JOBS = buildRegionJobs();
const STYLE = styleNamed(CHOSEN_STYLE_ID);

// The eight realm interiors in ring order (docs/design/WORLD-regions.md) plus the capital.
const RING = [
  'ninebend',
  'stillmere',
  'whitewold',
  'redmarl',
  'rimefell',
  'saltwake',
  'weedline',
  'stillnoon',
];

function regionNamed(id: string) {
  const r = REGIONS.find((x) => x.id === id);
  if (!r) throw new Error(`no region ${id}`);
  return r;
}

describe('concept regions: the nine places of Solareth in the chosen style', () => {
  it('is the eight realms in ring order plus Kingshearth, three views each, region-major', () => {
    expect(REGIONS.map((r) => r.id)).toEqual([...RING, 'kingshearth']);
    expect(REGION_VIEWS).toEqual(['vista', 'settlement', 'gameplay']);
    expect(JOBS).toHaveLength(27);
    expect(JOBS.slice(0, 3).map((j) => j.subject)).toEqual(Array(3).fill('ninebend'));
    expect(JOBS.slice(0, 3).map((j) => j.view)).toEqual([...REGION_VIEWS]);
  });

  it('defaults to the locked style and refuses one it does not know', () => {
    expect(STYLES.map((s) => s.id)).toContain(CHOSEN_STYLE_ID);
    expect(new Set(JOBS.map((j) => j.style))).toEqual(new Set([CHOSEN_STYLE_ID]));
    expect(() => buildRegionJobs('pixel_art')).toThrow(/unknown style pixel_art/);
  });

  it('carries the palette walk: every region has a locked ground hue and lightness', () => {
    for (const r of REGIONS) {
      expect(r.ground.hue.length, r.id).toBeGreaterThan(3);
      expect(r.ground.lstar, r.id).toBeGreaterThanOrEqual(0);
      expect(r.ground.lstar, r.id).toBeLessThanOrEqual(100);
    }
    const byId = Object.fromEntries(REGIONS.map((r) => [r.id, r.ground.lstar]));
    expect(byId.saltwake).toBe(14);
    expect(byId.stillmere).toBe(22);
    expect(byId.whitewold).toBe(80);
    expect(byId.stillnoon).toBe(88);
  });

  it('gives every view of every region its own scene brief', () => {
    for (const r of REGIONS) {
      for (const v of REGION_VIEWS) {
        expect(r.views[v].length, `${r.id} ${v}`).toBeGreaterThan(20);
      }
    }
  });
});

describe('concept regions: lightness words', () => {
  it('maps L* bands to the words the prompts use, darkest to brightest', () => {
    expect([14, 22, 36, 44, 56, 68, 80, 88].map(lightnessWord)).toEqual([
      'near-black',
      'very dark',
      'dark',
      'mid-dark',
      'mid',
      'light',
      'very light',
      'near-white',
    ]);
  });

  it('rejects an L* outside 0 to 100', () => {
    expect(() => lightnessWord(-1)).toThrow(/0 to 100/);
    expect(() => lightnessWord(101)).toThrow(/0 to 100/);
    expect(() => lightnessWord(Number.NaN)).toThrow(/0 to 100/);
  });
});

describe('concept regions: the prompt', () => {
  it('keeps the matrix order and puts the locked palette after the mood so it wins', () => {
    const p = regionPrompt(regionNamed('stillnoon'), 'vista', STYLE);
    const order = [
      'Art direction: ',
      'Render technique: ',
      'Scene: Stillnoon',
      'Region: ',
      'Design language: ',
      'Composition: ',
      `Mood: ${GRIMDARK_CORE}`,
      'Palette: the ground reads gold-amber at a near-white value',
      'holds even where the mood pulls darker',
      'Must not look like: ',
    ];
    const positions = order.map((s) => p.indexOf(s));
    expect(
      positions.every((i) => i >= 0),
      p,
    ).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(
      p.startsWith(`Art direction: ${STYLE.fusion}. Render technique: ${STYLE.technique}.`),
    ).toBe(true);
  });

  it('vista plates are empty of people; settlement plates show the kit and small figures', () => {
    const vista = regionPrompt(regionNamed('ninebend'), 'vista', STYLE);
    const town = regionPrompt(regionNamed('ninebend'), 'settlement', STYLE);
    expect(vista).toContain('no people');
    expect(vista).toContain('no user interface');
    expect(town).toContain('kit of repeatable pieces');
    expect(town).toContain('a few small distant figures');
    expect(town).not.toContain('no people');
  });

  it('gameplay plates are the third-person engine frame with one fixed hero and no HUD', () => {
    for (const r of REGIONS) {
      const p = regionPrompt(r, 'gameplay', STYLE);
      expect(p, r.id).toContain('third-person action MMO camera placed behind and above');
      expect(p, r.id).toContain('Graven Arknight');
      expect(p, r.id).toContain('no heads-up display');
      expect(p, r.id).toContain('back to the camera');
    }
  });

  it('rejects an unknown view', () => {
    expect(() => regionPrompt(regionNamed('redmarl'), 'portrait' as never, STYLE)).toThrow(
      /unknown region view: portrait/,
    );
  });

  it('keeps every prompt free of dashes the repo bans and of theonyms', () => {
    const gods = /\b(Nezha|Amaterasu|Quetzalcoatl|Tiamat|Odin|Anubis|Poseidon|Ra|Zeus)\b/;
    for (const j of JOBS) {
      expect(j.prompt, j.id).not.toMatch(/[\u2013\u2014]/);
      expect(j.prompt, j.id).not.toMatch(gods);
    }
  });
});

describe('concept regions: the runner job shape', () => {
  it('is all opaque landscape plates, gameplay frames typed as combat for the web size', () => {
    for (const j of JOBS) {
      expect(j.size, j.id).toBe(SCENE_SIZE);
      expect(j.background, j.id).toBe('opaque');
      expect(j.kind, j.id).toBe(j.view === 'gameplay' ? 'combat' : 'environment');
      expect(j.id).toBe(`${j.subject}__${j.view}__${j.style}`);
    }
  });

  it('builds ids the runner can filter with --only', () => {
    expect(regionJobId(regionNamed('weedline'), 'settlement', STYLE)).toBe(
      'weedline__settlement__osrs_genshin',
    );
    expect(new Set(JOBS.map((j) => j.id)).size).toBe(27);
  });
});
