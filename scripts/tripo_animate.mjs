// Tripo: rig-check -> auto-rig -> retarget preset animations -> download animated GLB.
import fs from 'node:fs';
const KEY = process.env.TRIPO_KEY,
  BASE = 'https://openapi.tripo3d.ai/v3',
  H = { Authorization: `Bearer ${KEY}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(id, label) {
  for (let i = 0; i < 300; i++) {
    await sleep(3000);
    const r = await fetch(`${BASE}/tasks/${id}`, { headers: H });
    const j = await r.json();
    const t = j.data || {};
    process.stdout.write(`\r  ${label}: ${t.status} ${t.progress || 0}%    `);
    if (t.status === 'success') {
      console.log('');
      return { id, output: t.output || {} };
    }
    if (['failed', 'cancelled', 'banned'].includes(t.status)) {
      console.log('\n', label, 'FAILED', JSON.stringify(j).slice(0, 400));
      process.exit(1);
    }
  }
  process.exit(1);
}
async function task(endpoint, body, label) {
  const r = await fetch(`${BASE}/${endpoint}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (j.code !== 0) {
    console.log(label, 'create ERR', JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
  return poll(j.data.task_id, label);
}

const MODEL = process.env.MODEL_TASK;
const chk = await task('animations/rig-check', { input: MODEL }, 'rig-check');
console.log('  rig-check:', JSON.stringify(chk.output));
if (!chk.output.riggable) {
  console.log('NOT RIGGABLE');
  process.exit(2);
}
const rigType = chk.output.rig_type || 'biped';

// rig the model (v2.5 supports non-humanoid; biped uses v1.0's 90+ presets)
const rigModel = rigType === 'biped' ? 'v1.0-20240301' : 'v2.5-20260210';
const rig = await task(
  'animations/rig',
  { input: MODEL, model: rigModel, rig_type: rigType, spec: 'tripo', out_format: 'glb' },
  'rig',
);

// retarget: idle + walk + a slash (attack). biped v1.0 uses the biped: preset names.
const anims =
  rigType === 'biped'
    ? ['preset:biped:idle', 'preset:biped:walk', 'preset:biped:slash']
    : ['preset:idle', 'preset:walk'];
const ret = await task(
  'animations/retarget',
  {
    input: rig.id,
    animations: anims,
    out_format: 'glb',
    bake_animation: true,
    export_with_geometry: true,
  },
  'retarget',
);
console.log('  retarget output:', JSON.stringify(ret.output).slice(0, 300));
const url = ret.output.model_url || ret.output.model;
const r = await fetch(url);
fs.writeFileSync(process.env.OUT, Buffer.from(await r.arrayBuffer()));
console.log(
  'saved',
  process.env.OUT,
  `(${(fs.statSync(process.env.OUT).size / 1024 / 1024).toFixed(1)} MB)`,
);
