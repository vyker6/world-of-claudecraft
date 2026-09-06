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
//   TP_X=8 TP_Z=-330 [TP_FACING=3.14]  (teleport to a zone before the shots)
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const HERO_URL = process.env.HERO_URL ?? '';
const WEAPON_ITEM = process.env.WEAPON_ITEM ?? 'reaver_axe';
const ENEMY = process.env.ENEMY_TEMPLATE ?? 'vale_bandit';
const OUT = process.env.OUT ?? 'tmp/slice/hero_v1';
// Optional teleport before the shots (world coordinates), e.g. a zone's arrival point.
const TP_X = process.env.TP_X !== undefined ? Number(process.env.TP_X) : null;
const TP_Z = process.env.TP_Z !== undefined ? Number(process.env.TP_Z) : null;
const TP_FACING = process.env.TP_FACING !== undefined ? Number(process.env.TP_FACING) : null;
// Look and length of the fight capture: the day/night phase (0.5 = noon), whether the
// HUD stays visible, and a timed burst (seconds at FPS, jpeg frames + an mp4 via
// ffmpeg) instead of the 24-frame swing sample. ABILITIES is a comma list of ability
// ids the local player casts in rotation every few seconds during the burst.
const DAY_PHASE = process.env.DAY_PHASE !== undefined ? Number(process.env.DAY_PHASE) : 0.5;
const SHOW_HUD = process.env.SHOW_HUD === '1';
const BURST_SECONDS = Number(process.env.BURST_SECONDS ?? 0);
const BURST_FPS = Number(process.env.BURST_FPS ?? 10);
const ENEMY_COUNT = Math.max(1, Number(process.env.ENEMY_COUNT ?? 1));
const HIDE_CHAT = process.env.HIDE_CHAT === '1';
// Burst camera as "relYaw,dist,pitch" (relYaw is added to the player's facing; PI/2 is a profile).
const BURST_CAM = (process.env.BURST_CAM ?? `${Math.PI / 2 + 0.5},7,0.25`).split(',').map(Number);
const ABILITIES = (process.env.ABILITIES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
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
  settleMs: 9000,
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
  async ({ weaponItem, heroUrl, tp, dayPhase, showHud, hideChat }) => {
    const g = window.__game;
    const sim = g.sim;
    const p = sim.player;
    sim.setPlayerLevel(20);
    p.maxHp = 999999;
    p.hp = 999999;
    if (tp) {
      const g = sim.groundPos(tp.x, tp.z);
      p.pos = { ...g };
      p.prevPos = { ...g };
      if (tp.facing !== null) {
        p.facing = tp.facing;
        p.prevFacing = tp.facing;
      }
      sim.rebucket?.(p);
    }
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
    dn.setDayNightPhaseOverride(dayPhase);
    for (const id of showHud ? (hideChat ? ['chatlog-wrap'] : []) : ['ui', 'nameplates']) {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    }
    return { pos: p.pos, facing: p.facing, equipped, modular: p.modularAppearance != null };
  },
  {
    weaponItem: WEAPON_ITEM,
    heroUrl: HERO_URL,
    tp: TP_X !== null && TP_Z !== null ? { x: TP_X, z: TP_Z, facing: TP_FACING } : null,
    dayPhase: DAY_PHASE,
    showHud: SHOW_HUD,
    hideChat: HIDE_CHAT,
  },
);
console.log('setup:', JSON.stringify(setup));
// visual rebuild + GLB load + texture upload, and the entering-the-world fade:
// a cold Vite graph lands the first shot on the loading overlay otherwise.
await page
  .waitForFunction(
    () => {
      const el = document.getElementById('loading-screen');
      return !el || getComputedStyle(el).display === 'none' || getComputedStyle(el).opacity === '0';
    },
    { timeout: 120000, polling: 500 },
  )
  .catch(() => {});
await sleep(6000);

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
// Teleported into a zone: two wide views of the ground the harness landed on.
if (TP_X !== null && TP_Z !== null) {
  await shot('zone_high', { yaw: yawFor(facing, 0), dist: 45, pitch: 1.1 });
  await shot('zone_far', { yaw: yawFor(facing, Math.PI / 2), dist: 90, pitch: 0.75 });
  await shot('zone_far_back', { yaw: yawFor(facing, Math.PI), dist: 90, pitch: 0.75 });
}

if (ENEMY) {
  const fight = await page.evaluate(
    async ({ tpl, count }) => {
      const sim = window.__game.sim;
      const p = sim.player;
      const { spawnMobsForDev } = await window.__appModule('/src/sim/dev_commands.ts');
      const ids = spawnMobsForDev(sim.ctx, sim.playerId, tpl, count, 20);
      if (!ids?.length) return { ok: false, reason: `spawn failed for ${tpl}` };
      const ang = p.facing;
      ids.forEach((id, i) => {
        const mob = sim.entities.get(id);
        const spread = (i - (ids.length - 1) / 2) * 0.55;
        const dist = 2.2 + i * 1.4;
        const mpos = sim.groundPos(
          p.pos.x + Math.sin(ang + spread) * dist,
          p.pos.z + Math.cos(ang + spread) * dist,
        );
        mob.pos = { ...mpos };
        mob.prevPos = { ...mpos };
        sim.rebucket?.(mob);
        mob.inCombat = true;
        mob.aiState = 'attack';
      });
      const mob = sim.entities.get(ids[0]);
      p.targetId = mob.id;
      p.autoAttack = true;
      return { ok: true, mobId: mob.id, mobHp: mob.hp, ids };
    },
    { tpl: ENEMY, count: ENEMY_COUNT },
  );
  console.log('fight:', JSON.stringify(fight));
  if (fight.ok) {
    await page.evaluate(
      ({ yaw, dist, pitch }) => {
        const inp = window.__game.input;
        inp.camYaw = yaw;
        inp.camDist = dist;
        inp.camPitch = pitch;
      },
      { yaw: yawFor(facing, BURST_CAM[0]), dist: BURST_CAM[1], pitch: BURST_CAM[2] },
    );
    await sleep(600);
    if (BURST_SECONDS > 0) {
      // A timed fight: jpeg frames at BURST_FPS, abilities cast in rotation, then
      // ffmpeg stitches the frames into OUT/burst.mp4.
      const frames = Math.round(BURST_SECONDS * BURST_FPS);
      const dt = 1000 / BURST_FPS;
      let nextCast = Date.now() + 2500;
      let castIndex = 0;
      for (let i = 0; i < frames; i++) {
        const t0 = Date.now();
        if (i % 5 === 0) {
          await page.evaluate((ids) => {
            const sim = window.__game.sim;
            const p = sim.player;
            // The capture hero does not die: the fight is the subject, not the outcome.
            p.hp = p.maxHp;
            const cur = sim.entities.get(p.targetId);
            if (cur && cur.hp > 0) return;
            const next = ids.map((id) => sim.entities.get(id)).find((m) => m && m.hp > 0);
            if (next) {
              p.targetId = next.id;
              p.autoAttack = true;
            }
          }, fight.ids ?? []);
        }
        if (ABILITIES.length && t0 >= nextCast) {
          const id = ABILITIES[castIndex % ABILITIES.length];
          castIndex++;
          nextCast = t0 + 3200;
          await page.evaluate((abilityId) => {
            try {
              window.__game.sim.castAbility(abilityId);
            } catch {}
          }, id);
        }
        await page.screenshot({
          path: `${OUT}/burst_${String(i).padStart(4, '0')}.jpg`,
          type: 'jpeg',
          quality: 90,
        });
        const spent = Date.now() - t0;
        if (spent < dt) await sleep(dt - spent);
      }
      const { spawnSync } = await import('node:child_process');
      const enc = spawnSync(
        'ffmpeg',
        [
          '-y',
          '-framerate',
          String(BURST_FPS),
          '-i',
          `${OUT}/burst_%04d.jpg`,
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-crf',
          '18',
          `${OUT}/burst.mp4`,
        ],
        { stdio: 'ignore', shell: process.platform === 'win32' },
      );
      console.log(`burst: ${frames} frames -> ${OUT}/burst.mp4 (ffmpeg exit ${enc.status})`);
    } else {
      // Burst: auto-attack swings every ~2.2 s; 24 frames at 110 ms span one swing.
      for (let i = 0; i < 24; i++) {
        await page.screenshot({ path: `${OUT}/attack_${String(i).padStart(2, '0')}.png` });
        await sleep(110);
      }
    }
    console.log('attack burst captured');
  }
}

const errors = await page.evaluate(() => window.__sliceErrors ?? null);
if (errors) console.log('errors', JSON.stringify(errors));
await browser.close();
