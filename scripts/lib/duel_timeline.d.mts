// Type surface for scripts/lib/duel_timeline.mjs (see that file for behavior).
// Mirrors the scripts/*.d.mts convention so tests/duel_timeline.test.ts can
// import the .mjs under strict tsc without an implicit-any error.

export interface ReachMeasure {
  times: number[];
  reach: number[];
  reachY?: number[];
}

export interface DuelFighterInput {
  name: string;
  dir: 1 | -1;
  height: number;
  attackTimeScale: number;
  clips: { Idle: number; Attack: number; Hit: number };
  measures: { Idle: ReachMeasure; Attack: ReachMeasure };
}

export interface DuelSegment {
  clip: 'Idle' | 'Attack' | 'Hit';
  at: number;
  fade: number;
  loop: boolean;
  offset: number;
  timeScale: number;
}

export type DuelSide = 'hero' | 'enemy';

export interface DuelFighter {
  name: string;
  dir: 1 | -1;
  x: number;
  segments: DuelSegment[];
}

export interface DuelStrike {
  frame: number;
  attacker: DuelSide;
  x: number;
  y: number;
  penetration: number;
}

export interface DuelWindow {
  attacker: DuelSide;
  from: number;
  to: number;
}

export interface DuelTimeline {
  fps: number;
  frames: number;
  gap: number;
  fighters: Record<DuelSide, DuelFighter>;
  strikes: DuelStrike[];
  attackWindows: DuelWindow[];
}

export const PENETRATION_FRACTION: number;
export const HOLD_START: number;
export const GAP_BETWEEN: number;
export const HOLD_END: number;
export const FADE_ATTACK: number;
export const FADE_HIT: number;
export const FADE_BACK: number;

export function strikeOf(measure: ReachMeasure): { time: number; reach: number; y: number };
export function idleReach(measure: ReachMeasure): number;
export function buildDuel(input: {
  fps: number;
  hero: DuelFighterInput;
  enemy: DuelFighterInput;
}): DuelTimeline;
