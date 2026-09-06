// The region exploration: the nine overworld places of Solareth (the eight realm
// interiors of docs/design/WORLD-regions.md plus the capital), each rendered three
// ways in the ONE chosen fusion style, so the environment direction is decided on
// the game's real geography and its locked ground palette. Pure: no I/O, no
// network. The matrix runner (scripts/asset_pipeline/concept_matrix.mjs --set
// regions) spends money; this file decides what it asks for.
//
// Three views per region, all opaque landscape plates:
//   vista       the biome as an establishing shot, no people
//   settlement  the material culture in that biome, a few small figures at work
//   gameplay    a third-person camera frame behind and above a lone hero, no HUD,
//               the view the engine has to reproduce
//
// The ground lightness and hue per region are locked design values (the palette
// walk in gamedirection.md 2.9); they are stated after the mood clause so a
// near-white region stays near-white under a grimdark mood.
import { GRIMDARK_CORE, SCENE_SIZE, STYLES } from './concept_matrix.mjs';

export const REGION_VIEWS = Object.freeze(['vista', 'settlement', 'gameplay']);

// The art style the game locked on 2026-09-05 after the five-fusion concept matrix.
export const CHOSEN_STYLE_ID = 'osrs_genshin';

// A lone hero for the gameplay frames, the same one in every region so the
// figure never becomes the variable.
const GAMEPLAY_HERO =
  'a lone Graven Arknight hero in heavy plate with a tall tower shield on the back and a ' +
  'flanged mace at the hip';

export const REGIONS = Object.freeze([
  {
    id: 'ninebend',
    name: 'Ninebend',
    ground: { lstar: 56, hue: 'yellow-green' },
    biome:
      'a wide braided river valley on flood-plain silt, the slow yellow river forced through ' +
      'nine engineered bends, farmed terraces, stepped stone weirs, wooden sluice gates, ' +
      'diversion channels and spoil banks, low mist, the oldest conquest weathered into the land.',
    culture:
      'Timber-frame and rammed-earth building, grey tile roofs with deep eaves, stone ' +
      'revetments and the lattice of a weir, fishing and ferrying and dredging.',
    views: {
      vista: 'the valley seen along the river as it turns through three of its bends',
      settlement:
        'the starting river town at the second bend, tile roofs stepping down to a ferry ' +
        'landing, nets drying, a broken roadside shrine with a faded red cord',
      gameplay: 'walking the ferry road along the bank toward a stepped stone weir',
    },
  },
  {
    id: 'stillmere',
    name: 'Stillmere',
    ground: { lstar: 22, hue: 'indigo' },
    biome:
      'a still shallow lake system under a low sky, dark peat water mirror-flat so the world ' +
      'appears twice, causeways and stilted walkways crossing it, reed beds, the darkest ground ' +
      'in the game against the brightest sky reflection.',
    culture:
      'Post-and-beam timber, deep verandas, paper screens, rope and mirror and sun motifs, ' +
      'gate forms like a torii but of no real shrine, reed-cutting and lacquer and ' +
      'flat-bottomed boats.',
    views: {
      vista: 'the lake at dusk with a long causeway and the island town doubled in the water',
      settlement:
        'the shrine-town on the largest island, verandas over the water, lanterns, ' +
        'rope-hung gate forms, flat boats tied up',
      gameplay: 'walking a long causeway over mirror-still water toward a rope-hung gate',
    },
  },
  {
    id: 'whitewold',
    name: 'Whitewold',
    ground: { lstar: 80, hue: 'pale lime' },
    biome:
      'a high open wind-scoured plateau of pale grassland under an enormous sky, emptiness that ' +
      'still reads as built, grass bent flat by the wind, outcrops of pale stone.',
    culture:
      'Stepped stone platforms with plastered and painted surfaces, feathered-serpent relief ' +
      'carving, windbreak walls, obsidian working and weaving and lime-plaster burning.',
    views: {
      vista:
        'the plateau at midday with one stepped platform far off, a flat-topped stack of broad ' +
        'terraces with a single wide stair up its face, no towers, no spires, no keep, and the ' +
        'wind visible in the grass',
      settlement:
        'the plateau town on its old stepped ceremonial platform, painted plaster walls, ' +
        'woven windbreaks, dyed cloth snapping in the wind',
      gameplay: 'walking up the steps of a plastered stone platform under the huge sky',
    },
  },
  {
    id: 'redmarl',
    name: 'Redmarl',
    ground: { lstar: 44, hue: 'red clay' },
    biome:
      'red clay badlands cut by dry watercourses, layered strata and ribs of rock, a landscape ' +
      'that is obviously a body only from a distance, geology not gore, dust in the air.',
    culture:
      'Mudbrick, reed and bitumen, ziggurat-stepped massing, incised marks like cuneiform as ' +
      'decoration, brick kilns, reed boats, date palms at the water holes.',
    views: {
      vista: 'the badlands from a rim, strata curving like ribs toward a distant stepped kiln town',
      settlement:
        'the brick-kiln town, stepped mudbrick mass, smoking kilns, a walled well with people ' +
        'queuing for water',
      gameplay: 'walking a dry watercourse between red strata toward a stepped mudbrick tower',
    },
  },
  {
    id: 'rimefell',
    name: 'Rimefell',
    ground: { lstar: 68, hue: 'rime white with cold grey' },
    biome:
      'frozen fells under flat overcast light with no cast shadows, rime on every surface, ' +
      'frost-heaved ground, a frozen shore, iron-grey water beyond the ice.',
    culture:
      'Stave construction, turf roofs, carved timber, iron and wool, archaeological rather ' +
      'than heroic, whaling and smithing and salt.',
    views: {
      vista:
        'the fells from a ridge, a hall-town small in the middle distance, the frozen edge beyond',
      settlement:
        'the hall-town, a great stave hall with a turf roof and carved gable, smoke from ' +
        'smithies, whale ribs used as posts',
      gameplay: 'walking a frost track toward a stave hall under flat white overcast',
    },
  },
  {
    id: 'saltwake',
    name: 'Saltwake',
    ground: { lstar: 14, hue: 'black silt with natron-white salt' },
    biome:
      'the drying beds, black silt flats crusted with natron-white salt in pans and ridges, ' +
      'the highest-contrast ground in the game, a dead river mouth, heat and stillness.',
    culture:
      'Mudbrick and cut stone, painted plaster, the grammar of preparation and preservation: ' +
      'drying beds, rows of jars, linen, salt blocks, embalming supply.',
    views: {
      vista: 'the beds from above, black flats and white pans in a grid running to the river mouth',
      settlement:
        'the salt-town on the beds, cut-stone and mudbrick, salt blocks stacked, rows of ' +
        'sealed jars, linen drying on lines',
      gameplay: 'walking a black silt causeway between white salt pans toward a jar-lined gate',
    },
  },
  {
    id: 'weedline',
    name: 'the Weedline',
    ground: { lstar: 36, hue: 'violet' },
    biome:
      'a drained seabed under a violet sky, the black tide-mark line running across the whole ' +
      'region at one constant height, dry sponge and shell underfoot, sand ripples, wrecks.',
    culture:
      'Cut stone, column and lintel, painted terracotta, harbour works stranded far from any ' +
      'water, moles and quays leading nowhere, salvage and stone-cutting.',
    views: {
      vista: 'the seabed from the old shore with the black weedline drawn across every cliff',
      settlement:
        'the stranded port town, columned stone quays standing over dry sand, a beached ' +
        'hull used as a house, terracotta roofs',
      gameplay: 'walking the dry seabed below the black weedline toward a stranded harbour mole',
    },
  },
  {
    id: 'stillnoon',
    name: 'Stillnoon',
    ground: { lstar: 88, hue: 'gold-amber' },
    biome:
      'a place where noon stopped, every shadow short and hard and pooled directly beneath ' +
      'its object and never moving, gold-amber haze and heat shimmer, sand drifted over ' +
      'black basalt, the endgame region.',
    culture:
      'Monument at colossal scale, gold and amber and polished stone, processional avenues, ' +
      'colossi, one fortified holding rather than a town, nobody lives here comfortably.',
    views: {
      vista:
        'the processional avenue between colossi under a zenith sun, a felled god-statue head in the sand',
      settlement:
        'the one holding, a fortified camp of tents and stone against the foot of a colossus, ' +
        'awnings against the sun, water in guarded jars',
      gameplay: 'walking the avenue between the colossi, the shadow pooled tight under each',
    },
  },
  {
    id: 'kingshearth',
    name: 'Kingshearth',
    ground: { lstar: 50, hue: 'warm grey stone crossed by eight coloured roads' },
    biome:
      'the capital, a walled ring-city on a rise at the centre of the continent, eight gates ' +
      'in the ring order of the realms and eight radial roads each paved in its gate colour: ' +
      'green, indigo, pale, red, frost white, salt white, dry violet and long gold.',
    culture:
      'A seat of conquerors built by many peoples, quarters in eight building traditions around ' +
      'one eternal hearth flame that never goes out, war memorials, trophies looted from the ' +
      'temples of the eight realms.',
    views: {
      vista: 'the city on its rise seen from the green radial road, the gates and the hearth smoke',
      settlement:
        'the hearth square at the centre, the great flame in its stone housing, eight ' +
        'coloured roads leaving the square, market stalls and memorial walls',
      gameplay: 'walking the green-paved road inside the walls toward the Green Gate',
    },
  },
]);

const VIEW_COMPOSITION = Object.freeze({
  vista:
    'wide establishing shot, landscape composition, cinematic scale, the horizon in the upper ' +
    'third, no people, no creatures, no text, no watermark, no user interface, no frame or border',
  settlement:
    'wide establishing shot of the built place in its landscape, seen from slightly above like ' +
    'a game camera pulled back, buildings readable as a kit of repeatable pieces, a few small ' +
    'distant figures at work, no text, no watermark, no user interface, no frame or border',
  gameplay:
    `composed as an in-game screenshot from a third-person action MMO camera placed behind and ` +
    `above ${GAMEPLAY_HERO}, tilted about eighteen degrees down, the hero small in the lower ` +
    `third of the frame with the back to the camera, the ground plane and its surface clearly ` +
    `visible, no heads-up display, no health bars, no text, no watermark`,
});

/** The plain-English lightness band for a locked ground L* value. */
export function lightnessWord(lstar) {
  if (!Number.isFinite(lstar) || lstar < 0 || lstar > 100) {
    throw new Error(`ground L* must be 0 to 100, got ${lstar}`);
  }
  if (lstar <= 20) return 'near-black';
  if (lstar <= 30) return 'very dark';
  if (lstar <= 40) return 'dark';
  if (lstar <= 50) return 'mid-dark';
  if (lstar <= 60) return 'mid';
  if (lstar <= 70) return 'light';
  if (lstar <= 82) return 'very light';
  return 'near-white';
}

export function styleNamed(styleId) {
  const style = STYLES.find((s) => s.id === styleId);
  if (!style)
    throw new Error(`unknown style ${styleId}; one of ${STYLES.map((s) => s.id).join(', ')}`);
  return style;
}

/** The prompt for one region view: technique first, the place, then composition, mood,
 *  the locked palette (after the mood so it wins), then the style's avoid list. */
export function regionPrompt(region, view, style) {
  const composition = VIEW_COMPOSITION[view];
  if (!composition) throw new Error(`unknown region view: ${view}`);
  const lightness = lightnessWord(region.ground.lstar);
  return (
    `Art direction: ${style.fusion}. Render technique: ${style.technique}. ` +
    `Scene: ${region.name}, ${region.views[view]}. Region: ${region.biome} ${region.culture} ` +
    `Design language: ${style.design}. Composition: ${composition}. Mood: ${GRIMDARK_CORE}. ` +
    `Palette: the ground reads ${region.ground.hue} at a ${lightness} value; that lightness is ` +
    `fixed for this region and holds even where the mood pulls darker. ` +
    `Must not look like: ${style.avoid}.`
  );
}

export function regionJobId(region, view, style) {
  return `${region.id}__${view}__${style.id}`;
}

/** Every region in every view for one style, region-major, in the matrix runner's job
 *  shape (all scenes: opaque landscape plates, never framing-gated). */
export function buildRegionJobs(styleId = CHOSEN_STYLE_ID) {
  const style = styleNamed(styleId);
  const jobs = [];
  for (const region of REGIONS) {
    for (const view of REGION_VIEWS) {
      jobs.push({
        id: regionJobId(region, view, style),
        subject: region.id,
        style: style.id,
        view,
        kind: view === 'gameplay' ? 'combat' : 'environment',
        size: SCENE_SIZE,
        background: 'opaque',
        prompt: regionPrompt(region, view, style),
      });
    }
  }
  return jobs;
}
