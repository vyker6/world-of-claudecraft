// The tier recolour behind the tier strips: every opaque pixel is assigned to its nearest
// declared zone (the tint gate's own assignment), and each pixel of the chosen zone keeps its
// CIELAB lightness offset from the zone's mean while taking the tier hex's chroma and mean
// lightness. Shading survives, the tier's lightness carries through, no other pixel changes.
// This is a preview of the engine's zone remap, not the engine's code. The assignment is the
// tint gate's hsv rule, so the strip recolours exactly the pixels the gate counted.
import sharp from 'sharp';
import { ALPHA_SUBJECT } from './concept_silhouette.mjs';
import { hexToLab, labToRgb, rgbToLab, TIER_LADDER } from './concept_tiers.mjs';
import { assignZone, zoneBases } from './concept_tint.mjs';

/** The plate with one zone recoloured to a hex, as a PNG buffer. */
export async function recolorZone({ path, zones, zone, hex }) {
  const names = Object.keys(zones);
  const zi = names.indexOf(zone);
  if (zi < 0) throw new Error(`zone ${zone} is not declared; zones are ${names.join(', ')}`);
  const bases = zoneBases(zones);
  const { data, info } = await sharp(path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const count = info.width * info.height;
  const member = new Uint8Array(count);
  let sumL = 0;
  let n = 0;
  for (let i = 0; i < count; i++) {
    if (data[i * 4 + 3] < ALPHA_SUBJECT) continue;
    const px = { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] };
    if (assignZone(px, bases, 'hsv') !== zi) continue;
    member[i] = 1;
    sumL += rgbToLab(px).L;
    n++;
  }
  if (!n) throw new Error(`no pixels fell in zone ${zone} (declared ${zones[zone]})`);
  const meanL = sumL / n;
  const target = hexToLab(hex);
  for (let i = 0; i < count; i++) {
    if (!member[i]) continue;
    const px = { r: data[i * 4], g: data[i * 4 + 1], b: data[i * 4 + 2] };
    const L = Math.max(0, Math.min(100, target.L + (rgbToLab(px).L - meanL)));
    const out = labToRgb({ L, a: target.a, b: target.b });
    data[i * 4] = out.r;
    data[i * 4 + 1] = out.g;
    data[i * 4 + 2] = out.b;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
}

/** Shape a recoloured through the ladder, T1 to T8 left to right, labelled. */
export async function tierStrip({ path, zones, zone, ladder = TIER_LADDER, dest, cell = 256 }) {
  const cells = [];
  for (const tier of ladder) {
    const buf = await recolorZone({ path, zones, zone, hex: tier.hex });
    cells.push(await sharp(buf).resize(cell, cell, { fit: 'inside' }).png().toBuffer());
  }
  const labelH = 40;
  const width = cell * ladder.length;
  const height = cell + labelH;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  ladder.forEach((tier, i) => {
    svg += `<text x="${i * cell + 8}" y="${cell + 28}" font-family="sans-serif" font-size="18" fill="#f0eadc">T${tier.tier} ${tier.hex}</text>`;
  });
  svg += '</svg>';
  const composites = await Promise.all(
    cells.map(async (buf, i) => {
      const meta = await sharp(buf).metadata();
      return {
        input: buf,
        left: i * cell + Math.round((cell - meta.width) / 2),
        top: cell - meta.height,
      };
    }),
  );
  await sharp({
    create: { width, height, channels: 4, background: { r: 24, g: 22, b: 26, alpha: 1 } },
  })
    .composite([...composites, { input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(dest);
  return dest;
}
