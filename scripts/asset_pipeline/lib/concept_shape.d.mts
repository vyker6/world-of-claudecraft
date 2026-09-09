export interface ShapeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface ShapeMeasure {
  bbox: ShapeBox | null;
  aspect: number;
  width: number[];
  offset: number[];
}
export interface ShapeRules {
  minDistance: number;
}
export interface ShapeRow {
  id: string;
  measure: ShapeMeasure;
}
export interface GateResult<M> {
  ok: boolean;
  problems: string[];
  measure: M;
}
export const ICON_SIZE: 128;
export const ASPECT_WEIGHT: number;
export const SHAPE_RULES: ShapeRules;
export function measureShape(path: string): Promise<ShapeMeasure>;
export function shapeDistance(a: ShapeMeasure, b: ShapeMeasure): number;
export function aspectProblems(m: ShapeMeasure, band: [number, number], label: string): string[];
export function checkConceptAspect(
  path: string,
  band: [number, number],
  label: string,
): Promise<GateResult<ShapeMeasure>>;
export function distinctnessProblems(rows: ShapeRow[], rules?: ShapeRules): string[];
export function nearestNeighbours(
  rows: ShapeRow[],
): { id: string; nearest: string | null; distance: number }[];
