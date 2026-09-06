export type SubjectKind = 'character' | 'environment' | 'combat';
export type ConceptBackground = 'transparent' | 'opaque';

export interface ConceptStyle {
  id: string;
  name: string;
  /** "a fusion of <first IP> and <second IP>", plus which leads when it matters. */
  fusion: string;
  /** The rendering medium and finish; it leads every prompt. */
  technique: string;
  /** Proportions, costume and material language layered on the technique. */
  design: string;
  /** What the style must not collapse into, appended as a negative list. */
  avoid: string;
}

export interface ConceptSubject {
  id: string;
  kind: SubjectKind;
  name: string;
  brief: string;
}

export interface ConceptJob {
  id: string;
  subject: string;
  style: string;
  kind: SubjectKind;
  size: string;
  background: ConceptBackground;
  prompt: string;
}

export const CHARACTER_SIZE: '1024x1536';
export const SCENE_SIZE: '1536x1024';
export const GRIMDARK_CORE: string;
export const STYLES: readonly ConceptStyle[];
export const SUBJECTS: readonly ConceptSubject[];
export function conceptMatrixPrompt(
  subject: ConceptSubject,
  style: ConceptStyle,
  attempt?: number,
): string;
export function jobId(subject: ConceptSubject, style: ConceptStyle): string;
export function buildMatrix(): ConceptJob[];
export function webSizeFor(kind: SubjectKind): { width: number; height: number };
