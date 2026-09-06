// Generate a character concept image via OpenAI gpt-image-1, for Tripo image-to-model.
import fs from 'node:fs';
const KEY = process.env.OPENAI_API_KEY;
const prompt = process.env.PROMPT;
const out = process.env.OUT;
const r = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gpt-image-1',
    prompt,
    size: '1024x1024',
    n: 1,
    background: 'opaque',
  }),
});
const j = await r.json();
if (!j.data?.[0]?.b64_json) {
  console.log('ERR', JSON.stringify(j).slice(0, 600));
  process.exit(1);
}
fs.writeFileSync(out, Buffer.from(j.data[0].b64_json, 'base64'));
console.log('saved', out, `(${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
