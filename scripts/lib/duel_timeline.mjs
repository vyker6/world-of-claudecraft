// Pure schedule builder for the look-dev duel (scripts/render_char.mjs): two
// fighters face each other, the hero swings, the enemy flinches on the frame the
// swing reaches farthest, then the roles swap, and the whole thing loops.
//
// Everything is derived from measurements the browser entry took off the real
// skinned meshes (render_char_entry.js __measure), never from hand-picked frame
// numbers: the strike frame is the first argmax of the Attack clip's forward
// reach, and the distance between the two roots is whatever makes each strike
// land PENETRATION_FRACTION of the target's height inside the target's idle
// silhouette. Idle segments are phased so both fighters are at Idle time 0 on
// the loop point, which is what lets the encoded video loop without a pop.
//
// All lengths are world units (the driver scales each model to its VisualDef
// height before measuring); all times are seconds except the frame fields,
// which are indices at `fps`.

// How far a strike lands inside the target's idle silhouette, as a fraction of
// the target's height: deep enough to read as a hit, shallow enough that the
// weapon does not come out the other side.
export const PENETRATION_FRACTION = 0.1;

// Beats of the schedule (seconds). The loop point carries HOLD_END + HOLD_START
// of idle, a longer rest than GAP_BETWEEN so the restart reads as a new round.
export const HOLD_START = 0.8;
export const GAP_BETWEEN = 0.8;
export const HOLD_END = 0.8;
export const FADE_ATTACK = 0.15;
export const FADE_HIT = 0.06;
export const FADE_BACK = 0.25;

const FLAT_CURVE = 1e-4;

function checkMeasure(measure, label) {
  if (!measure || !Array.isArray(measure.times) || !Array.isArray(measure.reach)) {
    throw new Error(`${label}: expected a measure with times[] and reach[]`);
  }
  const n = measure.times.length;
  if (n === 0) throw new Error(`${label}: the measure is empty`);
  if (measure.reach.length !== n || (measure.reachY && measure.reachY.length !== n)) {
    throw new Error(`${label}: times, reach and reachY must have the same length`);
  }
}

// The moment the clip reaches farthest forward: the first sample at the maximum
// reach, so a plateau resolves to its leading edge (the impact, not the follow
// through). A flat curve has no strike and is rejected.
export function strikeOf(measure) {
  checkMeasure(measure, 'strikeOf');
  let best = 0;
  let lo = measure.reach[0];
  for (let i = 1; i < measure.reach.length; i++) {
    if (measure.reach[i] > measure.reach[best]) best = i;
    if (measure.reach[i] < lo) lo = measure.reach[i];
  }
  if (measure.reach[best] - lo < FLAT_CURVE) {
    const hi = measure.reach[best];
    throw new Error(`strikeOf: the reach curve is flat (${lo} to ${hi}); this clip has no strike`);
  }
  return {
    time: measure.times[best],
    reach: measure.reach[best],
    y: measure.reachY ? measure.reachY[best] : 0,
  };
}

// Where the idle silhouette's front sits, as the median reach over the clip so
// a single breathing-cycle extreme does not decide the spacing.
export function idleReach(measure) {
  checkMeasure(measure, 'idleReach');
  const sorted = [...measure.reach].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function checkFighter(f, label) {
  if (!f || typeof f.name !== 'string') throw new Error(`${label}: missing fighter name`);
  if (f.dir !== 1 && f.dir !== -1) throw new Error(`${label}: dir must be 1 or -1`);
  if (!(f.height > 0)) throw new Error(`${label}: height must be positive`);
  if (!(f.attackTimeScale > 0)) throw new Error(`${label}: attackTimeScale must be positive`);
  for (const clip of ['Idle', 'Attack', 'Hit']) {
    if (!(f.clips?.[clip] > 0)) throw new Error(`${label}: missing ${clip} clip duration`);
  }
  checkMeasure(f.measures?.Idle, `${label} Idle`);
  checkMeasure(f.measures?.Attack, `${label} Attack`);
}

const mod = (a, n) => ((a % n) + n) % n;

// One fighter's segment list, built from the beats the exchange planner hands
// it. Idle segments after the first are phased so the clip is at time 0 on the
// loop point (`total`), matching the first segment, which starts at 0.
class Track {
  constructor(fighter) {
    this.fighter = fighter;
    this.segments = [];
  }

  idle(at, total) {
    const d = this.fighter.clips.Idle;
    this.segments.push({
      clip: 'Idle',
      at,
      fade: at === 0 ? 0 : FADE_BACK,
      loop: true,
      offset: at === 0 ? 0 : mod(at - total, d),
      timeScale: 1,
    });
  }

  oneShot(clip, at, fade, timeScale) {
    this.segments.push({ clip, at, fade, loop: false, offset: 0, timeScale });
    // The clip hands back to Idle FADE_BACK before its end so the fade completes
    // as the clip does; the Idle segment itself is added once `total` is known.
    return at + this.fighter.clips[clip] / timeScale - FADE_BACK;
  }
}

// Plans the two exchanges, recording every beat as a time; the segment lists
// are emitted afterwards because the Idle offsets depend on the total length.
// Each strike lands on a frame boundary (see the note inside), so a renderer
// that samples the clips at exactly `fps` shows the measured peak reach.
function planExchanges(hero, enemy, fps) {
  const beats = [];
  let settled = HOLD_START;
  for (const [attacker, defender, who] of [
    [hero, enemy, 'hero'],
    [enemy, hero, 'enemy'],
  ]) {
    const ts = attacker.attackTimeScale;
    const strike = strikeOf(attacker.measures.Attack);
    // The swing starts on or after `settled`, shifted so its peak lands exactly
    // on a frame: rounding the peak to the nearest frame instead leaves the
    // rendered frame up to half a step short of the measured reach.
    const frame = Math.ceil((settled + strike.time / ts) * fps - 1e-9);
    const strikeAt = frame / fps;
    const at = strikeAt - strike.time / ts;
    const attackEnd = at + attacker.clips.Attack / ts;
    const hitEnd = strikeAt + defender.clips.Hit;
    beats.push({ who, at, ts, strike, frame, strikeAt, attackEnd, hitEnd });
    // Both fighters are back on Idle (fade included) before the next beat.
    settled = Math.max(attackEnd, hitEnd) + GAP_BETWEEN;
  }
  const end = settled - GAP_BETWEEN + HOLD_END;
  const frames = Math.ceil(end * fps);
  return { beats, frames, total: frames / fps };
}

function emitTracks(hero, enemy, beats, total) {
  const tracks = { hero: new Track(hero), enemy: new Track(enemy) };
  tracks.hero.idle(0, total);
  tracks.enemy.idle(0, total);
  for (const b of beats) {
    const attacker = tracks[b.who];
    const defender = tracks[b.who === 'hero' ? 'enemy' : 'hero'];
    attacker.idle(attacker.oneShot('Attack', b.at, FADE_ATTACK, b.ts), total);
    defender.idle(defender.oneShot('Hit', b.strikeAt, FADE_HIT, 1), total);
  }
  return tracks;
}

// The root-to-root distance that lands both strikes: for each exchange, the
// attacker's strike reach plus the target's idle reach, less the penetration.
function gapBetween(hero, enemy) {
  let gap = 0;
  for (const [attacker, target] of [
    [hero, enemy],
    [enemy, hero],
  ]) {
    const reach = strikeOf(attacker.measures.Attack).reach;
    const need = reach + idleReach(target.measures.Idle) - PENETRATION_FRACTION * target.height;
    if (need > gap) gap = need;
  }
  return gap;
}

export function buildDuel({ fps, hero, enemy }) {
  if (!(fps > 0)) throw new Error('buildDuel: fps must be positive');
  checkFighter(hero, 'hero');
  checkFighter(enemy, 'enemy');
  if (hero.dir === enemy.dir) throw new Error('buildDuel: the fighters must face each other');
  const gap = gapBetween(hero, enemy);
  const x = { hero: -hero.dir * (gap / 2), enemy: -enemy.dir * (gap / 2) };
  const { beats, frames, total } = planExchanges(hero, enemy, fps);
  const tracks = emitTracks(hero, enemy, beats, total);
  const fighters = { hero, enemy };
  const strikes = beats.map((b) => {
    const attacker = fighters[b.who];
    const targetSide = b.who === 'hero' ? 'enemy' : 'hero';
    const target = fighters[targetSide];
    const contact = x[b.who] + attacker.dir * b.strike.reach;
    // The target's front is its idle reach ahead of its own root, toward the attacker.
    const surface = x[targetSide] + target.dir * idleReach(target.measures.Idle);
    return {
      frame: b.frame,
      attacker: b.who,
      x: contact,
      y: b.strike.y,
      penetration: (contact - surface) * attacker.dir,
    };
  });
  const attackWindows = beats.map((b) => ({
    attacker: b.who,
    from: Math.floor(b.at * fps),
    to: Math.ceil(b.attackEnd * fps),
  }));
  const track = (who) => ({
    name: fighters[who].name,
    dir: fighters[who].dir,
    x: x[who],
    segments: tracks[who].segments,
  });
  return {
    fps,
    frames,
    gap,
    fighters: { hero: track('hero'), enemy: track('enemy') },
    strikes,
    attackWindows,
  };
}
