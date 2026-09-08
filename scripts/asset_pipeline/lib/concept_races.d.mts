import type { ConceptStyle } from './concept_matrix.d.mts';

export type RaceId = 'human' | 'faithless' | 'horned' | 'firstsworn' | 'ailuran' | 'graven';
export type Faction = 'risen' | 'godborn';
export type Gender = 'male' | 'female';
export type LookId = 'cloth' | 'leather' | 'chain' | 'plate' | 'heavy_plate';

export interface ConceptRace {
  id: RaceId;
  faction: Faction;
  name: string;
  cues: string;
  marks: string;
  base: { skin: string; hair: string; accent: string };
  presets: { skin: string[]; hair: string[] };
}
export interface ConceptLook {
  id: LookId;
  name: string;
  brief: string;
}
export interface RaceJob {
  id: string;
  subject: string;
  style: string;
  kind: 'sheet' | 'character';
  size: string;
  background: 'opaque' | 'transparent';
  prompt: string;
  race?: RaceId;
  gender?: Gender;
  look?: LookId;
}
export interface TintZones {
  skin: string;
  hair: string;
  garment: string;
  accent: string;
}

export { CHOSEN_STYLE_ID, styleNamed } from './concept_matrix.d.mts';
export const GENDERS: readonly Gender[];
export const GARMENT_HEX: string;
export const UNDERLAYER: string;
export const BODY_MARGIN_CLAUSE: string;
export const FRAME_SCALE_CLAUSE: string;
export const FIGURE_RULES: string;
export const RACES: readonly ConceptRace[];
export const LOOKS: readonly ConceptLook[];
export const CHARACTER_SIZE: string;
export function zonesFor(race: ConceptRace): TintZones;
export function sheetPrompt(race: ConceptRace, style: ConceptStyle): string;
export function bodyPrompt(
  race: ConceptRace,
  gender: Gender,
  style: ConceptStyle,
  attempt?: number,
  corrective?: string,
): string;
export function lookPrompt(look: ConceptLook, style: ConceptStyle, attempt?: number): string;
export function raceSheetJobId(race: ConceptRace, style: ConceptStyle): string;
export function raceBodyJobId(race: ConceptRace, gender: Gender, style: ConceptStyle): string;
export function raceLookJobId(look: ConceptLook, gender: Gender, style: ConceptStyle): string;
export function buildRaceSheetJobs(styleId?: string): RaceJob[];
export function buildRaceBodyJobs(styleId?: string): RaceJob[];
export function buildRaceLookJobs(styleId?: string): RaceJob[];
export function presetsJson(): Record<RaceId, { skin: string[]; hair: string[] }>;
