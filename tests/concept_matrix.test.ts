import { describe, expect, it } from 'vitest';
import {
  buildMatrix,
  CHARACTER_SIZE,
  conceptMatrixPrompt,
  GRIMDARK_CORE,
  jobId,
  SCENE_SIZE,
  STYLES,
  SUBJECTS,
  webSizeFor,
} from '../scripts/asset_pipeline/lib/concept_matrix.mjs';

const JOBS = buildMatrix();
const CHARACTERS = JOBS.filter((j) => j.kind === 'character');
const SCENES = JOBS.filter((j) => j.kind !== 'character');

function subjectNamed(id: string) {
  const s = SUBJECTS.find((x) => x.id === id);
  if (!s) throw new Error(`no subject ${id}`);
  return s;
}

function styleNamed(id: string) {
  const s = STYLES.find((x) => x.id === id);
  if (!s) throw new Error(`no style ${id}`);
  return s;
}

describe('concept matrix: the fixed cast and the five fusions', () => {
  it('is five styles by ten subjects, fifty jobs, subject-major', () => {
    expect(STYLES).toHaveLength(5);
    expect(SUBJECTS).toHaveLength(10);
    expect(JOBS).toHaveLength(50);
    expect(JOBS.slice(0, 5).map((j) => j.subject)).toEqual(Array(5).fill(SUBJECTS[0]?.id));
    expect(JOBS.slice(0, 5).map((j) => j.style)).toEqual(STYLES.map((s) => s.id));
  });

  it('covers three heroes, three enemies, one boss, two environments and one combat frame', () => {
    const ids = SUBJECTS.map((s) => s.id);
    expect(ids.filter((id) => id.startsWith('hero_'))).toHaveLength(3);
    expect(ids.filter((id) => id.startsWith('enemy_'))).toHaveLength(3);
    expect(ids.filter((id) => id.startsWith('boss_'))).toHaveLength(1);
    expect(SUBJECTS.filter((s) => s.kind === 'environment')).toHaveLength(2);
    expect(SUBJECTS.filter((s) => s.kind === 'combat')).toHaveLength(1);
    expect(CHARACTERS).toHaveLength(35);
    expect(SCENES).toHaveLength(15);
  });

  it('gives every job a unique filesystem-safe id and a unique prompt', () => {
    const ids = JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9_]+__[a-z0-9_]+$/);
    expect(new Set(JOBS.map((j) => j.prompt)).size).toBe(50);
    expect(jobId(subjectNamed('hero_reaver'), styleNamed('maple_souls'))).toBe(
      'hero_reaver__maple_souls',
    );
  });

  it('names the fusion once per style and both IPs in the order given', () => {
    const fusions = [
      ['wow_octopath', 'World of Warcraft', 'Octopath Traveler'],
      ['d4_ff', 'Diablo 4', 'Final Fantasy'],
      ['osrs_genshin', 'Old School RuneScape', 'Genshin Impact'],
      ['maple_souls', 'MapleStory', 'Dark Souls'],
      ['ff_d4', 'Final Fantasy', 'Diablo 4'],
    ] as const;
    for (const [id, first, second] of fusions) {
      const style = styleNamed(id);
      expect(style.fusion.startsWith(`a fusion of ${first} and ${second}`)).toBe(true);
      const prompt = conceptMatrixPrompt(subjectNamed('hero_reaver'), style);
      expect(prompt.match(/a fusion of/g)).toHaveLength(1);
    }
    expect(styleNamed('d4_ff').fusion).toContain('Diablo 4 leading');
    expect(styleNamed('ff_d4').fusion).toContain('Final Fantasy leading');
  });

  it('gives every style a technique, a design language and an avoid list, none empty', () => {
    for (const style of STYLES) {
      for (const field of [style.fusion, style.technique, style.design, style.avoid]) {
        expect(field.trim().length).toBeGreaterThan(20);
      }
    }
  });
});

describe('concept matrix: prompts', () => {
  it('leads with the fusion and its render technique, then the subject, then the mood', () => {
    for (const job of JOBS) {
      const style = styleNamed(job.style);
      const brief = subjectNamed(job.subject).brief;
      expect(
        job.prompt.startsWith(
          `Art direction: ${style.fusion}. Render technique: ${style.technique}. `,
        ),
      ).toBe(true);
      expect(job.prompt).toContain(brief);
      expect(job.prompt).toContain(`Design language: ${style.design}.`);
      expect(job.prompt).toContain(`Mood: ${GRIMDARK_CORE}.`);
      expect(job.prompt).toContain(`Must not look like: ${style.avoid}.`);
      const at = (s: string) => job.prompt.indexOf(s);
      expect(at('Render technique:')).toBeLessThan(at(brief));
      expect(at(brief)).toBeLessThan(at('Mood:'));
      expect(at('Mood:')).toBeLessThan(at('Must not look like:'));
    }
  });

  it('keeps the grimdark core to mood: no medium, finish or detail words', () => {
    expect(GRIMDARK_CORE).not.toMatch(/concept art|painterly|render|detailed|realistic|pixel/);
    expect(GRIMDARK_CORE).toContain('grimdark');
  });

  it('renders characters as full-body portrait sheets on a transparent background', () => {
    for (const job of CHARACTERS) {
      expect(job.size).toBe(CHARACTER_SIZE);
      expect(job.background).toBe('transparent');
      expect(job.prompt).toContain('full body');
      expect(job.prompt).toContain('two thirds of the image height');
      expect(job.prompt).toContain('transparent background');
      expect(job.prompt).toContain('no ground shadow');
    }
  });

  it('renders scenes as opaque landscape plates that never ask for transparency', () => {
    for (const job of SCENES) {
      expect(job.size).toBe(SCENE_SIZE);
      expect(job.background).toBe('opaque');
      expect(job.prompt).not.toContain('transparent');
      expect(job.prompt).not.toContain('full body');
    }
  });

  it('keeps people out of the environments and the HUD out of the combat frame', () => {
    for (const job of JOBS.filter((j) => j.kind === 'environment')) {
      expect(job.prompt).toContain('no people');
    }
    const [combat] = JOBS.filter((j) => j.kind === 'combat');
    if (!combat) throw new Error('no combat job');
    expect(combat.prompt).toContain('third-person');
    expect(combat.prompt).toContain('behind and above the hero');
    expect(combat.prompt).toContain('no heads-up display');
  });

  it('adds the pull-back clause on a character retry and never on a scene', () => {
    const reaver = subjectNamed('hero_reaver');
    const style = styleNamed('d4_ff');
    const first = conceptMatrixPrompt(reaver, style);
    const second = conceptMatrixPrompt(reaver, style, 2);
    expect(first).toBe(conceptMatrixPrompt(reaver, style, 1));
    expect(second.startsWith(first)).toBe(true);
    expect(second).toContain('pull the camera much further back');
    expect(first).not.toContain('pull the camera much further back');
    const scene = subjectNamed('env_ninebend');
    expect(conceptMatrixPrompt(scene, style, 3)).toBe(conceptMatrixPrompt(scene, style));
  });

  it('rejects a subject of unknown kind', () => {
    const bad = { ...subjectNamed('env_ninebend'), kind: 'diorama' as 'environment' };
    expect(() => conceptMatrixPrompt(bad, styleNamed('d4_ff'))).toThrow(/unknown subject kind/);
  });

  it('carries no dashes-as-punctuation or emoji into a prompt or a name', () => {
    const text = [
      ...JOBS.map((j) => j.prompt),
      ...STYLES.map((s) => s.name),
      ...SUBJECTS.map((s) => s.name),
    ].join('\n');
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
    expect(text).not.toMatch(dashes);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe('concept matrix: review sizes', () => {
  it('keeps the long edge at review scale for both orientations', () => {
    expect(webSizeFor('character')).toEqual({ width: 768, height: 1152 });
    expect(webSizeFor('environment')).toEqual({ width: 1152, height: 768 });
    expect(webSizeFor('combat')).toEqual({ width: 1152, height: 768 });
  });
});
