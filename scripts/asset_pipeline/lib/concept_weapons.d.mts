import type { ConceptStyle } from './concept_matrix.d.mts';

export type WeaponZone = 'metal' | 'wood' | 'hide' | 'cloth' | 'fittings' | 'accent';
export type WeaponTypeId =
  | 'shortblade'
  | 'longblade'
  | 'greatblade'
  | 'hand_axe'
  | 'great_axe'
  | 'mace'
  | 'maul'
  | 'spear'
  | 'shortbow'
  | 'longbow'
  | 'stave'
  | 'rod'
  | 'round_shield'
  | 'tower_shield'
  | 'tome'
  | 'lantern'
  | 'instrument';
export interface WeaponShape {
  id: string;
  brief: string;
}
export interface WeaponType {
  id: WeaponTypeId;
  name: string;
  subject: string;
  hands: '1H' | '2H' | 'OH';
  view: 'side' | 'face';
  poseNote: string;
  tierZone: WeaponZone;
  zones: readonly WeaponZone[];
  length: number;
  aspect: [number, number];
  tierShare: number;
  shapes: [WeaponShape, WeaponShape, WeaponShape];
}
export interface WeaponJob {
  id: string;
  subject: WeaponTypeId;
  shape: string;
  style: string;
  kind: 'object';
  size: '1024x1024';
  background: 'transparent';
  prompt: string;
}
// concept_tint.d.mts's TintRules pins minShare to the race zones (skin/hair/garment/accent),
// so a weapon's zones (metal/wood/hide/cloth/fittings/accent) cannot reuse that type here; this
// is the same shape with a general minShare instead.
export interface WeaponTintRules {
  minShare: Record<string, number>;
  maxBaseDistance: number;
  hueGap: number;
  satGap: number;
  valGap: number;
  minSatForHue: number;
}
export const BASE_COLOURS: Record<WeaponZone, string>;
export const PILOT_TYPES: readonly WeaponTypeId[];
export const WEAPON_TYPES: readonly WeaponType[];
export const CORRECTIVE: { framing: string; tint: string };
export const CHOSEN_STYLE_ID: 'osrs_genshin';
export function styleNamed(styleId: string): ConceptStyle;
export function typeNamed(id: string): WeaponType;
export function zonesFor(type: WeaponType): Record<string, string>;
export function tintRulesFor(type: WeaponType): WeaponTintRules;
export function weaponPrompt(
  type: WeaponType,
  shape: WeaponShape,
  style: ConceptStyle,
  corrective?: string,
): string;
export function aspectCorrective(type: WeaponType): string;
export function distinctCorrective(
  type: WeaponType,
  shape: WeaponShape,
  sibling: WeaponShape,
): string;
export function weaponJobId(type: WeaponType, shape: WeaponShape, style: ConceptStyle): string;
export function buildWeaponJobs(
  styleId?: string,
  opts?: { only?: string; pilot?: boolean },
): WeaponJob[];
