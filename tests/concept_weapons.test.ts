import { describe, expect, it } from 'vitest';
import { styleNamed } from '../scripts/asset_pipeline/lib/concept_races.mjs';
import {
  hexToHsv,
  hueDistance,
  zonesSeparable,
} from '../scripts/asset_pipeline/lib/concept_tint.mjs';
import {
  aspectCorrective,
  BASE_COLOURS,
  buildWeaponJobs,
  CORRECTIVE,
  distinctCorrective,
  PILOT_TYPES,
  tintRulesFor,
  typeNamed,
  WEAPON_TYPES,
  weaponJobId,
  weaponPrompt,
  zonesFor,
} from '../scripts/asset_pipeline/lib/concept_weapons.mjs';

const SLUGS = [
  'shortblade',
  'longblade',
  'greatblade',
  'hand_axe',
  'great_axe',
  'mace',
  'maul',
  'spear',
  'shortbow',
  'longbow',
  'stave',
  'rod',
  'round_shield',
  'tower_shield',
  'tome',
  'lantern',
  'instrument',
];
const MATERIAL_WORDS =
  /\b(metal|iron|steel|wood|wooden|leather|hide|cloth|gold|silver|bronze|copper)\b/i;
const COLOUR_WORDS = /\b(red|blue|green|black|white|grey|gray|crimson|violet|cyan)\b/i;
const THEONYMS = /\b(Nezha|Amaterasu|Quetzalcoatl|Tiamat|Odin|Anubis|Poseidon|Ra|Zeus)\b/;

describe('concept_weapons: the 17 types', () => {
  it('is the SYS-items.md 2.1 table in order, three shapes each', () => {
    expect(WEAPON_TYPES.map((t) => t.id)).toEqual(SLUGS);
    for (const t of WEAPON_TYPES) {
      expect(t.shapes).toHaveLength(3);
      expect(new Set(t.shapes.map((s) => s.id)).size).toBe(3);
      expect(t.zones).toContain(t.tierZone);
      expect(t.aspect[0]).toBeLessThan(t.aspect[1]);
      expect(t.length).toBeGreaterThan(0);
      expect(['1H', '2H', 'OH']).toContain(t.hands);
      expect(['side', 'face']).toContain(t.view);
    }
    expect(WEAPON_TYPES.filter((t) => t.hands === 'OH').map((t) => t.id)).toEqual([
      'round_shield',
      'tower_shield',
      'tome',
      'lantern',
      'instrument',
    ]);
  });
  it('carries the locked lengths and tier zones for the types the scale sheet leans on', () => {
    expect(typeNamed('spear').length).toBe(1.15);
    expect(typeNamed('tome').length).toBe(0.18);
    expect(typeNamed('spear').tierZone).toBe('metal');
    expect(typeNamed('longbow').tierZone).toBe('wood');
    expect(typeNamed('tome').tierZone).toBe('cloth');
    expect(typeNamed('spear').tierShare).toBe(0.1);
    expect(() => typeNamed('halberd')).toThrow(/unknown weapon type halberd/);
  });
  it('keeps every shape brief to form words: no material, no colour, no dashes', () => {
    for (const t of WEAPON_TYPES) {
      for (const s of t.shapes) {
        expect(s.brief, `${t.id}/${s.id}`).not.toMatch(MATERIAL_WORDS);
        expect(s.brief, `${t.id}/${s.id}`).not.toMatch(COLOUR_WORDS);
        expect(s.brief).not.toMatch(/[–—]/);
      }
    }
  });
});

describe('concept_weapons: zones and tint rules', () => {
  it('declares six base colours that are pairwise separable under the tint gate', () => {
    const hexes = Object.values(BASE_COLOURS);
    expect(hexes).toHaveLength(6);
    for (let i = 0; i < hexes.length; i++)
      for (let j = i + 1; j < hexes.length; j++)
        expect(zonesSeparable(hexes[i], hexes[j]), `${hexes[i]} vs ${hexes[j]}`).toBe(true);
  });
  it('gives every type its declared zones at the base colours', () => {
    expect(zonesFor(typeNamed('spear'))).toEqual({
      metal: '#8a8f96',
      wood: '#8a6a48',
      fittings: '#4f5a33',
    });
    expect(zonesFor(typeNamed('tome'))).toEqual({
      cloth: '#8a4c96',
      fittings: '#4f5a33',
      accent: '#3ab8b0',
    });
  });
  it('share-gates only the tier zone, at the type floor', () => {
    const rules = tintRulesFor(typeNamed('spear'));
    expect(rules.minShare).toEqual({ metal: 0.1, wood: 0, fittings: 0 });
    expect(rules.maxBaseDistance).toBe(110);
    expect(rules.assign).toBe('hsv');
    expect(rules.gateBaseDistance).toBe('floored');
    expect(tintRulesFor(typeNamed('longblade')).minShare.metal).toBe(0.35);
  });
  it('gives every chromatic zone that shares a type a hue of its own', () => {
    for (const t of WEAPON_TYPES) {
      const zones = zonesFor(t);
      const names = Object.keys(zones);
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = hexToHsv(zones[names[i]]);
          const b = hexToHsv(zones[names[j]]);
          if (a.s < 0.15 || b.s < 0.15) continue;
          expect(
            hueDistance(a.h, b.h),
            `${t.id}: ${names[i]} vs ${names[j]}`,
          ).toBeGreaterThanOrEqual(40);
        }
      }
    }
  });
  it('never puts wood and hide on one type', () => {
    for (const t of WEAPON_TYPES) {
      expect(t.zones.includes('wood') && t.zones.includes('hide'), t.id).toBe(false);
    }
  });
});

describe('concept_weapons: prompts and jobs', () => {
  const style = styleNamed('osrs_genshin');
  it('orders the clauses technique first and names the object, pose, colours and composition', () => {
    const t = typeNamed('longblade');
    const p = weaponPrompt(t, t.shapes[0], style);
    const at = (s: string) => p.indexOf(s);
    expect(at('Art direction:')).toBe(0);
    expect(at('Render technique:')).toBeLessThan(at('Object:'));
    expect(at('Object:')).toBeLessThan(at('Composition:'));
    expect(at('Composition:')).toBeLessThan(at('Design language:'));
    expect(at('Design language:')).toBeLessThan(at('Mood:'));
    expect(at('Mood:')).toBeLessThan(at('Must not look like:'));
    expect(p).toContain(t.shapes[0].brief);
    expect(p).toContain('exactly #8a8f96');
    expect(p).toContain('seen exactly from the side');
    expect(p).toContain('transparent background');
    expect(p).toMatch(/no hand/);
    expect(weaponPrompt(t, t.shapes[0], style)).toContain('three quarters of the image height');
    expect(weaponPrompt(t, t.shapes[0], style)).toContain('no glow around the object');
    expect(weaponPrompt(t, t.shapes[0], style)).not.toContain('plated');
  });
  it('poses face-on types square on and bows with a straight string', () => {
    const shield = typeNamed('round_shield');
    expect(weaponPrompt(shield, shield.shapes[0], style)).toContain('seen square on');
    expect(weaponPrompt(shield, shield.shapes[0], style)).toContain('fully plated in metal');
    const bow = typeNamed('longbow');
    expect(weaponPrompt(bow, bow.shapes[0], style)).toContain('straight vertical line');
  });
  it('appends a corrective only when given, and the correctives name their gate', () => {
    const t = typeNamed('mace');
    const base = weaponPrompt(t, t.shapes[1], style);
    expect(weaponPrompt(t, t.shapes[1], style, CORRECTIVE.framing)).toBe(
      `${base} ${CORRECTIVE.framing}`,
    );
    expect(CORRECTIVE.framing).toMatch(/image edge/);
    expect(CORRECTIVE.tint).toMatch(/flat fill/);
    expect(aspectCorrective(t)).toMatch(/2\.5 to 7 times taller than it is wide/);
    expect(distinctCorrective(t, t.shapes[1], t.shapes[0])).toContain(t.shapes[0].brief);
    expect(distinctCorrective(t, t.shapes[1], t.shapes[0])).toContain(t.shapes[1].brief);
  });
  it('gives the six redesigned types their whole-form shapes', () => {
    expect(typeNamed('round_shield').shapes.map((s) => s.id)).toEqual([
      'boss',
      'teardrop',
      'square',
    ]);
    expect(typeNamed('tower_shield').shapes.map((s) => s.id)).toEqual([
      'rectangular',
      'tapered',
      'flared',
    ]);
    expect(typeNamed('tome').shapes.map((s) => s.id)).toEqual(['codex', 'chained', 'open']);
    expect(typeNamed('mace').shapes.map((s) => s.id)).toEqual(['flanged', 'ball', 'beaked']);
    expect(typeNamed('spear').shapes.map((s) => s.id)).toEqual(['leaf', 'trident', 'hooked']);
    expect(typeNamed('stave').shapes.map((s) => s.id)).toEqual(['gnarled', 'ringed', 'crescent']);
    expect(typeNamed('tome').aspect).toEqual([0.6, 1.7]);
    expect(typeNamed('rod').aspect).toEqual([3, 18]);
    expect(typeNamed('stave').aspect).toEqual([3.5, 20]);
    expect(typeNamed('maul').aspect).toEqual([1.8, 7]);
    expect(typeNamed('lantern').aspect).toEqual([1.0, 3.2]);
    expect(typeNamed('round_shield').aspect).toEqual([0.8, 1.5]);
    expect(typeNamed('rod').tierShare).toBe(0.2);
    expect(typeNamed('stave').tierShare).toBe(0.25);
  });
  it('builds 51 unique jobs the runner can filter, and a nine-job pilot', () => {
    const jobs = buildWeaponJobs();
    expect(jobs).toHaveLength(51);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(51);
    expect(jobs[0].id).toBe('shortblade__dirk__osrs_genshin');
    expect(jobs[0]).toMatchObject({
      subject: 'shortblade',
      shape: 'dirk',
      style: 'osrs_genshin',
      kind: 'object',
      size: '1024x1024',
      background: 'transparent',
    });
    expect(weaponJobId(typeNamed('tome'), typeNamed('tome').shapes[2], style)).toBe(
      'tome__open__osrs_genshin',
    );
    expect(buildWeaponJobs('osrs_genshin', { only: 'round_shield' })).toHaveLength(3);
    const pilot = buildWeaponJobs('osrs_genshin', { pilot: true });
    expect(pilot).toHaveLength(9);
    expect(new Set(pilot.map((j) => j.subject))).toEqual(new Set(PILOT_TYPES));
    expect(() => buildWeaponJobs('osrs_genshin', { only: 'halberd' })).toThrow(/matched no plate/);
  });
  it('keeps every prompt free of dashes the repo bans and of theonyms', () => {
    for (const j of buildWeaponJobs()) {
      expect(j.prompt).not.toMatch(/[–—]/);
      expect(j.prompt).not.toMatch(THEONYMS);
    }
  });
});
