export interface PoseRules {
  minAspect: number;
  maxWidestRowFrac: number;
  minWidestSpan: number;
}
export interface PoseBbox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
export interface PoseMeasure {
  width: number;
  height: number;
  bbox: PoseBbox | null;
  aspect: number;
  widestRow: number | null;
  widestRowFrac: number;
  widestSpan: number;
}
export const POSE_RULES: PoseRules;
export function measurePose(path: string): Promise<PoseMeasure>;
export function poseProblems(measure: PoseMeasure, rules?: PoseRules): string[];
export function checkConceptPose(
  path: string,
  rules?: PoseRules,
): Promise<{ ok: boolean; problems: string[]; measure: PoseMeasure }>;
