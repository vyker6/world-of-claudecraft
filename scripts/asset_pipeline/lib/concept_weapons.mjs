// The weapon types concept round: the 17 weapon and off-hand types of SYS-items.md section
// 2.1, copied verbatim (slug, hands, tier zone, fixed zones, length), with the view, aspect
// band, tier share floor and three shape briefs the spec adds, the six base colours, and the
// prompt and job builders the plate runner uses. Pure: no I/O, no network.
//
// Why the prompts read the way they do: gpt-image-2 obeys the first rendering instruction
// literally, so the fusion and technique come before the object (the matrix's proven order).
// Every plate names its zone colours as exact flat fills because the tier is a recolour of one
// zone downstream; a plate whose grip drifts into the blade's colour cannot carry a tier.
// Shape briefs are form words only: material and colour belong to the zones and the tier.
import { GRIMDARK_CORE } from './concept_matrix.mjs';
import { CHOSEN_STYLE_ID, styleNamed } from './concept_races.mjs';
import { TINT_RULES } from './concept_tint.mjs';

export { CHOSEN_STYLE_ID, styleNamed };

// Wood and hide share a hue and therefore never share a type; every other chromatic zone has a
// hue of its own so the hsv assignment keeps a zone's shading inside the zone; metal is the one
// achromatic zone. Fittings sits at hue 77 (olive bronze), away from the cool hue (slate, around
// 216 to 219) that cel-shaded metal shading drifts toward in shadow.
export const BASE_COLOURS = Object.freeze({
  metal: '#8a8f96',
  wood: '#8a6a48',
  hide: '#b09a80',
  cloth: '#8a4c96',
  fittings: '#4f5a33',
  accent: '#3ab8b0',
});

const ZONE_WORDS = Object.freeze({
  metal: 'every metal part',
  wood: 'every wooden part',
  hide: 'every hide or leather wrapping',
  cloth: 'every cloth part',
  fittings: 'the fittings, rivets and bindings',
  accent: 'the accent, used only for gems, glass, strings and inlay,',
});

export const PILOT_TYPES = Object.freeze(['longblade', 'round_shield', 'longbow']);

const BLADE_ZONES = Object.freeze(['metal', 'fittings', 'hide']);
const HAFTED_ZONES = Object.freeze(['metal', 'wood', 'fittings']);
const BOW_ZONES = Object.freeze(['wood', 'fittings', 'cloth']);
const CASTER_ZONES = Object.freeze(['wood', 'fittings', 'accent']);
const SHIELD_ZONES = Object.freeze(['metal', 'wood', 'fittings']); // the grip is on the back of
// a face-on shield; hide is dropped so wood and hide never share a type

const side = (t) => ({ view: 'side', poseNote: '', materialNote: '', ...t });
const face = (t) => ({ view: 'face', poseNote: '', materialNote: '', ...t });

export const WEAPON_TYPES = Object.freeze([
  side({
    id: 'shortblade',
    name: 'Shortblade',
    subject: 'short dagger',
    hands: '1H',
    tierZone: 'metal',
    zones: BLADE_ZONES,
    length: 0.22,
    aspect: [2.5, 7],
    tierShare: 0.35,
    shapes: [
      {
        id: 'dirk',
        brief:
          'a straight narrow double-edged blade, a short straight crossguard and a round pommel',
      },
      {
        id: 'curved',
        brief: 'a single-edged blade curving to a hooked point, no guard, a wrapped grip',
      },
      {
        id: 'leaf',
        brief:
          'a broad leaf-shaped blade widest a third from the tip, a short ricasso and a ' +
          'disc pommel',
      },
    ],
  }),
  side({
    id: 'longblade',
    name: 'Longblade',
    subject: 'one-handed sword',
    hands: '1H',
    tierZone: 'metal',
    zones: BLADE_ZONES,
    length: 0.52,
    aspect: [3, 9],
    tierShare: 0.35,
    shapes: [
      {
        id: 'cruciform',
        brief: 'a straight double-edged arming sword with a straight crossguard and a wheel pommel',
      },
      {
        id: 'falchion',
        brief:
          'a single-edged blade broadening toward a clipped tip, with a short down-curved guard',
      },
      {
        id: 'leaf',
        brief: 'a broad leaf blade tapering to a point, with an oval guard and a disc pommel',
      },
    ],
  }),
  side({
    id: 'greatblade',
    name: 'Greatblade',
    subject: 'two-handed greatsword',
    hands: '2H',
    tierZone: 'metal',
    zones: BLADE_ZONES,
    length: 0.85,
    aspect: [3.5, 10],
    tierShare: 0.35,
    shapes: [
      {
        id: 'straight',
        brief:
          'a long straight two-hander with a long two-hand grip, a wide crossguard with a ' +
          'side ring and a scent-stopper pommel',
      },
      {
        id: 'curved',
        brief:
          'a long single-edged two-hander with a gentle curve, a small oval guard and a long grip',
      },
      {
        id: 'flame',
        brief: 'a wavy-edged two-hander with a pair of parrying hooks above the guard',
      },
    ],
  }),
  side({
    id: 'hand_axe',
    name: 'Hand Axe',
    subject: 'one-handed axe',
    hands: '1H',
    tierZone: 'metal',
    zones: HAFTED_ZONES,
    length: 0.36,
    aspect: [1.5, 4],
    tierShare: 0.2,
    shapes: [
      { id: 'bearded', brief: 'a narrow head with a long drooping beard on a straight haft' },
      { id: 'broad', brief: 'a wide crescent head on a short haft' },
      {
        id: 'spiked',
        brief: 'a compact head with a rear spike on a thick haft with a flared butt',
      },
    ],
  }),
  side({
    id: 'great_axe',
    name: 'Great Axe',
    subject: 'two-handed battle axe',
    hands: '2H',
    tierZone: 'metal',
    zones: HAFTED_ZONES,
    length: 0.75,
    aspect: [1.8, 5],
    tierShare: 0.2,
    shapes: [
      { id: 'crescent', brief: 'one huge crescent blade on a long haft' },
      { id: 'double', brief: 'a symmetric double-bit head on a long haft' },
      { id: 'poleaxe', brief: 'a narrow blade with a top spike and a rear hammer on a long haft' },
    ],
  }),
  side({
    id: 'mace',
    name: 'Mace',
    subject: 'one-handed mace',
    hands: '1H',
    tierZone: 'metal',
    zones: BLADE_ZONES,
    length: 0.38,
    aspect: [2.5, 7],
    tierShare: 0.35,
    shapes: [
      { id: 'flanged', brief: 'a cylindrical head of vertical flanges on a short haft' },
      { id: 'ball', brief: 'a round knobbed ball head on a short haft' },
      { id: 'block', brief: 'a square block head with cornered studs on a short haft' },
    ],
  }),
  side({
    id: 'maul',
    name: 'Maul',
    subject: 'two-handed war hammer',
    hands: '2H',
    tierZone: 'metal',
    zones: HAFTED_ZONES,
    length: 0.72,
    aspect: [2.5, 7],
    tierShare: 0.25,
    shapes: [
      { id: 'sledge', brief: 'a heavy rectangular sledge head on a long haft' },
      { id: 'spiked', brief: 'a round spiked ball head on a long haft' },
      { id: 'bell', brief: 'a flared bell-shaped head on a long haft' },
    ],
  }),
  side({
    id: 'spear',
    name: 'Spear',
    subject: 'spear',
    hands: '2H',
    tierZone: 'metal',
    zones: HAFTED_ZONES,
    length: 1.15,
    aspect: [6, 25],
    tierShare: 0.1,
    shapes: [
      { id: 'leaf', brief: 'a broad leaf-shaped head on a plain shaft' },
      {
        id: 'pike',
        brief: 'a long narrow needle head with a small cross-bar below it on a plain shaft',
      },
      { id: 'winged', brief: 'a wide head with two side lugs at its base on a plain shaft' },
    ],
  }),
  side({
    id: 'shortbow',
    name: 'Shortbow',
    subject: 'short bow',
    hands: '2H',
    poseNote: 'its bowstring drawn as one straight vertical line',
    tierZone: 'wood',
    zones: BOW_ZONES,
    length: 0.65,
    aspect: [2.5, 7],
    tierShare: 0.35,
    shapes: [
      { id: 'flat', brief: 'wide flat limbs in a single shallow D curve' },
      { id: 'recurve', brief: 'limbs curving back sharply at the tips' },
      { id: 'siyah', brief: 'a composite bow with angular set-back tips and a set-back grip' },
    ],
  }),
  side({
    id: 'longbow',
    name: 'Longbow',
    subject: 'longbow',
    hands: '2H',
    poseNote: 'its bowstring drawn as one straight vertical line',
    tierZone: 'wood',
    zones: BOW_ZONES,
    length: 1.0,
    aspect: [4, 12],
    tierShare: 0.35,
    shapes: [
      { id: 'war', brief: 'a tall straight D-section stave with plain tips' },
      { id: 'recurve', brief: 'a tall bow with recurved tips and a shaped grip' },
      { id: 'yumi', brief: 'a very tall asymmetric bow with the grip below centre' },
    ],
  }),
  side({
    id: 'stave',
    name: 'Stave',
    subject: 'two-handed staff',
    hands: '2H',
    tierZone: 'wood',
    zones: CASTER_ZONES,
    length: 1.05,
    aspect: [6, 20],
    tierShare: 0.35,
    shapes: [
      { id: 'gnarled', brief: 'a twisted natural staff with a knot head' },
      { id: 'ringed', brief: 'a straight staff topped by a heavy ring headpiece' },
      { id: 'crescent', brief: 'a staff topped by a forked crescent head holding a gem' },
    ],
  }),
  side({
    id: 'rod',
    name: 'Rod',
    subject: 'short wand',
    hands: '1H',
    tierZone: 'wood',
    zones: CASTER_ZONES,
    length: 0.25,
    aspect: [3, 10],
    tierShare: 0.35,
    shapes: [
      { id: 'wand', brief: 'a slender tapered wand, plain' },
      { id: 'sceptre', brief: 'a short rod with a heavy orb head' },
      { id: 'crook', brief: 'a short rod ending in a tight hook' },
    ],
  }),
  face({
    id: 'round_shield',
    name: 'Round Shield',
    subject: 'round shield',
    hands: 'OH',
    tierZone: 'metal',
    zones: SHIELD_ZONES,
    length: 0.4,
    aspect: [0.8, 1.25],
    tierShare: 0.35,
    materialNote:
      'its face fully plated in metal over a wooden core, the metal the largest surface',
    shapes: [
      { id: 'boss', brief: 'a plain circle with a central boss and radial bands' },
      { id: 'octagonal', brief: 'a flat-faced octagon with a rim' },
      { id: 'scalloped', brief: 'a circle with a scalloped rim and a small boss' },
    ],
  }),
  face({
    id: 'tower_shield',
    name: 'Tower Shield',
    subject: 'tall tower shield',
    hands: 'OH',
    tierZone: 'metal',
    zones: SHIELD_ZONES,
    length: 0.75,
    aspect: [1.4, 2.6],
    tierShare: 0.35,
    materialNote:
      'its face fully plated in metal over a wooden core, the metal the largest surface',
    shapes: [
      { id: 'rectangular', brief: 'a tall flat rectangle with rounded corners' },
      { id: 'tapered', brief: 'a tall shield narrowing to a point at the bottom' },
      {
        id: 'notched',
        brief: 'a tall shield with a central vertical ridge and a notched top edge',
      },
    ],
  }),
  face({
    id: 'tome',
    name: 'Tome',
    subject: 'spellbook',
    hands: 'OH',
    tierZone: 'cloth',
    zones: Object.freeze(['cloth', 'fittings', 'accent']),
    length: 0.18,
    aspect: [0.9, 1.7],
    tierShare: 0.35,
    shapes: [
      { id: 'codex', brief: 'a tall thin book with a plain cover and a spine band' },
      { id: 'grimoire', brief: 'a thick near-square book with corner caps and two clasps' },
      { id: 'chained', brief: 'a thick book bound in a chain with a hanging lock' },
    ],
  }),
  face({
    id: 'lantern',
    name: 'Lantern',
    subject: 'hand lantern',
    hands: 'OH',
    tierZone: 'metal',
    zones: Object.freeze(['metal', 'accent', 'hide']),
    length: 0.22,
    aspect: [1.1, 2.6],
    tierShare: 0.3,
    shapes: [
      { id: 'caged', brief: 'a square cage lantern with a ring handle' },
      { id: 'hooded', brief: 'a cylindrical lantern with a conical hood and a hanging loop' },
      { id: 'censer', brief: 'a hanging bowl censer on three short chains' },
    ],
  }),
  face({
    id: 'instrument',
    name: 'Instrument',
    subject: 'musical instrument',
    hands: 'OH',
    tierZone: 'wood',
    zones: Object.freeze(['wood', 'fittings', 'cloth']),
    length: 0.42,
    aspect: [1.0, 3.5],
    tierShare: 0.35,
    shapes: [
      { id: 'lute', brief: 'a round-backed lute with a bent-back pegbox' },
      { id: 'lyre', brief: 'a U-shaped lyre with a crossbar and strings' },
      { id: 'horn', brief: 'a curved horn with a flared bell' },
    ],
  }),
]);

/** The declared type for a slug, or throws when the slug is not one of the 17. */
export function typeNamed(id) {
  const t = WEAPON_TYPES.find((w) => w.id === id);
  if (!t)
    throw new Error(
      `unknown weapon type ${id}; one of ${WEAPON_TYPES.map((w) => w.id).join(', ')}`,
    );
  return t;
}

/** The declared zone hexes the tint gate and the recolour read for a type. */
export function zonesFor(type) {
  return Object.fromEntries(type.zones.map((z) => [z, BASE_COLOURS[z]]));
}

/** The tint rules for a type: the tier zone share-gated at the type floor, fixed zones at 0.
 *  Fixed zones are also freed from the base-distance check (gateBaseDistance: 'floored'), since
 *  a fixed zone's exact colour is never consumed downstream and only needs to stay separable. */
export function tintRulesFor(type) {
  const minShare = Object.fromEntries(
    type.zones.map((z) => [z, z === type.tierZone ? type.tierShare : 0]),
  );
  return { ...TINT_RULES, assign: 'hsv', gateBaseDistance: 'floored', minShare };
}

const SIDE_POSE =
  'standing exactly vertical with the grip or butt at the bottom and the working end at the ' +
  'top, seen exactly from the side';
const FACE_POSE = 'standing upright and seen square on, its face toward the camera';
const OBJECT_LAYOUT =
  'a single object alone, centered, the whole object in frame, transparent background, even ' +
  'diffuse studio lighting, crisp silhouette, no halos or fringing, no glow around the object, ' +
  'no drop shadow, no hand, no figure, no ground, no scabbard, no second object, no text, ' +
  'no watermark, no logo';
const OBJECT_SCALE =
  'the camera pulled back so the object occupies about three quarters of the image height, ' +
  'centered, with clear empty background of at least one tenth of the image height above its ' +
  'top and below its bottom';

function colourClause(type) {
  const parts = type.zones.map((z) => `${ZONE_WORDS[z]} exactly ${BASE_COLOURS[z]}`);
  return (
    'painted as exact flat fills with the two-tone shadow of the technique and no gradients, ' +
    `each material one clearly distinct colour: ${parts.join(', ')}`
  );
}

/** The full concept plate prompt for one type, shape and style, with an optional corrective. */
export function weaponPrompt(type, shape, style, corrective = '') {
  const pose = [type.view === 'side' ? SIDE_POSE : FACE_POSE, type.poseNote]
    .filter(Boolean)
    .join(', ');
  const materialClause = type.materialNote ? `, ${type.materialNote}` : '';
  return (
    `Art direction: ${style.fusion}. Render technique: ${style.technique}. ` +
    `Object: one ${type.subject} for a fantasy game, ${shape.brief}${materialClause}; ${pose}; ` +
    `${colourClause(type)}. ` +
    `Composition: ${OBJECT_LAYOUT}, ${OBJECT_SCALE}. Design language: ${style.design}. ` +
    `Mood: ${GRIMDARK_CORE}. Must not look like: ${style.avoid}.` +
    (corrective ? ` ${corrective}` : '')
  );
}

export const CORRECTIVE = Object.freeze({
  framing:
    'The previous render touched the image edge: make the object smaller so it fills about ' +
    'four fifths of the image height, centered, with clear background beyond every tip.',
  tint:
    'The previous render used the wrong colours: paint each material as one exact flat fill ' +
    'of the colour named in this prompt, with no gradients, so each material is one clearly ' +
    'distinct colour.',
});

/** A retry corrective naming the type's locked aspect band, for the wrong proportions. */
export function aspectCorrective(type) {
  const [lo, hi] = type.aspect;
  return (
    `The previous render had the wrong proportions for a ${type.subject}: in this view it must ` +
    `be ${lo} to ${hi} times taller than it is wide.`
  );
}

/** A retry corrective naming the sibling shape a render was confused with, for a redo. */
export function distinctCorrective(type, shape, sibling) {
  return (
    `The previous render looked the same in outline as this ${type.subject}'s ${sibling.id} ` +
    `shape (${sibling.brief}); this is the ${shape.id} shape and its outline must read ` +
    `clearly different: ${shape.brief}.`
  );
}

/** The stable id a plate's file and manifest entry are keyed by. */
export function weaponJobId(type, shape, style) {
  return `${type.id}__${shape.id}__${style.id}`;
}

/** Every plate job for a style, optionally filtered by id substring or narrowed to the pilot. */
export function buildWeaponJobs(styleId = CHOSEN_STYLE_ID, { only = '', pilot = false } = {}) {
  const style = styleNamed(styleId);
  const types = pilot ? WEAPON_TYPES.filter((t) => PILOT_TYPES.includes(t.id)) : WEAPON_TYPES;
  const jobs = [];
  for (const type of types) {
    for (const shape of type.shapes) {
      const id = weaponJobId(type, shape, style);
      if (only && !id.includes(only)) continue;
      jobs.push({
        id,
        subject: type.id,
        shape: shape.id,
        style: style.id,
        kind: 'object',
        size: '1024x1024',
        background: 'transparent',
        prompt: weaponPrompt(type, shape, style),
      });
    }
  }
  if (!jobs.length) throw new Error(`--only ${only} matched no plate`);
  return jobs;
}
