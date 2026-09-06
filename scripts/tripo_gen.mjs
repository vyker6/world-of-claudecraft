// Tripo3D image-to-model: upload our Gilded Penitent concept, generate a textured
// 3D model, poll to completion, download the GLB. Then (STEP=rig) rig + retarget.
import fs from 'node:fs';

const KEY = process.env.TRIPO_KEY;
const BASE = 'https://openapi.tripo3d.ai/v3';
const H = { Authorization: `Bearer ${KEY}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(taskId, label) {
  for (let i = 0; i < 200; i++) {
    await sleep(3000);
    const r = await fetch(`${BASE}/tasks/${taskId}`, { headers: H });
    const j = await r.json();
    const t = j.data || {};
    process.stdout.write(`\r  ${label}: ${t.status} ${t.progress || 0}%    `);
    if (t.status === 'success') {
      console.log('');
      return t.output || {};
    }
    if (['failed', 'cancelled', 'banned', 'unknown'].includes(t.status)) {
      console.log('\n  FAILED:', JSON.stringify(j).slice(0, 400));
      process.exit(1);
    }
  }
  console.log('\n  timed out');
  process.exit(1);
}

async function download(url, out) {
  const r = await fetch(url);
  if (!r.ok) {
    console.log('download failed', r.status);
    process.exit(1);
  }
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
  console.log('  saved', out, `(${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
}

// 1. upload the concept image -> file_token
const imgPath = process.env.CONCEPT;
const buf = fs.readFileSync(imgPath);
const fd = new FormData();
fd.append('file', new Blob([buf], { type: 'image/png' }), 'concept.png');
let r = await fetch(`${BASE}/files`, { method: 'POST', headers: H, body: fd });
let j = await r.json();
console.log('upload:', JSON.stringify(j).slice(0, 300));
const fileToken = j.data?.file_token || j.data?.token || j.data?.image_token || j.data?.file_id;
if (!fileToken) {
  console.log('NO file_token in response');
  process.exit(1);
}

// 2. image-to-model
r = await fetch(`${BASE}/generation/image-to-model`, {
  method: 'POST',
  headers: { ...H, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input: fileToken,
    model: 'v3.1-20260211',
    texture: true,
    pbr: true,
    texture_quality: 'detailed',
    enable_image_autofix: true,
  }),
});
j = await r.json();
console.log('image-to-model:', JSON.stringify(j).slice(0, 300));
const modelTask = j.data?.task_id;
if (!modelTask) process.exit(1);
const out = await poll(modelTask, 'model');
console.log('model output keys:', Object.keys(out).join(', '));
const modelUrl = out.pbr_model || out.model || out.model_url;
await download(modelUrl, process.env.OUT);
fs.writeFileSync(`${process.env.OUT}.taskid`, modelTask);
console.log('MODEL_TASK_ID', modelTask);
