import type { PoseBbox } from './concept_pose.d.mts';

export interface ProportionRow {
  id: string;
  path?: string;
  shoulderFrac: number | null;
  crotchFrac: number | null;
}
export interface ProportionMeasure {
  bbox: PoseBbox | null;
  shoulderFrac: number | null;
  crotchFrac: number | null;
}
export function measureProportions(path: string): Promise<ProportionMeasure>;
export function proportionProblems(rows: ProportionRow[], tolerance?: number): string[];
export function buildContactSheet(
  plates: { id: string; path: string }[],
  outPath: string,
  options?: { columns?: number; cellHeight?: number; label?: boolean },
): Promise<{ rows: ProportionRow[]; outPath: string }>;
