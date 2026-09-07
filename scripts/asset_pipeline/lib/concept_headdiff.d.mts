import type { AlphaBbox } from './concept_silhouette.d.mts';

export interface HeadRules {
  headFrac: number;
  maxMeanDiff: number;
  maxTopShift: number;
}
export interface HeadMeasure {
  meanDiff: number;
  topShift: number;
  headBox: AlphaBbox | null;
}
export const HEAD_RULES: HeadRules;
export function measureHeadDiff(sourcePath: string, dressedPath: string): Promise<HeadMeasure>;
export function headProblems(measure: HeadMeasure, rules?: HeadRules): string[];
export function checkHeadDiff(
  sourcePath: string,
  dressedPath: string,
  rules?: HeadRules,
): Promise<{ ok: boolean; problems: string[]; measure: HeadMeasure }>;
