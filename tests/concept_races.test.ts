import { describe, expect, it } from 'vitest';
import {
  buildRaceBodyJobs,
  buildRaceLookJobs,
  buildRaceSheetJobs,
  CHOSEN_STYLE_ID,
  GARMENT_HEX,
  GENDERS,
  LOOKS,
  presetsJson,
  RACES,
  raceBodyJobId,
  styleNamed,
  zonesFor,
} from '../scripts/asset_pipeline/lib/concept_races.mjs';
import { zonesSeparable } from '../scripts/asset_pipeline/lib/concept_tint.mjs';

const THEONYMS = /Nezha|Amaterasu|Quetzalcoatl|Tiamat|Odin|Anubis|Poseidon|\bRa\b|Zeus/;
const HEX = /^#[0-9a-f]{6}$/;

describe('concept_races: the roster', () => {
  it('is the six locked races in faction order, the Risen then the Godborn', () => {
    expect(RACES.map((r) => r.id)).toEqual([
      'human',
      'faithless',
      'horned',
      'firstsworn',
      'ailuran',
      'graven',
    ]);
    expect(RACES.map((r) => r.faction)).toEqual([
      'risen',
      'risen',
      'risen',
      'godborn',
      'godborn',
      'godborn',
    ]);
  });
  it('gives every race a brief, identity marks and a full six by six preset ladder', () => {
    for (const race of RACES) {
      expect(race.cues.length).toBeGreaterThan(60);
      expect(race.marks.length).toBeGreaterThan(10);
      expect(race.presets.skin).toHaveLength(6);
      expect(race.presets.hair).toHaveLength(6);
      for (const hex of [
        ...race.presets.skin,
        ...race.presets.hair,
        race.base.skin,
        race.base.hair,
        race.base.accent,
      ]) {
        expect(hex).toMatch(HEX);
      }
    }
    expect(GARMENT_HEX).toMatch(HEX);
  });
  it('picks base colours the tint gate can tell apart, pairwise, for every race', () => {
    for (const race of RACES) {
      const z = zonesFor(race);
      const names = Object.keys(z) as (keyof typeof z)[];
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          expect(
            zonesSeparable(z[names[i]], z[names[j]]),
            `${race.id}: ${names[i]} vs ${names[j]}`,
          ).toBe(true);
        }
      }
    }
  });
  it('defaults to the locked style and refuses one it does not know', () => {
    expect(CHOSEN_STYLE_ID).toBe('osrs_genshin');
    expect(styleNamed('osrs_genshin').id).toBe('osrs_genshin');
    expect(() => styleNamed('ps1_survival')).toThrow(/unknown style/);
  });
});

describe('concept_races: the prompts', () => {
  const bodies = buildRaceBodyJobs();
  const sheets = buildRaceSheetJobs();
  const looks = buildRaceLookJobs();
  it('builds twelve body jobs, six sheet jobs and ten look jobs with unique filterable ids', () => {
    expect(bodies).toHaveLength(12);
    expect(sheets).toHaveLength(6);
    expect(looks).toHaveLength(10);
    const ids = [...bodies, ...sheets, ...looks].map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(raceBodyJobId(RACES[0], 'female', styleNamed('osrs_genshin'))).toBe(
      'human__female__body__osrs_genshin',
    );
  });
  it('puts the technique first, the T-pose layout in, and forbids weapons and armour in every body prompt', () => {
    for (const job of bodies) {
      expect(
        job.prompt.startsWith(
          'Art direction: a fusion of Old School RuneScape and Genshin Impact. Render technique:',
        ),
      ).toBe(true);
      expect(job.prompt).toContain('standing T-pose with arms out horizontally');
      expect(job.prompt).toContain('no weapon, no shield, no armour, no cloak');
      expect(job.prompt).toMatch(/standard human proportions/);
      expect(job.size).toBe('1024x1024');
      expect(job.background).toBe('transparent');
      expect(job.kind).toBe('character');
    }
  });
  it('names the base skin, hair and garment colours so the plate is tint-ready', () => {
    // biome-ignore lint/style/noNonNullAssertion: brief's test code, verbatim; a missing match throws on the next line anyway.
    const graven = bodies.find((j) => j.id.startsWith('graven__male'))!;
    expect(graven.prompt).toContain('skin exactly the flat colour #7f8388');
    expect(graven.prompt).toContain('hair exactly the flat colour #6e5a4a');
    expect(graven.prompt).toContain(`garment exactly the flat colour ${GARMENT_HEX}`);
  });
  it('sheets show both genders side by side at scene size, opaque', () => {
    for (const job of sheets) {
      expect(job.prompt).toContain(
        'two figures side by side, one male and one female of the same people',
      );
      expect(job.size).toBe('1536x1024');
      expect(job.background).toBe('opaque');
    }
  });
  it('look prompts keep the figure and change only the attire, one per look per gender', () => {
    expect(new Set(looks.map((j) => j.look)).size).toBe(LOOKS.length);
    expect(new Set(looks.map((j) => j.gender)).size).toBe(GENDERS.length);
    for (const job of looks) {
      expect(job.prompt).toContain('Keep the identical character from the input image');
      expect(job.prompt).toContain('Change only the clothing and equipment:');
      expect(job.prompt).toContain('no weapon, no shield, no cloak');
      // biome-ignore lint/style/noNonNullAssertion: job.look is always one of LOOKS' own ids.
      expect(LOOKS.find((l) => l.id === job.look)!.brief).not.toMatch(
        /sword|axe|mace|shield|bow|staff|dagger/i,
      );
    }
  });
  it('keeps every prompt free of dashes the repo bans and of theonyms', () => {
    for (const job of [...bodies, ...sheets, ...looks]) {
      expect(job.prompt).not.toMatch(/[\u2013\u2014]/);
      expect(job.prompt).not.toMatch(THEONYMS);
    }
  });
  it('exports the presets as the character creator will read them', () => {
    const p = presetsJson();
    expect(Object.keys(p)).toEqual(RACES.map((r) => r.id));
    expect(p.human.skin).toHaveLength(6);
  });
});
