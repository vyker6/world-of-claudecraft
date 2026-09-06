// Browser side of the look-dev duel renderer (bundled to an IIFE and driven by
// render_char.mjs): load a GLB, light it grimdark, measure its clips by skinning
// every vertex (forward reach per sample and the swept bounds), frame the camera
// on those bounds, then play a crossfaded clip timeline on a transparent canvas
// at a fixed frame rate and hand back every frame as a PNG.
//
//   window.__setup(glbUrl, {yaw, modelYaw, height}) -> {clips: [{name, duration}], bindHeight}
//     modelYaw (degrees) is the VisualDef `yaw` that turns the authored model to
//     face +Z (Tripo bipeds are authored facing +X, so the lane creatures take
//     -90, exactly as src/render/characters/manifest.ts wires them); yaw is the
//     world facing on top of that: +90 faces +X (screen right), -90 faces -X.
//     height scales the model so its bind pose stands that many world units tall
//     (the VisualDef `height`), so every measurement below is in world units.
//     The model root stays at the world origin.
//   window.__measure(clip, hz)     -> {times, reach, reachY, box: {min, max}}
//     Samples the clip at hz. reach[i] is the farthest skinned vertex along the
//     model's facing direction, reachY[i] that vertex's height, and box the union
//     of every sampled pose, all relative to the model root.
//   window.__frame({box})          -> {width, height, groundPx, pxPerUnit}
//     Backs the camera off until box fits. groundPx is the canvas row of world
//     y=0 and pxPerUnit the scale, both on the z=0 plane, so a compositor can
//     place the frames by world units.
//   window.__timeline({fps, segments}) / window.__tick() / window.__png()
//     Segments are {clip, at, fade, loop, offset, timeScale}; each starts at its
//     `at` second by crossfading from the running clip over `fade` seconds, from
//     clip time `offset`, played at `timeScale`. One-shot clips hold their last
//     pose until the next segment takes over. __tick advances exactly one frame.
import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const W = 960;
const H = 1280;
const FOV = 30;
const FIT_MARGIN = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

// Grimdark key/rim/fill: warm sun from upper-left, ember rim from behind-right, cool sky
// fill, plus a soft cool front fill so the near side reads instead of crushing to black.
const key = new THREE.DirectionalLight(0xffc890, 4.4);
key.position.set(-4, 5.5, 4);
const rim = new THREE.DirectionalLight(0xff8a4a, 1.8);
rim.position.set(3.5, 3, -4.5);
const front = new THREE.DirectionalLight(0x9fb0d0, 1.5);
front.position.set(0.5, 1.5, 6);
scene.add(key, rim, front);
scene.add(new THREE.HemisphereLight(0x7088b0, 0x3a2e22, 1.7));
scene.add(new THREE.AmbientLight(0x3a4e66, 0.8));

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const forward = new THREE.Vector3(0, 0, 1);
let model = null;
let mixer = null;
let clips = new Map();

function dispose(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
    }
  });
}

window.__setup = async (glbUrl, { yaw = 0, modelYaw = 0, height } = {}) => {
  if (model) {
    scene.remove(model);
    dispose(model);
  }
  const gltf = await loader.loadAsync(glbUrl);
  model = gltf.scene;
  const yawRad = (yaw * Math.PI) / 180;
  model.rotation.y = yawRad + (modelYaw * Math.PI) / 180;
  forward.set(Math.sin(yawRad), 0, Math.cos(yawRad));
  model.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false;
  });
  model.updateMatrixWorld(true);
  const bind = new THREE.Box3().setFromObject(model);
  const bindHeight = bind.max.y - bind.min.y;
  if (height) model.scale.setScalar(height / bindHeight);
  model.updateMatrixWorld(true);
  scene.add(model);
  mixer = new THREE.AnimationMixer(model);
  clips = new Map(gltf.animations.map((c) => [c.name, c]));
  return {
    clips: gltf.animations.map((c) => ({ name: c.name, duration: c.duration })),
    bindHeight,
  };
};

function clipNamed(name) {
  const clip = clips.get(name);
  if (!clip) throw new Error(`no clip named ${name}; have ${[...clips.keys()].join(', ')}`);
  return clip;
}

// Farthest skinned vertex along the facing direction (and its height) plus the
// pose's bounds, all relative to the model root. Every vertex is skinned on the
// CPU (applyBoneTransform), so a weapon that is part of the skin counts toward
// the reach like the hands do.
const vert = new THREE.Vector3();
function sweepPose(box) {
  let reach = Number.NEGATIVE_INFINITY;
  let reachY = 0;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      o.getVertexPosition(i, vert).applyMatrix4(o.matrixWorld).sub(model.position);
      box.expandByPoint(vert);
      const r = vert.dot(forward);
      if (r > reach) {
        reach = r;
        reachY = vert.y;
      }
    }
  });
  return { reach, reachY };
}

window.__measure = (name, hz) => {
  const clip = clipNamed(name);
  mixer.stopAllAction();
  const action = mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const count = Math.ceil(clip.duration * hz) + 1;
  const times = [];
  const reach = [];
  const reachY = [];
  const box = new THREE.Box3();
  for (let i = 0; i < count; i++) {
    const t = Math.min(clip.duration, i / hz);
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    const sample = sweepPose(box);
    times.push(t);
    reach.push(sample.reach);
    reachY.push(sample.reachY);
  }
  action.stop();
  mixer.uncacheAction(clip);
  return { times, reach, reachY, box: { min: box.min.toArray(), max: box.max.toArray() } };
};

window.__frame = ({ box }) => {
  const min = new THREE.Vector3().fromArray(box.min);
  const max = new THREE.Vector3().fromArray(box.max);
  const cy = (min.y + max.y) / 2;
  const halfTan = Math.tan((FOV * Math.PI) / 360);
  const halfHeight = Math.max(max.y - cy, cy - min.y);
  const halfWidth = Math.max(Math.abs(min.x), Math.abs(max.x));
  const fitDist = Math.max(halfHeight / halfTan, halfWidth / (halfTan * (W / H)));
  const dist = fitDist * FIT_MARGIN + Math.max(0, max.z);
  camera.position.set(0, cy, dist);
  camera.lookAt(0, cy, 0);
  camera.updateProjectionMatrix();
  const pxPerUnit = H / 2 / (dist * halfTan);
  return { width: W, height: H, groundPx: H / 2 + cy * pxPerUnit, pxPerUnit };
};

let timeline = null;

function startSegment(seg) {
  const action = mixer.clipAction(clipNamed(seg.clip));
  const prev = timeline.current;
  // reset() leaves weight and time scale alone, so a clip faded out earlier
  // (weight 0, disabled) has to be brought back explicitly before it plays again.
  action.reset();
  action.setEffectiveWeight(1);
  action.setEffectiveTimeScale(seg.timeScale ?? 1);
  action.time = seg.offset || 0;
  action.setLoop(seg.loop ? THREE.LoopRepeat : THREE.LoopOnce, Number.POSITIVE_INFINITY);
  action.clampWhenFinished = !seg.loop;
  if (prev && prev !== action && seg.fade > 0) {
    prev.fadeOut(seg.fade);
    action.fadeIn(seg.fade);
  } else if (prev && prev !== action) {
    prev.stop();
  }
  action.play();
  timeline.current = action;
}

// Moves the mixer forward to frame time `time`; a zero step still applies a
// segment that has just started.
function advanceTo(time) {
  const step = Math.max(0, time - timeline.t);
  mixer.update(step);
  timeline.t += step;
}

// Advances to frame time `end`, sub-stepping the mixer to each segment start on
// the way so a clip (and its fade) begins at exactly its `at` rather than at the
// frame boundary after it; otherwise every clip runs a fraction of a frame ahead
// for the rest of the timeline and the strike frames miss their measured peak.
function stepTo(end) {
  const { segments } = timeline;
  while (timeline.next < segments.length && segments[timeline.next].at <= end + 1e-9) {
    const seg = segments[timeline.next++];
    advanceTo(Math.min(seg.at, end));
    startSegment(seg);
  }
  advanceTo(end);
  renderer.render(scene, camera);
  return timeline.t;
}

window.__timeline = ({ fps, segments }) => {
  mixer.stopAllAction();
  timeline = {
    fps,
    segments: [...segments].sort((a, b) => a.at - b.at),
    next: 0,
    current: null,
    t: 0,
    frame: 0,
  };
  return stepTo(0);
};

window.__tick = () => stepTo(++timeline.frame / timeline.fps);

window.__png = () => renderer.domElement.toDataURL('image/png');
window.__ready = true;
