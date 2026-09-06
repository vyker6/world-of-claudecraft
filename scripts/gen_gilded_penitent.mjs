// Procedurally generate "The Gilded Penitent" - a felled-god's guardian: a
// kneeling weathered-stone statue veined with glowing molten-gold cracks, a
// broken spiked halo that turns, hollow gold-glowing eyes, one arm planted on
// the ground and one broken stump, a ceremonial gold waist band, orbiting stone
// shards, and moss. Pure @gltf-transform (no browser, no external service), the
// same procedural path as gen_chicken_cow.mjs. Node-transform clips (no rig):
// Idle / Walk / Attack / Death. Writes public/models/creatures/gilded_penitent.glb.
//   node scripts/gen_gilded_penitent.mjs   then   npm run build (media manifest)
import { Document, NodeIO } from '@gltf-transform/core';
import { KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import fs from 'node:fs';

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('Scene');
const emissiveExt = doc.createExtension(KHRMaterialsEmissiveStrength);

const M = (name, rgb, rough = 0.9, metal = 0) =>
  doc
    .createMaterial(name)
    .setBaseColorFactor([...rgb, 1])
    .setRoughnessFactor(rough)
    .setMetallicFactor(metal)
    .setDoubleSided(true);
function glow(name, rgb, strength) {
  const m = M(name, rgb, 0.4, 0.15).setEmissiveFactor(rgb);
  m.setExtension(
    'KHR_materials_emissive_strength',
    emissiveExt.createEmissiveStrength().setEmissiveStrength(strength),
  );
  return m;
}
const matStone = M('stone', [0.17, 0.165, 0.15], 0.97); // dark weathered stone so gold reads
const matStoneDark = M('stone_dark', [0.09, 0.085, 0.08], 0.98);
const matGold = M('gold', [0.92, 0.72, 0.22], 0.32, 0.5);
const matCrack = glow('crack', [1.0, 0.42, 0.05], 1.3); // molten cracks (glow keeps its gold color)
const matSeam = glow('seam', [1.0, 0.5, 0.08], 1.2); // gold joint seams / emblem
const matEye = glow('eye', [1.0, 0.68, 0.2], 2.5);
const matMoss = M('moss', [0.3, 0.42, 0.16], 1.0);

// ---- smooth-shaded primitives (from gen_chicken_cow.mjs) --------------------
function ellipsoid(rx, ry, rz, seg = 14, ring = 10) {
  const pos = [],
    nrm = [],
    idx = [];
  for (let i = 0; i <= ring; i++) {
    const theta = (i / ring) * Math.PI,
      st = Math.sin(theta),
      ct = Math.cos(theta);
    for (let j = 0; j <= seg; j++) {
      const phi = (j / seg) * 2 * Math.PI,
        sp = Math.sin(phi),
        cp = Math.cos(phi);
      const px = st * cp * rx,
        py = ct * ry,
        pz = st * sp * rz;
      pos.push(px, py, pz);
      const ex = px / (rx * rx),
        ey = py / (ry * ry),
        ez = pz / (rz * rz);
      const L = Math.hypot(ex, ey, ez) || 1;
      nrm.push(ex / L, ey / L, ez / L);
    }
  }
  const s = seg + 1;
  for (let i = 0; i < ring; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * s + j,
        b = a + 1,
        c = a + s,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  return geo(pos, nrm, idx);
}
function frustum(r0, r1, h, seg = 12) {
  const pos = [],
    nrm = [],
    idx = [];
  const slant = Math.atan2(r0 - r1, h),
    ny = Math.sin(slant),
    nr = Math.cos(slant);
  for (let j = 0; j <= seg; j++) {
    const phi = (j / seg) * 2 * Math.PI,
      cx = Math.cos(phi),
      cz = Math.sin(phi);
    pos.push(cx * r0, 0, cz * r0);
    nrm.push(cx * nr, ny, cz * nr);
    pos.push(cx * r1, h, cz * r1);
    nrm.push(cx * nr, ny, cz * nr);
  }
  for (let j = 0; j < seg; j++) {
    const a = j * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const cap = (y, r, dir) => {
    if (r <= 1e-4) return;
    const c = pos.length / 3;
    pos.push(0, y, 0);
    nrm.push(0, dir, 0);
    const rim = pos.length / 3;
    for (let j = 0; j <= seg; j++) {
      const phi = (j / seg) * 2 * Math.PI;
      pos.push(Math.cos(phi) * r, y, Math.sin(phi) * r);
      nrm.push(0, dir, 0);
    }
    for (let j = 0; j < seg; j++)
      dir < 0 ? idx.push(c, rim + j, rim + j + 1) : idx.push(c, rim + j + 1, rim + j);
  };
  cap(0, r0, -1);
  cap(h, r1, 1);
  return geo(pos, nrm, idx);
}
function torus(R, r, segU = 20, segV = 9) {
  const pos = [],
    nrm = [],
    idx = [];
  for (let i = 0; i <= segU; i++) {
    const u = (i / segU) * 2 * Math.PI,
      cu = Math.cos(u),
      su = Math.sin(u);
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 * Math.PI,
        cv = Math.cos(v),
        sv = Math.sin(v);
      pos.push((R + r * cv) * cu, r * sv, (R + r * cv) * su);
      nrm.push(cv * cu, sv, cv * su);
    }
  }
  const s = segV + 1;
  for (let i = 0; i < segU; i++)
    for (let j = 0; j < segV; j++) {
      const a = i * s + j,
        b = a + 1,
        c = a + s,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  return geo(pos, nrm, idx);
}
function geo(pos, nrm, idx) {
  return doc
    .createPrimitive()
    .setAttribute(
      'POSITION',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer),
    )
    .setAttribute(
      'NORMAL',
      doc.createAccessor().setType('VEC3').setArray(new Float32Array(nrm)).setBuffer(buffer),
    )
    .setIndices(
      doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buffer),
    );
}
let n = 0;
function part(name, prim, mat, t = [0, 0, 0], r = null, s = null) {
  prim.setMaterial(mat);
  const mesh = doc.createMesh(`${name}_${n++}`).addPrimitive(prim);
  const node = doc.createNode(name).setMesh(mesh).setTranslation(t);
  if (r) node.setRotation(r);
  if (s) node.setScale(s);
  return node;
}
const group = (name, t = [0, 0, 0], r = null) => {
  const g = doc.createNode(name).setTranslation(t);
  if (r) g.setRotation(r);
  return g;
};
const qx = (a) => [Math.sin(a / 2), 0, 0, Math.cos(a / 2)];
const qy = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)];
const qz = (a) => [0, 0, Math.sin(a / 2), Math.cos(a / 2)];
function quatY(d) {
  const dot = d[1];
  if (dot > 0.9999) return [0, 0, 0, 1];
  if (dot < -0.9999) return [1, 0, 0, 0];
  const ax = [d[2], 0, -d[0]];
  const L = Math.hypot(ax[0], ax[1], ax[2]);
  const a = Math.acos(dot),
    s = Math.sin(a / 2);
  return [(ax[0] / L) * s, (ax[1] / L) * s, (ax[2] / L) * s, Math.cos(a / 2)];
}
function bone(name, p0, p1, r0, r1, mat) {
  const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const len = Math.hypot(d[0], d[1], d[2]);
  const u = [d[0] / len, d[1] / len, d[2] / len];
  const node = group(name, p0, quatY(u));
  node.addChild(part(`${name}_m`, frustum(r0, r1, len), mat, [0, 0, 0]));
  return node;
}

// ---- assemble --------------------------------------------------------------
const root = group('GildedPenitent');
scene.addChild(root);
const pose = group('pose');
root.addChild(pose); // attack rise / death topple
const body = group('body');
pose.addChild(body); // idle bob

// pelvis + hunched torso + chest (weathered stone)
body.addChild(part('pelvis', ellipsoid(0.44, 0.32, 0.42), matStone, [0, 0.82, 0]));
body.addChild(part('torso', ellipsoid(0.5, 0.58, 0.44), matStone, [0, 1.32, 0.06], qx(-0.18)));
body.addChild(part('chest', ellipsoid(0.56, 0.36, 0.42), matStone, [0, 1.72, 0.12], qx(-0.25)));
body.addChild(part('waistband', torus(0.44, 0.06), matGold, [0, 0.98, 0.02]));

// bowed head with hollow gold-glowing eyes
const head = group('head', [0, 2.02, 0.2], qx(0.4));
body.addChild(head);
head.addChild(part('skull', ellipsoid(0.27, 0.3, 0.29), matStone, [0, 0, 0]));
head.addChild(part('face', ellipsoid(0.2, 0.22, 0.12), matStoneDark, [0, -0.03, 0.2]));
head.addChild(part('collar', torus(0.29, 0.045), matGold, [0, -0.28, -0.02], qx(0.3)));
for (const sx of [-1, 1]) {
  head.addChild(part('socket', ellipsoid(0.08, 0.07, 0.05), matStoneDark, [sx * 0.11, 0.02, 0.24]));
  head.addChild(part('eye', ellipsoid(0.05, 0.045, 0.04), matEye, [sx * 0.11, 0.02, 0.27]));
}

// broken, turning spiked halo behind the head (haloTilt static tip -> haloSpin turns)
const haloTilt = group('haloTilt', [0, 2.42, -0.08], qx(0.35));
body.addChild(haloTilt);
const haloSpin = group('haloSpin');
haloTilt.addChild(haloSpin);
haloSpin.addChild(part('haloRing', torus(0.42, 0.045, 22, 8), matGold, [0, 0, 0]));
const SPIKES = 10;
for (let i = 0; i < SPIKES; i++) {
  if (i === 3 || i === 7) continue; // broken gaps
  const a = (i / SPIKES) * 2 * Math.PI,
    cx = Math.cos(a),
    cz = Math.sin(a);
  haloSpin.addChild(
    part(
      'spike',
      frustum(0.035, 0.0, 0.16),
      matCrack,
      [cx * 0.42, 0, cz * 0.42],
      quatY([cx, 0, cz]),
    ),
  );
}

// intact right arm (shoulder pivot -> planted hand) so it can slam
const armR = group('armR', [0.52, 1.78, 0.08]);
body.addChild(armR);
armR.addChild(bone('armR_upper', [0, 0, 0], [0.14, -0.62, 0.24], 0.15, 0.12, matStone));
armR.addChild(bone('armR_fore', [0.14, -0.62, 0.24], [0.1, -1.62, 0.46], 0.12, 0.1, matStone));
armR.addChild(part('armR_hand', ellipsoid(0.16, 0.12, 0.2), matStone, [0.1, -1.66, 0.52]));
armR.addChild(part('armR_band', torus(0.13, 0.03), matGold, [0.12, -1.2, 0.35], qx(0.5)));
// broken left-arm stump + glowing break
body.addChild(bone('armL_stump', [-0.52, 1.78, 0.08], [-0.66, 1.42, 0.14], 0.15, 0.09, matStone));
body.addChild(part('armL_break', ellipsoid(0.1, 0.06, 0.1, 8, 6), matCrack, [-0.66, 1.42, 0.14]));

// kneeling legs: right knee down on the ground, left foot planted
body.addChild(bone('legR_thigh', [0.26, 0.72, 0.02], [0.32, 0.16, 0.42], 0.19, 0.15, matStone));
body.addChild(bone('legR_shin', [0.32, 0.16, 0.42], [0.32, 0.12, -0.34], 0.15, 0.12, matStone));
body.addChild(part('legR_knee', ellipsoid(0.16, 0.16, 0.16), matStone, [0.32, 0.18, 0.42]));
body.addChild(bone('legL_thigh', [-0.26, 0.72, 0.02], [-0.34, 0.46, 0.42], 0.19, 0.15, matStone));
body.addChild(bone('legL_shin', [-0.34, 0.46, 0.42], [-0.34, 0.06, 0.3], 0.15, 0.12, matStone));
body.addChild(part('legL_foot', ellipsoid(0.17, 0.1, 0.24), matStone, [-0.34, 0.06, 0.42]));

// prominent gold: a glowing chest emblem, seams proud of the joints, and molten
// cracks pushed proud of the front surface so they are visible AND bloom.
body.addChild(part('emblem_ring', torus(0.16, 0.045), matSeam, [0, 1.72, 0.42], qx(1.45)));
body.addChild(part('emblem_core', ellipsoid(0.09, 0.09, 0.05), matCrack, [0, 1.72, 0.48]));
body.addChild(part('seam_waist', torus(0.47, 0.035), matSeam, [0, 0.98, 0.02]));
body.addChild(part('seam_chest', torus(0.59, 0.03), matSeam, [0, 1.52, 0.08], qx(-0.22)));
body.addChild(part('seam_neck', torus(0.3, 0.028), matSeam, [0, 1.9, 0.08], qx(0.3)));
const CRACKS = [
  // proud of the front surface (z high), thicker
  [0.16, 1.5, 0.52, [0.3, 0.07, 0.06], qz(0.8)],
  [-0.18, 1.24, 0.52, [0.3, 0.065, 0.06], qz(-0.6)],
  [0.02, 1.02, 0.48, [0.26, 0.06, 0.055], qz(0.15)],
  [0.4, 0.52, 0.44, [0.24, 0.055, 0.05], qx(0.7)],
  [-0.38, 0.44, 0.44, [0.22, 0.05, 0.05], qx(-0.5)],
];
for (const [x, y, z, sc, r] of CRACKS)
  body.addChild(part('crack', ellipsoid(1, 1, 1, 8, 6), matCrack, [x, y, z], r, sc));

// moss patches (aged stone)
for (const [x, y, z] of [
  [0.3, 1.55, 0.36],
  [-0.28, 1.0, 0.4],
  [0.34, 0.3, 0.4],
  [-0.2, 1.7, 0.2],
])
  body.addChild(part('moss', ellipsoid(0.14, 0.05, 0.12), matMoss, [x, y, z]));

// orbiting broken-stone shards (the whole group turns for the orbit)
const shards = group('shards', [0, 1.5, 0]);
body.addChild(shards);
const SHARDS = 7;
for (let i = 0; i < SHARDS; i++) {
  const a = (i / SHARDS) * 2 * Math.PI,
    rad = 1.5 + (i % 2) * 0.25,
    hy = -0.4 + (i % 3) * 0.5;
  const sh = group('shard', [Math.cos(a) * rad, hy, Math.sin(a) * rad], qx(a));
  sh.addChild(part('shard_m', ellipsoid(0.14, 0.17, 0.12, 5, 4), matStone, [0, 0, 0]));
  sh.addChild(part('shard_c', ellipsoid(0.17, 0.055, 0.05, 6, 4), matCrack, [0, 0, 0.06], qz(0.6)));
  shards.addChild(sh);
}

// ---- animation (node-transform, no rig) ------------------------------------
function track(anim, node, path, times, values, interp = 'LINEAR') {
  const input = doc
    .createAccessor()
    .setType('SCALAR')
    .setArray(new Float32Array(times))
    .setBuffer(buffer);
  const output = doc
    .createAccessor()
    .setType(path === 'rotation' ? 'VEC4' : 'VEC3')
    .setArray(new Float32Array(values.flat()))
    .setBuffer(buffer);
  const sampler = doc
    .createAnimationSampler()
    .setInput(input)
    .setOutput(output)
    .setInterpolation(interp);
  anim
    .addSampler(sampler)
    .addChannel(
      doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler),
    );
}
const clip = (name) => doc.createAnimation(name);

{
  const a = clip('Idle');
  track(
    a,
    body,
    'translation',
    [0, 2, 4],
    [
      [0, 0, 0],
      [0, 0.035, 0],
      [0, 0, 0],
    ],
  );
  track(a, head, 'rotation', [0, 2, 4], [qx(0.4), qx(0.36), qx(0.4)]);
  track(a, haloSpin, 'rotation', [0, 2, 4], [qy(0), qy(Math.PI), qy(2 * Math.PI)]);
  track(a, shards, 'rotation', [0, 4], [qy(0), qy(2 * Math.PI)]);
}

{
  const a = clip('Walk'); // guardian does not really walk; a slow labored sway
  track(
    a,
    body,
    'translation',
    [0, 0.5, 1],
    [
      [0, 0, 0],
      [0, 0.04, 0],
      [0, 0, 0],
    ],
  );
  track(a, body, 'rotation', [0, 0.5, 1], [qz(0.03), qz(-0.03), qz(0.03)]);
  track(a, haloSpin, 'rotation', [0, 1], [qy(0), qy(Math.PI)]);
  track(a, shards, 'rotation', [0, 1], [qy(0), qy(Math.PI)]);
}

{
  const a = clip('Attack'); // rise from the kneel and slam the intact arm down
  track(
    a,
    pose,
    'translation',
    [0, 0.2, 0.45, 0.7],
    [
      [0, 0, 0],
      [0, 0.4, 0],
      [0, 0.15, 0],
      [0, 0, 0],
    ],
  );
  track(a, armR, 'rotation', [0, 0.22, 0.42, 0.7], [qx(0), qx(-0.7), qx(0.9), qx(0)]);
  track(a, head, 'rotation', [0, 0.25, 0.7], [qx(0.4), qx(0.05), qx(0.4)]);
}

{
  const a = clip('Death'); // topple forward
  track(a, pose, 'rotation', [0, 0.6, 1.4], [qx(0), qx(-0.6), qx(-1.25)]);
  track(
    a,
    pose,
    'translation',
    [0, 0.6, 1.4],
    [
      [0, 0, 0],
      [0, -0.05, -0.15],
      [0, -0.25, -0.3],
    ],
  );
  track(
    a,
    shards,
    'translation',
    [0, 1.4],
    [
      [0, 0, 0],
      [0, -1.2, 0],
    ],
  );
}

const glb = await new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]).writeBinary(doc);
const out = 'public/models/creatures/gilded_penitent.glb';
fs.writeFileSync(out, glb);
console.log(
  `wrote ${out} (${(glb.length / 1024).toFixed(1)} KB, ${doc.getRoot().listAnimations().length} clips)`,
);
