// Ninebend (levels 1-5). The simpleMMO starting ring: a weir town on a slow
// marsh river, nine bends of black water between reed beds and rotting piers,
// the first zone built in the locked osrs_genshin art direction. The zone
// record, roads, props, and camps land here as the slice grows; today the
// module carries the residents the combat slice fights.

import type { MobTemplate } from '../types';

// The River Drowned: fishermen the weir pools took and gave back. Slow and
// waterlogged, they hit harder than a bandit of the same level but wear no
// armour worth the name, and they shamble rather than run a player down.
export const NINEBEND_MOBS: Record<string, MobTemplate> = {
  river_drowned: {
    id: 'river_drowned',
    name: 'River Drowned',
    minLevel: 3,
    maxLevel: 5,
    family: 'undead',
    hpBase: 44,
    hpPerLevel: 18,
    dmgBase: 6,
    dmgPerLevel: 2.0,
    attackSpeed: 2.4,
    armorPerLevel: 12,
    moveSpeed: 6,
    aggroRadius: 11,
    loot: [
      { copper: 22, chance: 1 },
      { itemId: 'linen_scrap', chance: 0.3 },
    ],
    scale: 1.0,
    color: 0x6f8a6a,
  },
};
