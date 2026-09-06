// simpleMMO combat-slice capture: the real client, real GPU (ANGLE d3d11), offline
// warrior, with the slice hero body swapped in at runtime and the slice weapon
// granted + equipped through the sim's own item path. Needs `npm run dev`.
//
// The body swap is a RUNTIME override of VISUALS.player_warrior.url on the Vite
// module instance (no source edit), and the local player is dropped from the
// modular composition path (modularAppearance cleared) so the renderer recomposes
// them onto the fixed class rig, which is where a single-mesh class body lives.
//
// Usage: node scripts/slice_capture.mjs
//   HERO_URL=models/chars/players/<body>.glb  (default: the wired player_warrior body)
//   WEAPON_ITEM=reaver_axe  ENEMY_TEMPLATE=vale_bandit  OUT=tmp/slice/hero_v1
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const HERO_URL = process.env.HERO_URL ?? '';
const WEAPON_ITEM = process.env.WEAPON_ITEM ?? 'reaver_axe';
const ENEMY = process.env.ENEMY_TEMPLATE ?? 'vale_bandit';
const OUT = process.env.OUT ?? 'tmp/slice/hero_v1';
const W = 1920;
const H = 1080;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  protocolTimeout: 300000,
  args: [
    `--window-size=${W},${H}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--use-angle=d3d11',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
  defaultViewport: { width: W, height: H },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300));
});
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem('woc_gpu_notice_dismissed', '1');
  } catch {}
  // Vite serves HMR-invalidated modules under "?t=<stamp>" URLs; a bare
  // import('/src/x.ts') would mint a SECOND instance. The harness looks the
  // app's real URL up in the resource timing log, so keep that log unbounded.
  performance.setResourceTimingBufferSize(20000);
  window.__appModule = (path) => {
    const hit = performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .find((n) => n.endsWith(path) || n.includes(`${path}?`));
    return import(hit ?? path);
  };
});

await page.goto(`${URL}/?gfx=high`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-offline', { timeout: 120000 });

// Body swap BEFORE the world boots: same module instance as the app's static import.
if (HERO_URL) {
  const swapped = await page.evaluate(async (url) => {
    const m = await window.__appModule('/src/render/characters/manifest.ts');
    const a = await window.__appModule('/src/render/characters/assets.ts');
    const def = m.VISUALS.player_warrior;
    const before = def.url;
    def.url = url;
    // The preload set was computed at module init (knight.glb); make the swapped
    // body resident the same way a streamed body arrives.
    a.ensureCharacterUrl(url);
    const t0 = performance.now();
    while (!a.mountAssetsReady('player_warrior')) {
      if (performance.now() - t0 > 60000) return { before, after: def.url, resident: false };
      await new Promise((r) => setTimeout(r, 100));
    }
    return { before, after: def.url, resident: true, animUrls: def.animUrls, show: def.show };
  }, HERO_URL);
  console.log('body swap:', JSON.stringify(swapped));
  if (!swapped.resident) {
    console.log('hero body never became resident');
    await browser.close();
    process.exit(1);
  }
}

const booted = await enterOfflineGame(page, {
  charClass: 'warrior',
  charName: 'Slice',
  settleMs: 5000,
  selectorTimeoutMs: 120000,
  gameBootTimeoutMs: 600000,
});
if (!booted) {
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 300000, polling: 1000 });
}
for (let i = 0; i < 3; i++) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(200);
}

const setup = await page.evaluate(
  async ({ weaponItem, heroUrl }) => {
    const g = window.__game;
    const sim = g.sim;
    const p = sim.player;
    sim.setPlayerLevel(20);
    p.maxHp = 999999;
    p.hp = 999999;
    // Leave the modular composition path: the renderer's live-redesign branch then
    // recomposes the local player onto the fixed player_warrior rig.
    if (heroUrl) p.modularAppearance = undefined;
    let equipped = null;
    if (weaponItem) {
      sim.addItem(weaponItem, 1);
      sim.equipItem(weaponItem);
      equipped = p.mainhandItemId ?? p.equipment?.mainhand ?? null;
    }
    const dn = await window.__appModule('/src/render/day_night_clock.ts');
    dn.setDayNightPhaseOverride(0.5);
    for (const id of ['ui', 'nameplates']) {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    }
    return { pos: p.pos, facing: p.facing, equipped, modular: p.modularAppearance != null };
  },
  { weaponItem: WEAPON_ITEM, heroUrl: HERO_URL },
);
console.log('setup:', JSON.stringify(setup));
await sleep(4000); // visual rebuild + GLB load + texture upload

async function shot(name, { yaw, dist = 7, pitch = 0.32 }) {
  await page.evaluate(
    ({ yaw, dist, pitch }) => {
      const inp = window.__game.input;
      inp.camYaw = yaw;
      inp.camDist = dist;
      inp.camPitch = pitch;
    },
    { yaw, dist, pitch },
  );
  await sleep(700);
  const file = `${OUT}/${name}.png`;
  await page.screenshot({ path: file });
  console.log('shot', file);
}

// The chase camera sits at camYaw behind the player: PI looks along +z from behind
// a +z-facing player, 0 looks at their face, +-PI/2 are the profiles.
// camYaw == facing puts the camera behind the player (the default third-person seat), so
// rel = PI is the front view and rel = 0 the back view.
const yawFor = (facing, rel) => facing + rel;
const facing = setup.facing ?? 0;
await shot('idle_front34', { yaw: yawFor(facing, Math.PI + 0.7), dist: 7 });
await shot('idle_side', { yaw: yawFor(facing, Math.PI / 2), dist: 7 });
await shot('idle_back', { yaw: yawFor(facing, 0), dist: 7 });
await shot('idle_front34_close', { yaw: yawFor(facing, Math.PI + 0.7), dist: 4.5, pitch: 0.2 });
await shot('idle_default_cam', { yaw: yawFor(facing, 0), dist: 12 });

if (ENEMY) {
  const fight = await page.evaluate(async (tpl) => {
    const sim = window.__game.sim;
    const p = sim.player;
    const { spawnMobsForDev } = await window.__appModule('/src/sim/dev_commands.ts');
    const ids = spawnMobsForDev(sim.ctx, sim.playerId, tpl, 1, 20);
    if (!ids?.length) return { ok: false, reason: `spawn failed for ${tpl}` };
    const mob = sim.entities.get(ids[0]);
    const ang = p.facing;
    const mpos = sim.groundPos(p.pos.x + Math.sin(ang) * 2.2, p.pos.z + Math.cos(ang) * 2.2);
    mob.pos = { ...mpos };
    mob.prevPos = { ...mpos };
    sim.rebucket?.(mob);
    mob.inCombat = true;
    mob.aiState = 'attack';
    p.targetId = mob.id;
    p.autoAttack = true;
    return { ok: true, mobId: mob.id, mobHp: mob.hp };
  }, ENEMY);
  console.log('fight:', JSON.stringify(fight));
  if (fight.ok) {
    await page.evaluate(
      ({ yaw, dist, pitch }) => {
        const inp = window.__game.input;
        inp.camYaw = yaw;
        inp.camDist = dist;
        inp.camPitch = pitch;
      },
      { yaw: yawFor(facing, Math.PI / 2 + 0.5), dist: 7, pitch: 0.25 },
    );
    await sleep(600);
    // Burst: auto-attack swings every ~2.2 s; 24 frames at 110 ms span one swing.
    for (let i = 0; i < 24; i++) {
      await page.screenshot({ path: `${OUT}/attack_${String(i).padStart(2, '0')}.png` });
      await sleep(110);
    }
    console.log('attack burst captured');
  }
}

const errors = await page.evaluate(() => window.__sliceErrors ?? null);
if (errors) console.log('errors', JSON.stringify(errors));
await browser.close();
