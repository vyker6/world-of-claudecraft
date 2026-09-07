// The one table that dresses WoC's classes in simpleMMO's painted chrome. The slice hero (the
// WoC warrior) wears the Reaver bar; every other WoC class wears the Hero bar until the
// simpleMMO roster replaces WoC's classes. Target ranks map onto the three plate grades.
import type { PlayerClass } from '../../sim/types';
import type { TargetRank } from '../target_rank_view';
import type { PaintedChromeKey, PaintedGrade } from './metrics';

const CHROME_BY_CLASS: Partial<Record<PlayerClass, PaintedChromeKey>> = {
  warrior: 'reaver',
};

export function paintedChromeFor(cls: PlayerClass): PaintedChromeKey {
  return CHROME_BY_CLASS[cls] ?? 'hero';
}

export function paintedGradeFor(rank: TargetRank): PaintedGrade {
  return rank === 'normal' ? 'plain' : rank;
}
