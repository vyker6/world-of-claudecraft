import { describe, expect, it } from 'vitest';
import type { DuelFighterInput, DuelSide, DuelTimeline } from '../scripts/lib/duel_timeline.mjs';
import {
  buildDuel,
  FADE_BACK,
  GAP_BETWEEN,
  HOLD_START,
  idleReach,
  PENETRATION_FRACTION,
  strikeOf,
} from '../scripts/lib/duel_timeline.mjs';

const HZ = 60;

// A reach curve sampled at HZ over `duration`, shaped by f(t) (world units).
function curve(duration: number, f: (t: number) => number, y = 1) {
  const n = Math.ceil(duration * HZ) + 1;
  const times = Array.from({ length: n }, (_, i) => Math.min(duration, i / HZ));
  return { times, reach: times.map(f), reachY: times.map(() => y) };
}

// A swing that peaks at `peak` seconds and comes back down, one sample wide at
// the top so the argmax is unambiguous.
function swing(duration: number, peak: number, base: number, top: number) {
  return curve(duration, (t) => base + (top - base) * Math.max(0, 1 - Math.abs(t - peak) / 0.4));
}

function fighter(over: Partial<DuelFighterInput> = {}): DuelFighterInput {
  return {
    name: 'hero',
    dir: 1,
    height: 2.5,
    attackTimeScale: 5,
    clips: { Idle: 12.3, Attack: 6.6, Hit: 1.333 },
    measures: {
      Idle: curve(12.3, (t) => 0.5 + 0.05 * Math.sin(t)),
      Attack: swing(6.6, 2.0, 0.55, 1.5),
    },
    ...over,
  };
}

const HERO = fighter();
const ENEMY = fighter({
  name: 'enemy',
  dir: -1,
  height: 2.6,
  attackTimeScale: 4,
  clips: { Idle: 15.4, Attack: 5.3, Hit: 1.333 },
  measures: {
    Idle: curve(15.4, (t) => 0.45 + 0.03 * Math.cos(t)),
    Attack: swing(5.3, 1.5, 0.6, 1.4),
  },
});

function duel(): DuelTimeline {
  return buildDuel({ fps: 14, hero: HERO, enemy: ENEMY });
}

function segmentsOf(t: DuelTimeline, side: DuelSide, clip: string) {
  return t.fighters[side].segments.filter((s) => s.clip === clip);
}

describe('strikeOf', () => {
  it('returns the first sample at the maximum reach', () => {
    const m = { times: [0, 1, 2, 3, 4], reach: [0.1, 0.9, 0.9, 0.5, 0.1], reachY: [1, 2, 3, 4, 5] };
    expect(strikeOf(m)).toEqual({ time: 1, reach: 0.9, y: 2 });
  });

  it('rejects an empty measure and a flat curve', () => {
    expect(() => strikeOf({ times: [], reach: [] })).toThrow(/empty/);
    expect(() => strikeOf({ times: [0, 1, 2], reach: [0.4, 0.4, 0.4] })).toThrow(/flat/);
  });

  it('rejects mismatched sample arrays', () => {
    expect(() => strikeOf({ times: [0, 1], reach: [0.1] })).toThrow(/same length/);
  });
});

describe('idleReach', () => {
  it('is the median reach, so a single extreme does not move it', () => {
    expect(idleReach({ times: [0, 1, 2, 3], reach: [0.4, 0.5, 0.6, 9] })).toBeCloseTo(0.55);
    expect(idleReach({ times: [0, 1, 2], reach: [0.6, 9, 0.4] })).toBeCloseTo(0.6);
  });
});

describe('buildDuel', () => {
  it('spaces the fighters so the deeper strike lands PENETRATION_FRACTION in', () => {
    const t = duel();
    const [heroStrike, enemyStrike] = t.strikes;
    if (!heroStrike || !enemyStrike) throw new Error('expected two strikes');
    const deeper = Math.max(heroStrike.penetration, enemyStrike.penetration);
    const targetHeight = heroStrike.penetration >= enemyStrike.penetration ? 2.6 : 2.5;
    expect(deeper).toBeCloseTo(PENETRATION_FRACTION * targetHeight, 6);
    expect(Math.min(heroStrike.penetration, enemyStrike.penetration)).toBeGreaterThan(0);
    expect(t.fighters.hero.x).toBeCloseTo(-t.gap / 2);
    expect(t.fighters.enemy.x).toBeCloseTo(t.gap / 2);
  });

  it('puts the contact point at the strike reach on the attacking side', () => {
    const t = duel();
    const hero = strikeOf(HERO.measures.Attack);
    const enemy = strikeOf(ENEMY.measures.Attack);
    expect(t.strikes[0]?.x).toBeCloseTo(t.fighters.hero.x + hero.reach);
    expect(t.strikes[1]?.x).toBeCloseTo(t.fighters.enemy.x - enemy.reach);
    expect(t.strikes[0]?.y).toBe(hero.y);
  });

  it('starts the Hit of the defender on the frame the swing reaches farthest', () => {
    const t = duel();
    const heroAttack = segmentsOf(t, 'hero', 'Attack')[0];
    const enemyHit = segmentsOf(t, 'enemy', 'Hit')[0];
    if (!heroAttack || !enemyHit) throw new Error('missing segments');
    expect(heroAttack.at).toBeGreaterThanOrEqual(HOLD_START);
    expect(heroAttack.at).toBeLessThan(HOLD_START + 1 / 14);
    expect(heroAttack.timeScale).toBe(5);
    const strikeAt = heroAttack.at + strikeOf(HERO.measures.Attack).time / 5;
    expect(enemyHit.at).toBeCloseTo(strikeAt);
    expect(enemyHit.timeScale).toBe(1);
    expect(t.strikes[0]?.frame).toBe(Math.round(strikeAt * 14));
    expect(t.strikes[0]?.attacker).toBe('hero');
  });

  it('lands every strike exactly on a frame, delaying the swing rather than rounding', () => {
    const t = duel();
    const unsnapped = HOLD_START + strikeOf(HERO.measures.Attack).time / 5;
    expect(Math.abs(unsnapped * 14 - Math.round(unsnapped * 14))).toBeGreaterThan(0.01);
    for (const [i, side] of (['hero', 'enemy'] as const).entries()) {
      const attack = segmentsOf(t, side, 'Attack')[0];
      const hit = segmentsOf(t, side === 'hero' ? 'enemy' : 'hero', 'Hit')[0];
      const strike = t.strikes[i];
      if (!attack || !hit || !strike) throw new Error('missing segments');
      expect(hit.at * 14).toBeCloseTo(strike.frame, 9);
      const input = side === 'hero' ? HERO : ENEMY;
      const peak = strikeOf(input.measures.Attack).time / input.attackTimeScale;
      expect(attack.at + peak).toBeCloseTo(hit.at, 9);
    }
  });

  it('waits until both fighters are back on Idle before the enemy answers', () => {
    const t = duel();
    const enemyAttack = segmentsOf(t, 'enemy', 'Attack')[0];
    const heroBack = segmentsOf(t, 'hero', 'Idle')[1];
    const enemyBack = segmentsOf(t, 'enemy', 'Idle')[1];
    if (!enemyAttack || !heroBack || !enemyBack) throw new Error('missing segments');
    const settled = Math.max(heroBack.at + FADE_BACK, enemyBack.at + FADE_BACK);
    expect(enemyAttack.at).toBeGreaterThanOrEqual(settled + GAP_BETWEEN - 1e-9);
    expect(enemyAttack.at).toBeLessThan(settled + GAP_BETWEEN + 1 / 14);
    expect(t.strikes[1]?.attacker).toBe('enemy');
    expect(t.strikes[1]?.frame).toBeGreaterThan(t.strikes[0]?.frame ?? 0);
  });

  it('never plays the same clip twice in a row and starts and ends on Idle', () => {
    const t = duel();
    for (const side of ['hero', 'enemy'] as const) {
      const segs = t.fighters[side].segments;
      expect(segs[0]).toMatchObject({ clip: 'Idle', at: 0, offset: 0, loop: true });
      expect(segs.at(-1)?.clip).toBe('Idle');
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i]?.clip).not.toBe(segs[i - 1]?.clip);
        expect(segs[i]?.at).toBeGreaterThan(segs[i - 1]?.at ?? 0);
      }
    }
    expect(t.fighters.hero.segments.map((s) => s.clip)).toEqual([
      'Idle',
      'Attack',
      'Idle',
      'Hit',
      'Idle',
    ]);
    expect(t.fighters.enemy.segments.map((s) => s.clip)).toEqual([
      'Idle',
      'Hit',
      'Idle',
      'Attack',
      'Idle',
    ]);
  });

  it('phases every later Idle so the clip is at time 0 on the loop point', () => {
    const t = duel();
    const total = t.frames / t.fps;
    for (const side of ['hero', 'enemy'] as const) {
      const d = side === 'hero' ? HERO.clips.Idle : ENEMY.clips.Idle;
      for (const seg of segmentsOf(t, side, 'Idle').slice(1)) {
        const phaseAtLoop = (seg.offset + (total - seg.at)) % d;
        expect(Math.min(phaseAtLoop, d - phaseAtLoop)).toBeLessThan(1e-9);
        expect(seg.offset).toBeGreaterThanOrEqual(0);
        expect(seg.offset).toBeLessThan(d);
      }
    }
  });

  it('ends after the last fighter has settled back on Idle', () => {
    const t = duel();
    const total = t.frames / t.fps;
    for (const side of ['hero', 'enemy'] as const) {
      const last = t.fighters[side].segments.at(-1);
      if (!last) throw new Error('no segments');
      expect(last.at + last.fade).toBeLessThan(total);
    }
    expect(t.frames).toBe(Math.ceil(total * t.fps));
  });

  it('marks the frames each attacker must be drawn on top', () => {
    const t = duel();
    expect(t.attackWindows).toHaveLength(2);
    for (const [i, side] of (['hero', 'enemy'] as const).entries()) {
      const attack = segmentsOf(t, side, 'Attack')[0];
      const win = t.attackWindows[i];
      if (!attack || !win) throw new Error('missing window');
      expect(win.attacker).toBe(side);
      expect(win.from).toBe(Math.floor(attack.at * t.fps));
      const input = side === 'hero' ? HERO : ENEMY;
      const end = attack.at + input.clips.Attack / input.attackTimeScale;
      expect(win.to).toBe(Math.ceil(end * t.fps));
      expect(t.strikes[i]?.frame).toBeGreaterThanOrEqual(win.from);
      expect(t.strikes[i]?.frame).toBeLessThanOrEqual(win.to);
    }
  });

  it('rejects fighters that do not face each other', () => {
    expect(() => buildDuel({ fps: 14, hero: HERO, enemy: fighter({ name: 'twin' }) })).toThrow(
      /face each other/,
    );
  });

  it('rejects a missing clip, a missing measure and a bad frame rate', () => {
    const noHit = fighter({ clips: { Idle: 12.3, Attack: 6.6, Hit: 0 } });
    expect(() => buildDuel({ fps: 14, hero: noHit, enemy: ENEMY })).toThrow(/hero: missing Hit/);
    const noMeasure = { ...fighter(), measures: { Idle: HERO.measures.Idle } };
    expect(() =>
      buildDuel({ fps: 14, hero: HERO, enemy: noMeasure as unknown as DuelFighterInput }),
    ).toThrow(/enemy Attack/);
    expect(() => buildDuel({ fps: 0, hero: HERO, enemy: ENEMY })).toThrow(/fps/);
  });

  it('rejects an Attack clip whose reach never moves', () => {
    const still = fighter({ measures: { ...HERO.measures, Attack: curve(6.6, () => 0.5) } });
    expect(() => buildDuel({ fps: 14, hero: still, enemy: ENEMY })).toThrow(/flat/);
  });
});
