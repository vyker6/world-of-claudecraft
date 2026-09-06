// The art-direction concept matrix: ten fixed subjects (three heroes, three
// enemies, one boss, two environments, one hero-vs-boss combat frame) rendered
// in five fusion styles, fifty prompts, so the style decision is made on the
// same cast and places every time. Pure: no I/O, no network. The runner
// (scripts/asset_pipeline/concept_matrix.mjs) spends money; this file decides
// what it asks for.
//
// Characters are portrait sheets on a transparent background (the same PNG is
// the image-to-model input and the UI sprite: portraits, ability cut-ins).
// Environments and the combat frame are opaque landscape plates; a scene has
// no background to drop.
//
// Prompt order is load-bearing. The first run of this matrix opened every
// prompt with "grimdark fantasy MMO concept art, painterly and detailed" and
// buried the technique (cel shading, low-poly, pixel grain) mid-sentence
// behind the IP names; gpt-image-2 obeyed the first rendering instruction it
// read and four of the five columns came back as the same painterly-realistic
// concept art. So: the fusion is named, then the render technique, then the
// subject, then the design language, then composition, then a mood-only
// grimdark core, then what the style must not look like.

export const CHARACTER_SIZE = '1024x1536';
export const SCENE_SIZE = '1536x1024';

// The overall direction that stands regardless of fusion: grimdark. Mood only;
// no medium, finish or detail words, those belong to the style's technique.
export const GRIMDARK_CORE =
  'grimdark, sombre and heavy, weight and wear in every material, no cheerfulness, the ' +
  'palette pulled down toward mud, soot, rust, bone and torchlight';

export const STYLES = Object.freeze([
  {
    id: 'wow_octopath',
    name: 'World of Warcraft x Octopath Traveler',
    fusion: 'a fusion of World of Warcraft and Octopath Traveler',
    technique:
      'the Octopath Traveler HD-2D technique: pixel art surfaces with visible pixel grain, ' +
      'hard pixel-stepped edges and hand-dithered shading in limited colour bands, soft ' +
      'bloom, drifting light motes and a tilt-shift diorama depth of field',
    design:
      'World of Warcraft design: exaggerated heroic proportions, huge shoulder pauldrons, ' +
      'big hands and boots, oversized weapons, bold readable silhouettes, hand-painted ' +
      'texture with strong colour blocking',
    avoid:
      'not photorealistic, not smooth painterly concept art, no airbrushed gradients, no ' +
      'fine realistic surface detail',
  },
  {
    id: 'd4_ff',
    name: 'Diablo 4 x Final Fantasy',
    fusion: 'a fusion of Diablo 4 and Final Fantasy, Diablo 4 leading',
    technique:
      'the Diablo 4 technique: a dark realistic oil-painting render, heavy weathered ' +
      'materials, caked grime and dried blood, deep chiaroscuro lighting, a desaturated ' +
      'palette with one accent hue',
    design:
      'Final Fantasy costume language on Diablo 4 bodies: realistic proportions, ornate ' +
      'asymmetric armour, belts and buckles, engraved filigree and crystalline light',
    avoid: 'no anime faces, no chibi proportions, no cel shading, no clean bright surfaces',
  },
  {
    id: 'osrs_genshin',
    name: 'Old School RuneScape x Genshin Impact',
    fusion: 'a fusion of Old School RuneScape and Genshin Impact',
    technique:
      'the Genshin Impact cel-shading technique: a toon-shaded 3D game render with flat ' +
      'colour fills, hard two-tone shadow edges, thin dark outlines, matte untextured ' +
      'surfaces and a soft rim light',
    design:
      'Old School RuneScape design: low-polygon models with visible flat facets, blocky ' +
      'simplified geometry, hard polygon edges and chunky readable silhouettes',
    avoid:
      'not realistic, not painterly, no soft gradients, no photoreal texture, no fine ' +
      'surface detail',
  },
  {
    id: 'maple_souls',
    name: 'MapleStory x Dark Souls',
    fusion: 'a fusion of MapleStory and Dark Souls',
    technique:
      'the MapleStory technique: a clean 2D side-scroller game illustration with rounded ' +
      'simplified shapes, clean dark outlines, flat colours with simple soft shading, and ' +
      'chibi proportions about three heads tall for any figure',
    design:
      'Dark Souls design: ash, rust, corroded iron, decayed cloth, ruined gothic stone, ' +
      'hollow weary faces, a muted grey-green and bone palette and cold volumetric light',
    avoid: 'no realistic proportions, no painterly texture detail, no bright candy colours',
  },
  {
    id: 'ff_d4',
    name: 'Final Fantasy x Diablo 4',
    fusion: 'a fusion of Final Fantasy and Diablo 4, Final Fantasy leading',
    technique:
      'the modern Final Fantasy technique: a smooth polished 3D CG game render like a Square ' +
      'Enix cutscene, clean specular highlights and soft subsurface skin with no brush texture ' +
      'at all, a stylized idealized anime-influenced face with fine features and large ' +
      'expressive eyes, slender elongated proportions, flowing hair, and an elaborate layered ' +
      'asymmetric costume of belts, buckles, straps and silver filigree',
    design:
      'Diablo 4 world design: grime and blood on the ornate gear, gothic decay, deep ' +
      'chiaroscuro shadow and desaturated surroundings',
    avoid:
      'not an oil painting, no visible brushwork or painterly texture, not a photoreal ' +
      'Western fantasy illustration, no bulky realistic proportions, no chibi, no cel shading, ' +
      'no pixel art',
  },
]);

export const SUBJECTS = Object.freeze([
  {
    id: 'hero_arknight',
    kind: 'character',
    name: 'The Arknight (Graven)',
    brief:
      'a Graven Arknight, a male hero of a stone-grained people whose skin has the texture of ' +
      'weathered granite, in heavy full plate armour, a tall tower shield bearing a carved ' +
      'ward sigil on one arm and a flanged mace in the other hand, iron grey and oxidised ' +
      'bronze with a faint ward-blue glow in the sigil',
  },
  {
    id: 'hero_reaver',
    kind: 'character',
    name: 'The Reaver (Horned)',
    brief:
      'a Horned Reaver, a male hero with curved ram horns and ash-dark skin, in scarred leather ' +
      'and matted fur, old wounds across the arms, carrying one enormous two-handed axe and ' +
      'no shield, dried-blood red on soot-black leather',
  },
  {
    id: 'hero_elementalist',
    kind: 'character',
    name: 'The Elementalist (Faithless elf)',
    brief:
      'a Faithless elf Elementalist, a long-limbed female hero in travel-worn layered cloth ' +
      'robes with a staff focus, three small elemental signs around the hands, an ember, a frost ' +
      'shard and a curl of rot, embodying burn, chill and wither, muted robes with the three ' +
      'elements as the only colour',
  },
  {
    id: 'enemy_drowned',
    kind: 'character',
    name: 'Drowned Labourer',
    brief:
      'a river-drowned labourer of the Ninebend, the bloated corpse of a man caked in silt, ' +
      'tangled in weir net and river weed, wearing a rotted straw rain cape and dragging a ' +
      'rusted sluice ' +
      'hook, yellow-green water stain over grey flesh',
  },
  {
    id: 'enemy_silt_crawler',
    kind: 'character',
    name: 'Silt Crawler',
    brief:
      'a silt crawler, a low wide many-legged crustacean creature armoured in plates of ' +
      'dried mud and broken grey roof tiles, heavy mandibles, small pale eyes, mud-yellow and ' +
      'moss-green',
  },
  {
    id: 'enemy_ferry_bandit',
    kind: 'character',
    name: 'Ferry Bandit',
    brief:
      'a ferry bandit, a lean sun-darkened man in a conical woven hat and a quilted ' +
      'jacket dusted with rammed-earth dust, a cloth wrapped over the lower face, holding a ' +
      'dao sabre and a boat pole',
  },
  {
    id: 'boss_gilded_penitent',
    kind: 'character',
    name: 'The Gilded Penitent (boss)',
    brief:
      'the Gilded Penitent, a towering stone colossus boss veined with molten gold, a broken ' +
      'halo ring behind the head, shards of gold orbiting the shoulders, moss in the cracks, ' +
      'standing in a cracked bowed penitent posture, weathered stone and gold',
  },
  {
    id: 'env_ninebend',
    kind: 'environment',
    name: 'The Ninebend river valley',
    brief:
      'the Ninebend, an engineered river valley: stepped stone weirs across a slow yellow ' +
      'river, wooden sluice gates, farmed terraces, rammed-earth walls and grey tile roofs of ' +
      'a river town, a ferry road along the bank, a broken roadside shrine to Nezha with a ' +
      'faded red cord, yellow-green light and low mist',
  },
  {
    id: 'env_stillnoon',
    kind: 'environment',
    name: 'Stillnoon',
    brief:
      'Stillnoon, a place where noon stopped: colossal Egyptian-scale monuments and statues ' +
      'along a processional avenue under a zenith sun, every shadow pooled directly beneath ' +
      'its object and unmoving, gold-amber haze and heat shimmer, sand drifted over black ' +
      'basalt, the felled head of a god-statue lying in the avenue',
  },
  {
    id: 'combat_reaver_penitent',
    kind: 'combat',
    name: 'Reaver vs Gilded Penitent in the Dry Channel',
    brief:
      'a male Horned Reaver hero (curved ram horns, ash-dark skin, scarred leather and fur, one ' +
      'enormous two-handed axe) fighting the Gilded Penitent (a towering stone colossus veined ' +
      'with molten gold, broken halo ring, orbiting gold shards) in the Dry Channel, a drained ' +
      'river channel of cracked silt between stone weir walls, fish bones and stranded boats',
  },
]);

// The first run asked for "about four fifths of the image height" and every
// one of thirteen first attempts came back at 90 to 98 percent, touching the
// edges; the model overshoots the asked fill by ten to fifteen points. Ask for
// two thirds and land near four fifths.
const CHARACTER_FRAMING =
  'a single character, full body from the top of the head to the soles of the feet, relaxed ' +
  'ready pose, three-quarter front view, centered, small in the frame: the figure occupies ' +
  'only about two thirds of the image height, leaving a wide empty margin of about one ' +
  'sixth of the image height above the head and another below the feet, nothing cropped, ' +
  'transparent background, no ground, no ground shadow, no text, no watermark, no frame';

const ENVIRONMENT_FRAMING =
  'wide establishing shot, landscape composition, cinematic scale, no people, no creatures, ' +
  'no text, no watermark, no user interface, no frame or border';

const COMBAT_FRAMING =
  'composed as an in-game screenshot from a third-person action MMO camera placed behind ' +
  'and above the hero, tilted about eighteen degrees down, the hero in the lower third of the ' +
  'frame with the back to the camera mid-swing, the boss ahead at full height filling the ' +
  'upper frame, dust and gold light in the air, no heads-up display, no health bars, no ' +
  'text, no watermark';

const RETRY_CLAUSE =
  ' The previous render was cropped at the image edge: pull the camera much further back ' +
  'so the figure occupies only about three fifths of the image height, centered, with wide ' +
  'empty margins above the head and below the feet.';

function framingFor(kind) {
  if (kind === 'character') return CHARACTER_FRAMING;
  if (kind === 'environment') return ENVIRONMENT_FRAMING;
  if (kind === 'combat') return COMBAT_FRAMING;
  throw new Error(`unknown subject kind: ${kind}`);
}

/** The prompt for one cell, technique first (see the header). `attempt` above 1
 *  appends the framing retry clause (characters only; scenes are never framing-gated). */
export function conceptMatrixPrompt(subject, style, attempt = 1) {
  const lead = subject.kind === 'character' ? 'Character' : 'Scene';
  const retry = subject.kind === 'character' && attempt > 1 ? RETRY_CLAUSE : '';
  return (
    `Art direction: ${style.fusion}. Render technique: ${style.technique}. ` +
    `${lead}: ${subject.brief}. Design language: ${style.design}. ` +
    `Composition: ${framingFor(subject.kind)}. Mood: ${GRIMDARK_CORE}. ` +
    `Must not look like: ${style.avoid}.${retry}`
  );
}

export function jobId(subject, style) {
  return `${subject.id}__${style.id}`;
}

/** Every subject in every style: SUBJECTS.length x STYLES.length jobs, subject-major
 *  so a partial run still compares whole rows. */
export function buildMatrix() {
  const jobs = [];
  for (const subject of SUBJECTS) {
    for (const style of STYLES) {
      const character = subject.kind === 'character';
      jobs.push({
        id: jobId(subject, style),
        subject: subject.id,
        style: style.id,
        kind: subject.kind,
        size: character ? CHARACTER_SIZE : SCENE_SIZE,
        background: character ? 'transparent' : 'opaque',
        prompt: conceptMatrixPrompt(subject, style),
      });
    }
  }
  return jobs;
}

/** Review-size dimensions (the long edge), so a 50-image comparison page stays
 *  well under the artifact size cap. */
export function webSizeFor(kind) {
  return kind === 'character' ? { width: 768, height: 1152 } : { width: 1152, height: 768 };
}
