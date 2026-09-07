// The race concept round: the six locked playable races, both genders, the shared
// underlayer, the five armour looks, the tint-ready base colours and the skin and hair
// preset ladders, and the prompt builders the three runners use. Pure: no I/O, no network.
//
// Why the prompts read the way they do: gpt-image-2 obeys the first rendering instruction
// literally, so the fusion and technique come before the subject (the matrix's proven order).
// Body plates name their base colours as exact flat fills because the engine tints a baked
// texture by hue, saturation and value zone; a plate whose hair drifts into the skin band
// cannot be dyed later. The direction doc locks all six races onto the standard body, so
// every body prompt pins standard proportions and puts the race in the head and skin.
import { MARGIN_RULE } from '../concept_character.mjs';
import { KEEP_FIGURE } from '../concept_dress.mjs';
import { CHARACTER_SIZE, GRIMDARK_CORE, SCENE_SIZE, STYLES } from './concept_matrix.mjs';
import { LAYOUT_CHARACTER } from './prompts.mjs';

export const CHOSEN_STYLE_ID = 'osrs_genshin';
export const GENDERS = Object.freeze(['male', 'female']);
export const GARMENT_HEX = '#404044';

export const UNDERLAYER =
  'wearing only the shared underlayer: a sleeveless close-fitting tank top, straight ' +
  'trousers and ankle wraps, bare arms and bare feet, no belt, no hood, nothing loose or ' +
  'hanging, the garment exactly the flat colour ' +
  GARMENT_HEX;

// Every plate in the first body round failed the framing gate on attempt 1 with 2 to 3.5% of
// clearance against the 4% the gate wants, top and bottom alike: the shared margin rule says
// "the top of the head", and the render reads that as the skull rather than the hair, the ears
// or a pair of horns standing above it. Naming the tall features, and the soles, is what moves
// the figure off the edge.
export const BODY_MARGIN_CLAUSE =
  'with clear background above the top of the head, the hair, the ears and any horns, and ' +
  'clear background below the soles of both feet, so the tallest and lowest points of the ' +
  'figure each sit at least one tenth of the image height inside the frame';

// Naming the tall features was not enough on its own: twelve of twelve plates still lost their
// first attempt to the 4% margin, and what recovered every one of them was the framing
// corrective's own sentence. So attempt 1 now asks for the same thing the corrective asks for,
// rather than waiting to be told twice and paying for a render to find out.
export const FRAME_SCALE_CLAUSE =
  'the camera pulled back so the figure occupies about three quarters of the image height, ' +
  'centered in the frame';

export const FIGURE_RULES =
  'standard human proportions shared by every race in this game, an adult of average ' +
  'height and build, no weapon, no shield, no armour, no cloak, no prop, nothing held in ' +
  'either hand';

export const RACES = Object.freeze([
  {
    id: 'human',
    faction: 'risen',
    name: 'Human',
    cues:
      'a human of the Risen, the baseline every other people deviates from: a weathered ' +
      'working face, ordinary rounded ears, earth-tone hair, nothing that marks them out',
    marks: 'weather lines, sun on the forearms',
    base: { skin: '#c8956b', hair: '#5a3a24', accent: '#7a6a3a' },
    presets: {
      skin: ['#f1d3b8', '#d9ad86', '#c8956b', '#a86f47', '#7d4d2f', '#4e3120'],
      hair: ['#1f1a17', '#5a3a24', '#8b5a2b', '#b98a4a', '#d9c28f', '#9c3b2a'],
    },
  },
  {
    id: 'faithless',
    faction: 'risen',
    name: 'the Faithless',
    cues:
      'a Faithless elf of the Risen, elves who never worshipped: long pointed ears, sharp ' +
      'fine features, pale cool ash-toned skin, a wary bearing, the elf reads in the head ' +
      'and the face and not in the limbs, the body is the ordinary human build of this game ' +
      'with a human head-to-body ratio, arms and legs no longer and shoulders no narrower ' +
      'than a human of the same height, never willowy, never elongated',
    marks: 'the long pointed ears, sharp cheekbones',
    base: { skin: '#b9b3c2', hair: '#3b3f5c', accent: '#c9d3e6' },
    presets: {
      skin: ['#e8e2ea', '#cfc9d6', '#b9b3c2', '#9a93a8', '#7a748c', '#5a5570'],
      hair: ['#e6e6ee', '#b9b9c9', '#3b3f5c', '#1c1c26', '#6d4f8a', '#2f5a6a'],
    },
  },
  {
    id: 'horned',
    faction: 'risen',
    name: 'the Horned',
    cues:
      'a Horned of the Risen, the people the faithful called demons: two curved ram horns ' +
      'sweeping back from the temples, ordinary rounded human ears and never pointed ones, ' +
      'ash-dark skin, deep red hair, ember-lit eyes with dark sclera, old pale scars across ' +
      'the forearms and collarbone, otherwise a human face and frame',
    marks: 'the ram horns, the pale scars, the ember eyes',
    // Hair is deep red, not the soot #2a2222 the presets still open with: soot sits only 0.13 of
    // saturation from the garment #404044, inside the tint gate's 0.12 separability window, and
    // no prompt wording holds a rendered centroid that tightly. Oxblood #4a2a2a cleared the
    // declared window but the render kept pulling the hair back to near-black (#2c2627 observed),
    // so the pair closed again. #7a2a2a clears the garment by 0.60 of saturation and stays
    // separable even at the near-black the model drifts to; the cues name the colour as well, so
    // it survives rendering. Soot and oxblood both remain in the presets.
    base: { skin: '#6b5a58', hair: '#7a2a2a', accent: '#d0642a' },
    presets: {
      skin: ['#9a8380', '#7f6b68', '#6b5a58', '#574645', '#433433', '#2f2323'],
      hair: ['#2a2222', '#4a2a2a', '#6b3a2a', '#1a1416', '#7a5a3a', '#8a2a2a'],
    },
  },
  {
    id: 'firstsworn',
    faction: 'godborn',
    name: 'the Firstsworn',
    cues:
      'a Firstsworn of the Godborn, long-lived people who knelt to the first god: faintly ' +
      'luminous warm skin with a scatter of small gold flecks at the temples and collarbones, ' +
      'eyes with a thin ring of gold light around the iris, hair like pale brass, a still ' +
      'and composed face, human anatomy throughout',
    marks: 'the gold flecks, the lit ring in the eye',
    base: { skin: '#d9b98f', hair: '#c9a256', accent: '#f2c94c' },
    presets: {
      skin: ['#f2dfc4', '#e5cba7', '#d9b98f', '#c9a377', '#b48a5e', '#9a704a'],
      hair: ['#c9a256', '#e6d1a0', '#f2e6c8', '#a67c3a', '#7a5a2a', '#d8b46a'],
    },
  },
  {
    id: 'ailuran',
    faction: 'godborn',
    name: 'Ailuran',
    cues:
      'an Ailuran of the Godborn, a feline people: a short-muzzled cat head with upright ' +
      'ears on the crown, slit pupils, short fur in a sand tabby pattern with darker stripe ' +
      'bands, a long tail held low behind the legs, five-fingered hands and not paws, a ' +
      'standard human body under the fur',
    marks: 'the muzzle, the crown ears, the stripe bands, the tail',
    base: { skin: '#a58a6a', hair: '#6b5233', accent: '#d8b23a' },
    presets: {
      skin: ['#c9b39a', '#b39c7e', '#a58a6a', '#8a6f52', '#6e5842', '#4f3f30'],
      hair: ['#6b5233', '#3a2a1c', '#8a6a44', '#b08a5a', '#2a2a2a', '#9a7a5a'],
    },
  },
  {
    id: 'graven',
    faction: 'godborn',
    name: 'the Graven',
    cues:
      'a Graven of the Godborn, the stone-touched: grey mineral skin veined with darker ' +
      'seams like weathered granite, a heavy brow, hair the colour of raw ore, one or two ' +
      'fine fissures on the cheek or shoulder glowing faintly from within, a human frame ' +
      'of standard height and build',
    marks: 'the dark veins, the glowing fissures, the heavy brow',
    base: { skin: '#7f8388', hair: '#6e5a4a', accent: '#e0a05a' },
    presets: {
      skin: ['#a9adb2', '#94989d', '#7f8388', '#6a6e73', '#55595e', '#40444a'],
      hair: ['#6e5a4a', '#545a63', '#3e424a', '#8a6f5a', '#2c3036', '#7a7f86'],
    },
  },
]);

export const LOOKS = Object.freeze([
  {
    id: 'cloth',
    name: 'Cloth',
    brief:
      'a cloth caster outfit: layered robes and wraps with a fitted bodice, wide sleeves ' +
      'that stop at the wrist, a sash at the waist, soft boots, no rigid plates anywhere',
  },
  {
    id: 'leather',
    name: 'Leather',
    brief:
      'a fitted leather outfit: a hide jerkin with buckled straps, bracers, fitted leather ' +
      'trousers, knee-high boots, a narrow belt with pouches, no metal beyond buckles',
  },
  {
    id: 'chain',
    name: 'Chain',
    brief:
      'a mail outfit: a knee-length chainmail shirt with a coif line at the neck over ' +
      'leather underpinnings, leather gauntlets, mail-skirted thighs, sturdy boots',
  },
  {
    id: 'plate',
    name: 'Plate',
    brief:
      'articulated steel plate over mail: a cuirass, pauldrons, vambraces, tassets and ' +
      'greaves with visible mail at the joints, an open face, steel boots',
  },
  {
    id: 'heavy_plate',
    name: 'Heavy Plate',
    brief:
      'a full heavy harness: a thick cuirass with a high gorget, massive layered pauldrons, ' +
      'full gauntlets, cuisses, poleyns and sabatons, a closed helm seated fully on the head ' +
      'and covering the hair, the visor raised so the face stays visible',
  },
]);

export function styleNamed(styleId) {
  const style = STYLES.find((s) => s.id === styleId);
  if (!style)
    throw new Error(`unknown style ${styleId}; one of ${STYLES.map((s) => s.id).join(', ')}`);
  return style;
}

export function zonesFor(race) {
  return {
    skin: race.base.skin,
    hair: race.base.hair,
    garment: GARMENT_HEX,
    accent: race.base.accent,
  };
}

function baseColourClause(race) {
  return (
    `skin exactly the flat colour ${race.base.skin} with its marks drawn as a darker band of ` +
    `the same hue, hair exactly the flat colour ${race.base.hair}, eyes exactly the flat ` +
    `colour ${race.base.accent}, and no other markings, tattoos or painted patterns on the ` +
    'skin beyond those the description names'
  );
}

export function sheetPrompt(race, style) {
  return (
    `Art direction: ${style.fusion}. Render technique: ${style.technique}. ` +
    `Character study: two figures side by side, one male and one female of the same people, ` +
    `${race.cues}, ${FIGURE_RULES}, ${UNDERLAYER}, ${baseColourClause(race)}. ` +
    `Design language: ${style.design}. Composition: both figures full length in a relaxed ` +
    `standing three-quarter pose facing the viewer, the same scale, an arm's width apart, ` +
    `on a plain flat mid-grey studio backdrop, even diffuse lighting, no text, no watermark. ` +
    `Mood: ${GRIMDARK_CORE}. Must not look like: ${style.avoid}.`
  );
}

export function bodyPrompt(race, gender, style, attempt = 1, corrective = '') {
  const figure = `a ${gender} ${race.cues}, ${FIGURE_RULES}, ${UNDERLAYER}, ${baseColourClause(race)}`;
  return (
    `Art direction: ${style.fusion}. Render technique: ${style.technique}. ` +
    `Character: ${figure}. Design language: ${style.design}. ` +
    `Composition: ${LAYOUT_CHARACTER}, ${FRAME_SCALE_CLAUSE}, ${MARGIN_RULE}, ` +
    `${BODY_MARGIN_CLAUSE}. ` +
    `Mood: ${GRIMDARK_CORE}. ` +
    `Must not look like: ${style.avoid}.` +
    (attempt > 1 && corrective ? ` ${corrective}` : '')
  );
}

export function lookPrompt(look, style, attempt = 1) {
  const corrective =
    attempt > 1
      ? ' The previous render was cropped at the image edge: keep the whole figure inside the ' +
        'frame with clear background on every side.'
      : '';
  return (
    `${KEEP_FIGURE}. Change only the clothing and equipment: ${look.brief}, nothing held in ` +
    `either hand, no weapon, no shield, no cloak, every garment fitted so it does not hang ` +
    `away from the body. Render it in ${style.fusion}: ${style.technique}; ${style.design}; ` +
    `${style.avoid}. ${MARGIN_RULE}.${corrective}`
  );
}

export function raceSheetJobId(race, style) {
  return `${race.id}__sheet__${style.id}`;
}
export function raceBodyJobId(race, gender, style) {
  return `${race.id}__${gender}__body__${style.id}`;
}
export function raceLookJobId(look, gender, style) {
  return `${look.id}__${gender}__look__${style.id}`;
}

export function buildRaceSheetJobs(styleId = CHOSEN_STYLE_ID) {
  const style = styleNamed(styleId);
  return RACES.map((race) => ({
    id: raceSheetJobId(race, style),
    subject: race.id,
    style: style.id,
    kind: 'sheet',
    size: SCENE_SIZE,
    background: 'opaque',
    prompt: sheetPrompt(race, style),
    race: race.id,
  }));
}

export function buildRaceBodyJobs(styleId = CHOSEN_STYLE_ID) {
  const style = styleNamed(styleId);
  const jobs = [];
  for (const race of RACES) {
    for (const gender of GENDERS) {
      jobs.push({
        id: raceBodyJobId(race, gender, style),
        subject: race.id,
        style: style.id,
        kind: 'character',
        size: '1024x1024',
        background: 'transparent',
        prompt: bodyPrompt(race, gender, style),
        race: race.id,
        gender,
      });
    }
  }
  return jobs;
}

export function buildRaceLookJobs(styleId = CHOSEN_STYLE_ID) {
  const style = styleNamed(styleId);
  const jobs = [];
  for (const look of LOOKS) {
    for (const gender of GENDERS) {
      jobs.push({
        id: raceLookJobId(look, gender, style),
        subject: look.id,
        style: style.id,
        kind: 'character',
        size: '1024x1024',
        background: 'transparent',
        prompt: lookPrompt(look, style),
        look: look.id,
        gender,
      });
    }
  }
  return jobs;
}

export function presetsJson() {
  const out = {};
  for (const race of RACES)
    out[race.id] = { skin: [...race.presets.skin], hair: [...race.presets.hair] };
  return out;
}

export { CHARACTER_SIZE };
