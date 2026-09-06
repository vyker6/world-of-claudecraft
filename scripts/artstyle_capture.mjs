// THROWAWAY exploration: capture a combat clip under an art-style treatment at
// REAL GPU quality (ANGLE d3d11), offline single-player. Needs `pnpm dev`.
//
// SCENE=litany (default): the Drowned Litany apse, Sister Nhalia boss.
// SCENE=open + TP_X/TP_Z/BOSS_TEMPLATE/BOSS_LEVEL: teleport + spawn a boss.
//
// Usage: ARTSTYLE=native CAP_SECONDS=30 node scripts/artstyle_capture.mjs
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const STYLE = process.env.ARTSTYLE ?? 'native';
const SCENE = process.env.SCENE ?? 'litany';
const SECONDS = Number(process.env.CAP_SECONDS ?? 30);
const ANGLE = process.env.ANGLE ?? 'd3d11';
const CAM_DIST = Number(process.env.CAM_DIST ?? 16);
const [W, H] = (process.env.WIN ?? '1600,900').split(',').map(Number);
const HIDE_HUD = process.env.HIDE_HUD !== '0';
const CREATURE_SHOW = process.env.CREATURE_SHOW === '1'; // frame the boss creature, drive it to walk + attack
const ENV_ONLY = process.env.ENV_ONLY === '1'; // capture the environment only (no creature/combat), slow cinematic pan
const DUEL = process.env.DUEL === '1'; // hero (player) vs boss, pinned face-off, melee attack clips, over-shoulder cam
const ISOLATE = process.env.ISOLATE === '1'; // render the creature alone on a magenta key (world hidden) for compositing
const ISO_ANIM = process.env.ISO_ANIM ?? 'idle'; // idle | attack (which clip to drive during an ISOLATE capture)
const ISO_LIFT = Number(process.env.ISO_LIFT ?? 0); // lift the creature this many units into the sky for clean isolation
const DUEL2 = process.env.DUEL2 === '1'; // two mobs (hero + enemy) facing off via mutual aggro, side-framed
const HERO_TEMPLATE = process.env.HERO_TEMPLATE ?? 'drowned_warlord'; // the second mob (the hero) in DUEL2

// Art-style presets. Config styles use the engine's real runtime knobs (exposure,
// the sun+hemi 2-light rig, scene fog) plus a CSS canvas filter for the grade nuance.
// norrath = low-res render + ffmpeg nearest-neighbor upscale (chunky pixels).
// britannia = steep, far camera (iso-angle pseudo-orthographic).
const STYLES = {
  native: {
    exposure: 1.06,
    sun: { color: 0xfff1d0, intensity: 3.0 },
    hemi: { sky: 0xdfeeff, ground: 0x60803f, intensity: 1.1 },
    fog: { color: 0xbcd6e8, near: 130, far: 820 },
    filter: 'none',
  },
  grimgilt: {
    exposure: 1.02,
    sun: { color: 0xffb884, intensity: 3.5 },
    hemi: { sky: 0x4e5c78, ground: 0x3a2a1c, intensity: 0.92 },
    fog: { color: 0x241a12, near: 25, far: 330 },
    mat: { roughness: 1.0, metalness: 0.0 },
    filter: 'none',
    post: '[0:v]eq=saturation=0.82:contrast=1.12:brightness=-0.01,colorbalance=rm=0.06:gm=0.01:bm=-0.05,vignette=PI/4.5,noise=alls=5:allf=t[out]',
  },
  grimdark_pro: {
    // Production-pushed Grimgilt for environments: Elden Ring layered-fog melancholy
    // + Diablo IV gothic gloom. Desaturated cool shadows, warm ember highlights, bloom, grain.
    exposure: 1.04,
    sun: { color: 0xffa860, intensity: 3.8 },
    hemi: { sky: 0x46526e, ground: 0x342a1e, intensity: 1.15 },
    fog: { color: 0x222732, near: 22, far: 260 },
    mat: { roughness: 1.0, metalness: 0.0 },
    filter: 'none',
    post: "[0:v]eq=saturation=0.72:contrast=1.12:brightness=0.01:gamma=1.0,colorbalance=rs=-0.03:bs=0.06:rm=0.05:bm=-0.03:rh=0.07:bh=-0.06,curves=all='0/0.035 0.5/0.52 1/1',split=2[a][b];[b]gblur=sigma=8,curves=all='0/0 0.62/0.04 1/0.72'[bl];[a][bl]blend=all_mode=screen:all_opacity=0.3,vignette=PI/3.6,noise=alls=6:allf=t[out]",
  },
  ashfell: {
    exposure: 1.0,
    sun: { color: 0xa9bccc, intensity: 2.7 },
    hemi: { sky: 0x5a6773, ground: 0x3a424a, intensity: 1.05 },
    fog: { color: 0x54626e, near: 70, far: 380 },
    filter: 'saturate(0.34) contrast(1.10) brightness(1.0)',
  },
  oldrealm: {
    tier: 'medium', // NOT low: low drops the toppled-idol head prop; medium still sheds bloom/AO
    exposure: 1.12,
    sun: { color: 0xfff0c6, intensity: 2.7 },
    hemi: { sky: 0xdcefff, ground: 0x6f8f4c, intensity: 1.45 },
    fog: { color: 0xbcd6e8, near: 240, far: 950 },
    mat: { flatShading: true, roughness: 1.0, metalness: 0.0 },
    filter: 'saturate(1.30) contrast(1.02) brightness(1.08)',
  },
  // Deep Octopath HD-2D: warm rich light, low miniature-diorama camera, player
  // nameplate off to declutter, and an ffmpeg tilt-shift + jewel grade post.
  // Octopath HD-2D, polished toward Final Fantasy Resonance: warmer cinematic key,
  // deeper jewel haze, stronger tilt-shift + a bloom/glow pass, tighter diorama cam.
  octopath: {
    exposure: 1.18,
    sun: { color: 0xffcf88, intensity: 3.9 },
    hemi: { sky: 0x8aa0d0, ground: 0x6a5038, intensity: 1.35 },
    fog: { color: 0x453c62, near: 40, far: 480 },
    cam: { pitch: 0.78, dist: 11, fov: 50 },
    nameplates: { player: false },
    filter: 'none',
    post: "[0:v]eq=saturation=1.4:contrast=1.06:brightness=0.0,colorbalance=rm=0.06:bm=-0.02,split=3[a][b][c];[b]gblur=sigma=9[bl];[a][bl]blend=all_expr='A*(1-clip((abs(Y/H-0.5)-0.2)/0.14\\,0\\,1))+B*clip((abs(Y/H-0.5)-0.2)/0.14\\,0\\,1)'[ts];[c]gblur=sigma=7,curves=all='0/0 0.6/0.03 1/0.6'[gl];[ts][gl]blend=all_mode=screen:all_opacity=0.24,vignette=PI/6[out]",
  },
  britannia: {
    tier: 'medium', // flatShading at high tier stalls the render on the high-poly Tripo model
    exposure: 1.08,
    sun: { color: 0xffe6b8, intensity: 2.9 },
    hemi: { sky: 0xe0ecf5, ground: 0x7a8a54, intensity: 1.3 },
    fog: { color: 0xc8d8e0, near: 60, far: 430 },
    mat: { flatShading: true },
    filter: 'none',
    post: '[0:v]eq=saturation=1.14:contrast=1.03:brightness=0.02,colorbalance=rm=0.04:gm=0.02,gblur=sigma=0.8,unsharp=5:5:0.8:5:5:0.0,vignette=PI/5[out]',
  },
  // MapleStory: cute, bright, super-saturated flat cartoon. Flat-shaded low-poly,
  // high-key pastel fill, soft (low contrast, lifted gamma), a gentle black outline.
  maplestory: {
    tier: 'medium',
    exposure: 1.22,
    sun: { color: 0xfff2e0, intensity: 2.5 },
    hemi: { sky: 0xffe0f0, ground: 0xa8e0f0, intensity: 1.95 },
    fog: { color: 0xdff2ff, near: 300, far: 1100 },
    mat: { flatShading: true, roughness: 1.0, metalness: 0 },
    filter: 'none',
    post: '[0:v]eq=saturation=1.5:contrast=0.95:brightness=0.06:gamma=1.06,colorbalance=rm=0.03:bm=0.05,split=2[a][b];[b]edgedetect=low=0.08:high=0.2,negate[e];[a][e]blend=all_mode=multiply:all_opacity=0.3[out]',
  },
};
const S = STYLES[STYLE] ?? STYLES.native;
const TIER = process.env.GFX_TIER ?? S.tier ?? 'high';
const [DEV_W, DEV_H] = S.pixelate ? [S.renderW, S.renderH] : [W, H];

// Per-style HUD theme (via the game's own theme.ts knobs) + a CSS canvas grade
// so the world is graded but the HUD DOM stays sharp (no ffmpeg blur on the HUD).
const HUD_THEMES = {
  grimgilt: {
    knobs: {
      accent: '#cc7326',
      border: '#4a2812',
      panel: '#0b0705',
      text: '#e8d8bc',
      textMuted: '#8a6a44',
      rage: '#e04326',
    },
    fancyGold: true,
    canvasFilter: 'contrast(1.08) saturate(0.85) sepia(0.12) brightness(0.95)',
  },
  oldrealm: {
    knobs: {
      accent: '#9ad83a',
      border: '#6f8f2f',
      panel: '#1c2810',
      text: '#f2f6dc',
      textMuted: '#b4c48a',
      hp: '#38d040',
      mana: '#39a0e0',
    },
    canvasFilter: 'saturate(1.28) brightness(1.06)',
  },
  octopath: {
    knobs: {
      accent: '#e6b24a',
      border: '#5a3f6a',
      panel: '#180f26',
      text: '#f2e6d0',
      textMuted: '#a892b8',
    },
    canvasFilter: 'saturate(1.3) contrast(1.05) brightness(1.02)',
  },
  britannia: { preset: 'parchment', canvasFilter: 'saturate(1.12) brightness(1.04)' },
};
const HUD = HUD_THEMES[STYLE];
const OUTDIR = `tmp/artstyle/${STYLE}`;
const FRAMEDIR = `${OUTDIR}/frames`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.rmSync(OUTDIR, { recursive: true, force: true });
fs.mkdirSync(FRAMEDIR, { recursive: true });

const LITANY_MODULES = [
  'litany_sluice',
  'litany_ledger',
  'litany_ring',
  'litany_baptistry',
  'litany_choir_loft',
  'litany_causeway',
  'litany_apse',
];

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  protocolTimeout: 300000,
  args: [
    `--window-size=${W},${H}`,
    '--hide-scrollbars',
    '--mute-audio',
    `--use-angle=${ANGLE}`,
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ],
  defaultViewport: { width: W, height: H },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERR', e.message.slice(0, 200)));
await page.evaluateOnNewDocument(() => {
  try {
    localStorage.setItem('woc_gpu_notice_dismissed', '1');
  } catch {}
});

await page.goto(`${URL}/?gfx=${TIER}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('#btn-offline', { timeout: 120000 });
const booted = await enterOfflineGame(page, {
  charClass: process.env.CHAR_CLASS ?? 'mage',
  charName: 'Slice',
  settleMs: 5000,
  selectorTimeoutMs: 120000,
  gameBootTimeoutMs: 600000,
});
if (!booted) {
  await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 300000, polling: 1000 });
}

const dismissDialogs = async () => {
  await page.evaluate(() => {
    const wanted = /understood|continue|close|okay|ok|got it|accept|dismiss/i;
    for (const b of document.querySelectorAll('button')) {
      const t = (b.textContent || '').trim();
      if (t && wanted.test(t) && b.offsetParent !== null) b.click();
    }
  });
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(200);
  }
};
await dismissDialogs();

const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const ext = gl?.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('GPU:', gpu);

let setup;
if (SCENE === 'litany') {
  await page.evaluate(async () => {
    const data = await import('/src/sim/data.ts');
    window.__delveModuleZOffset = data.delveModuleZOffset;
  });
  await page.evaluate((mods) => {
    const sim = window.__game.sim;
    sim.setPlayerLevel(20);
    sim.player.maxHp = 999999;
    sim.player.hp = 999999;
    sim.enterDelve('drowned_litany', 'normal');
    sim.delveRunForPlayer(sim.playerId).modules = mods.slice();
  }, LITANY_MODULES);
  await sleep(2500);
  await page.evaluate(() => {
    const sim = window.__game.sim;
    const run = sim.delveRunForPlayer(sim.playerId);
    while (run.moduleIndex < 6 && run.moduleIndex < run.modules.length - 1) {
      run.exitPortalOpen = true;
      sim.advanceDelveModule(run);
    }
  });
  await sleep(2600);
  setup = await page.evaluate((camDist) => {
    const sim = window.__game.sim;
    const run = sim.delveRunForPlayer(sim.playerId);
    const zBase = window.__delveModuleZOffset(run.modules, run.moduleIndex);
    let boss = null;
    for (const e of sim.entities.values()) {
      if (e.templateId === 'sister_nhalia_drowned_canticle' && !e.dead) {
        boss = e;
        break;
      }
    }
    if (!boss) return { ok: false, reason: 'boss not found' };
    const p = sim.player;
    const ax = run.origin.x,
      az = run.origin.z + zBase + 72;
    p.pos.x = ax;
    p.pos.z = az - 9;
    p.pos.y = 0;
    p.prevPos = { ...p.pos };
    p.facing = 0;
    sim.rebucket?.(p);
    boss.pos.x = ax;
    boss.pos.z = az;
    boss.inCombat = true;
    boss.aiState = 'attack';
    p.targetId = boss.id;
    p.autoAttack = true;
    if (run.nhaliaBoss) run.nhaliaBoss.bellVolleyTimer = 0.01;
    const inp = window.__game.input;
    if (inp) {
      inp.camYaw = 0;
      inp.camDist = camDist;
    }
    window.__boss = boss;
    return { ok: true, bossHp: boss.hp, bossId: boss.id };
  }, CAM_DIST);
} else {
  const TP_X = Number(process.env.TP_X ?? 0),
    TP_Z = Number(process.env.TP_Z ?? 0);
  const BOSS = process.env.BOSS_TEMPLATE ?? 'jaguar_idol_guardian';
  const BOSS_LEVEL = Number(process.env.BOSS_LEVEL ?? 20);
  setup = await page.evaluate(
    async ({ tx, tz, boss: bossT, blevel, camDist, iso, envOnly, duel2, heroTemplate }) => {
      const sim = window.__game.sim;
      sim.setPlayerLevel(20);
      sim.player.maxHp = 999999;
      sim.player.hp = 999999;
      const p = sim.player;
      const pos = sim.groundPos(tx, tz);
      p.pos = { ...pos };
      p.prevPos = { ...pos };
      p.facing = 0;
      sim.rebucket?.(p);
      if (envOnly) {
        const inp = window.__game.input;
        if (inp) {
          inp.camYaw = 0;
          inp.camDist = camDist;
        }
        return { ok: true, envOnly: true };
      }
      const { spawnMobsForDev } = await import('/src/sim/dev_commands.ts');
      const ids = spawnMobsForDev(sim.ctx, sim.playerId, bossT, 1, blevel);
      if (!ids?.length) return { ok: false, reason: `spawn failed for ${bossT}` };
      const boss = sim.entities.get(ids[0]);
      // move any other same-template residents far out of frame (single-creature shot)
      for (const e of sim.entities.values()) {
        if (e.templateId === boss.templateId && e.id !== boss.id) {
          e.pos.x = 9999;
          e.pos.z = 9999;
          sim.rebucket?.(e);
        }
      }
      const inp = window.__game.input;
      if (duel2) {
        const bpos2 = sim.groundPos(tx + 2.4, tz);
        boss.pos = { ...bpos2 };
        boss.inCombat = true;
        boss.aiState = 'attack';
        sim.rebucket?.(boss);
        const hids = spawnMobsForDev(sim.ctx, sim.playerId, heroTemplate, 1, blevel);
        const hero = hids?.length ? sim.entities.get(hids[0]) : null;
        if (!hero) return { ok: false, reason: `hero spawn failed for ${heroTemplate}` };
        for (const e of sim.entities.values()) {
          if (e.templateId === hero.templateId && e.id !== hero.id) {
            e.pos.x = 9999;
            e.pos.z = 9999;
            sim.rebucket?.(e);
          }
        }
        const hpos = sim.groundPos(tx - 2.4, tz);
        hero.pos = { ...hpos };
        hero.inCombat = true;
        hero.aiState = 'attack';
        sim.rebucket?.(hero);
        boss.aggroTargetId = hero.id;
        hero.aggroTargetId = boss.id;
        if (inp) {
          inp.camYaw = 0;
          inp.camDist = camDist;
        }
        window.__boss = boss;
        window.__hero = hero;
        return {
          ok: true,
          bossId: boss.id,
          heroId: hero.id,
          bossName: boss.templateId,
          heroName: hero.templateId,
        };
      }
      const bpos = sim.groundPos(tx, tz + 9);
      boss.pos = { ...bpos };
      boss.inCombat = true;
      boss.aiState = 'attack';
      p.targetId = boss.id;
      p.autoAttack = true;
      if (inp) {
        inp.camYaw = 0;
        inp.camDist = camDist;
        if (iso) inp.camPitch = 1.12;
      }
      window.__boss = boss;
      return { ok: true, bossHp: boss.hp, bossId: boss.id, bossName: boss.templateId };
    },
    {
      tx: TP_X,
      tz: TP_Z,
      boss: BOSS,
      blevel: BOSS_LEVEL,
      camDist: CAM_DIST,
      iso: !!S.iso,
      envOnly: ENV_ONLY,
      duel2: DUEL2,
      heroTemplate: HERO_TEMPLATE,
    },
  );
}
console.log('setup:', JSON.stringify(setup));
if (!setup.ok) {
  await browser.close();
  process.exit(1);
}

await sleep(1000); // let the region-load overlay appear after a far teleport
await page
  .waitForFunction(
    () => {
      const l = document.getElementById('loading-screen');
      if (!l) return true;
      const cs = getComputedStyle(l);
      return (
        l.offsetParent === null ||
        cs.display === 'none' ||
        cs.visibility === 'hidden' ||
        Number(cs.opacity) === 0
      );
    },
    { timeout: 60000, polling: 300 },
  )
  .catch(() => {});
await sleep(Number(process.env.STREAM_MS ?? 3500)); // settle foliage/props LOD + chase cam
await dismissDialogs();

if (HIDE_HUD) {
  await page.evaluate(() => {
    for (const id of ['ui', 'nameplates']) {
      const el = document.getElementById(id);
      if (el) el.style.setProperty('display', 'none', 'important');
    }
  });
}

// --- apply the art-style treatment; runs for EVERY style incl. native so all
// share one pinned base scene state and differ only by the treatment ---
{
  const styleErr = await page.evaluate((s) => {
    const r = window.__game.renderer;
    if (!r) return 'no renderer';
    try {
      if (s.exposure != null && r.webgl) r.webgl.toneMappingExposure = s.exposure;
      if (s.sun && r.sun) {
        r.sun.color.setHex(s.sun.color);
        r.sun.intensity = s.sun.intensity;
      }
      if (s.hemi && r.hemi) {
        r.hemi.color.setHex(s.hemi.sky);
        r.hemi.groundColor.setHex(s.hemi.ground);
        r.hemi.intensity = s.hemi.intensity;
      }
      if (s.fog && r.scene?.fog) {
        r.scene.fog.color.setHex(s.fog.color);
        r.scene.fog.near = s.fog.near;
        r.scene.fog.far = s.fog.far;
      }
      r.updateAmbience = () => {}; // freeze per-frame easing so the style holds
      if (s.filter && s.filter !== 'none' && r.webgl?.domElement) {
        r.webgl.domElement.style.filter = s.filter;
      }
      return null;
    } catch (e) {
      return e.message;
    }
  }, S);
  if (styleErr) console.log('STYLEERR', styleErr);
}
await sleep(500);

// --- camera / materials / nameplates per style (runtime) ---
await page.evaluate((s) => {
  const r = window.__game.renderer,
    inp = window.__game.input;
  try {
    if (s.cam && inp) {
      if (s.cam.pitch != null) inp.camPitch = s.cam.pitch;
      if (s.cam.dist != null) inp.camDist = s.cam.dist;
      if (s.cam.fov != null && r.setCameraFov) r.setCameraFov(s.cam.fov);
    }
    if (s.nameplates) {
      if (s.nameplates.player === false) r.showPlayerNameplates = false;
      if (s.nameplates.all === false) r.showNameplates = false;
    }
    if (s.mat) {
      const seen = new Set();
      r.scene.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          if (!m || seen.has(m)) continue;
          if (m.isShaderMaterial || m.isMeshPhongMaterial) continue;
          if (m.blending && m.blending !== 1) continue; // skip additive/vfx
          seen.add(m);
          if (s.mat.flatShading != null) m.flatShading = s.mat.flatShading;
          if (s.mat.roughness != null && m.isMeshStandardMaterial) m.roughness = s.mat.roughness;
          if (s.mat.metalness != null && m.isMeshStandardMaterial) m.metalness = s.mat.metalness;
          if (s.mat.emissiveIntensity != null && m.emissive)
            m.emissiveIntensity = s.mat.emissiveIntensity;
          m.needsUpdate = true;
        }
      });
    }
  } catch (e) {
    console.log('APPLYERR', e.message);
  }
}, S);
await sleep(900); // material relink + camera ease settle

// --- HUD theme + fixes + still (when HUD is shown) ---
if (!HIDE_HUD && HUD) {
  const hudErr = await page.evaluate(async (h) => {
    const r = window.__game.renderer;
    try {
      const t = await import('/src/ui/theme.ts');
      const knobs = t.resolveTheme({ preset: h.preset || 'classic', custom: h.knobs || {} });
      const vars = t.themeCssVars(knobs);
      for (const k in vars) document.documentElement.style.setProperty(k, vars[k]);
      document.documentElement.classList.toggle('fancy-gold-ui', !!h.fancyGold);
      document.documentElement.style.setProperty('--target-frame-width', '290px'); // fix: target name no longer truncates
      if (r) r.showPlayerNameplates = false; // fix: hide idle player nameplate
      const sim = window.__game.sim;
      if (sim?.player) sim.player.autoAttack = false; // fix: no cast-label clutter in the still
      if (h.canvasFilter && r?.webgl?.domElement) r.webgl.domElement.style.filter = h.canvasFilter;
      return null;
    } catch (e) {
      return e.message;
    }
  }, HUD);
  if (hudErr) console.log('HUDERR', hudErr);
  await sleep(700);
}

// HUD-still mode: capture the themed HUD frame and exit (no clip, no ffmpeg blur).
if (process.env.HUD_STILL === '1') {
  await page.screenshot({ path: `${OUTDIR}/hud.png` });
  console.log('wrote HUD still', `${OUTDIR}/hud.png`);
  await browser.close();
  process.exit(0);
}

// --- screencast capture while driving combat ---
const client = await page.target().createCDPSession();
// Pin the compositor surface: screencast captures the widget surface, not the
// page viewport. DEV_W x DEV_H is full res, or a low res for the pixelate style.
await client.send('Emulation.setDeviceMetricsOverride', {
  width: DEV_W,
  height: DEV_H,
  deviceScaleFactor: 1,
  mobile: false,
  screenWidth: DEV_W,
  screenHeight: DEV_H,
});
let seq = 0;
client.on('Page.screencastFrame', async (f) => {
  try {
    fs.writeFileSync(
      `${FRAMEDIR}/f${String(seq++).padStart(5, '0')}.jpg`,
      Buffer.from(f.data, 'base64'),
    );
  } catch {}
  try {
    await client.send('Page.screencastFrameAck', { sessionId: f.sessionId });
  } catch {}
});
await client.send('Page.startScreencast', {
  format: 'jpeg',
  quality: 88,
  maxWidth: DEV_W,
  maxHeight: DEV_H,
  everyNthFrame: 1,
});

const camRe = S.cam || (S.iso ? { pitch: 1.12, dist: CAM_DIST } : null);
const t0 = Date.now();
let tick = 0;
while (Date.now() - t0 < SECONDS * 1000) {
  if (DUEL2) {
    await page
      .evaluate(
        ({ camDist, tick }) => {
          const sim = window.__game.sim,
            r = window.__game.renderer,
            inp = window.__game.input;
          const p = sim.player,
            boss = window.__boss,
            hero = window.__hero;
          if (!boss || !hero) return;
          if (r) {
            r.showPlayerNameplates = false;
            r.showNameplates = false;
          }
          if (typeof p.scale === 'number') p.scale = 0.001;
          p.name = '';
          p.targetId = null;
          p.autoAttack = false;
          if (!window.__d2)
            window.__d2 = {
              bx: boss.pos.x,
              bz: boss.pos.z,
              by: boss.pos.y,
              hx: hero.pos.x,
              hz: hero.pos.z,
              hy: hero.pos.y,
              mx: (boss.pos.x + hero.pos.x) / 2,
              mz: (boss.pos.z + hero.pos.z) / 2,
              my: boss.pos.y,
            };
          const d = window.__d2;
          boss.pos.x = d.bx;
          boss.pos.z = d.bz;
          boss.pos.y = d.by;
          boss.aggroTargetId = hero.id;
          boss.inCombat = true;
          sim.rebucket?.(boss);
          hero.pos.x = d.hx;
          hero.pos.z = d.hz;
          hero.pos.y = d.hy;
          hero.aggroTargetId = boss.id;
          hero.inCombat = true;
          sim.rebucket?.(hero);
          if (boss.maxHp != null) boss.hp = boss.maxHp;
          if (hero.maxHp != null) hero.hp = hero.maxHp;
          p.pos.x = d.mx;
          p.pos.z = d.mz;
          p.pos.y = d.my;
          sim.rebucket?.(p);
          if (inp) {
            inp.camYaw = Math.PI;
            inp.camDist = camDist;
            inp.camPitch = 0.28;
          }
          try {
            r.setCameraFov(52);
          } catch {}
          if (tick % 8 === 0) {
            try {
              r.triggerAttack(hero.id);
            } catch {}
          }
          if (tick % 8 === 4) {
            try {
              r.triggerAttack(boss.id);
            } catch {}
          }
          const np = document.getElementById('nameplates');
          if (np) np.style.setProperty('display', 'none', 'important');
        },
        { camDist: CAM_DIST, tick },
      )
      .catch(() => {});
  } else if (DUEL) {
    await page
      .evaluate(
        ({ camDist, tick }) => {
          const sim = window.__game.sim,
            r = window.__game.renderer,
            inp = window.__game.input;
          const p = sim.player,
            boss = window.__boss;
          if (!boss || boss.dead) return;
          if (r) {
            r.showPlayerNameplates = false;
            r.showNameplates = false;
          }
          p.name = '';
          p.autoAttack = false;
          p.targetId = null;
          if (!window.__duel) window.__duel = { ex: boss.pos.x, ez: boss.pos.z, ey: boss.pos.y };
          const d = window.__duel;
          boss.pos.x = d.ex;
          boss.pos.z = d.ez;
          boss.pos.y = d.ey;
          boss.aiState = 'idle';
          boss.inCombat = true;
          sim.rebucket?.(boss);
          if (boss.maxHp != null) boss.hp = boss.maxHp;
          const HDIST = 3.6; // hero stands in front of the enemy (whose front faces -Z)
          p.pos.x = d.ex;
          p.pos.z = d.ez - HDIST;
          p.pos.y = d.ey;
          sim.rebucket?.(p);
          p.facing = Math.atan2(d.ex - p.pos.x, d.ez - p.pos.z); // face the enemy
          if (p.maxHp != null) p.hp = p.maxHp;
          if (inp) {
            inp.camYaw = 0;
            inp.camDist = camDist;
            inp.camPitch = 0.34;
          } // over-shoulder boss-fight
          const np = document.getElementById('nameplates');
          if (np) np.style.setProperty('display', 'none', 'important');
          if (tick % 6 === 0) {
            try {
              r.triggerAttack(sim.playerId);
            } catch {}
          } // hero melee swing
          if (tick % 6 === 3) {
            try {
              r.triggerAttack(boss.id);
            } catch {}
          } // enemy attack
        },
        { camDist: CAM_DIST, tick },
      )
      .catch(() => {});
  } else if (ISOLATE) {
    await page
      .evaluate(
        ({ camDist, isoAnim, tick }) => {
          const sim = window.__game.sim,
            r = window.__game.renderer,
            inp = window.__game.input;
          const p = sim.player,
            boss = window.__boss;
          if (!boss || boss.dead) return;
          if (r) {
            r.showPlayerNameplates = false;
            r.showNameplates = false;
          }
          if (typeof p.scale === 'number') p.scale = 0.001;
          p.name = '';
          if (!window.__iso) {
            window.__iso = true;
            try {
              r.webgl.setClearColor(0xff00ff, 1);
            } catch {}
            try {
              r.scene.background = null;
            } catch {}
            try {
              if (r.scene.fog) {
                r.scene.fog.color.setHex(0xff00ff);
                r.scene.fog.near = 100000;
                r.scene.fog.far = 100010;
              }
            } catch {}
            const grp = r.views?.get ? r.views.get(boss.id)?.group : null;
            const keep = new Set();
            if (grp) grp.traverse((o) => keep.add(o));
            r.scene.traverse((o) => {
              if (o.isLight || keep.has(o)) return;
              if (o.visible && (o.isMesh || o.isPoints || o.isSprite || o.isLine))
                o.visible = false;
            });
          }
          if (!window.__cpos) window.__cpos = { x: boss.pos.x, z: boss.pos.z, y: boss.pos.y };
          const c = window.__cpos,
            LY = c.y + lift;
          boss.pos.x = c.x;
          boss.pos.z = c.z;
          boss.pos.y = LY;
          boss.aiState = 'idle';
          boss.inCombat = false;
          sim.rebucket?.(boss);
          if (boss.maxHp != null) boss.hp = boss.maxHp;
          p.pos.x = c.x;
          p.pos.z = c.z;
          p.pos.y = LY;
          sim.rebucket?.(p);
          if (inp) {
            inp.camYaw = Math.PI / 2;
            inp.camDist = camDist;
            inp.camPitch = lift > 0 ? 0.02 : 0.14;
          } // side profile
          try {
            r.setCameraFov(48);
          } catch {}
          if (isoAnim === 'attack' && tick % 7 === 0) {
            try {
              r.triggerAttack(boss.id);
            } catch {}
          }
          const np = document.getElementById('nameplates');
          if (np) np.style.setProperty('display', 'none', 'important');
        },
        { camDist: CAM_DIST, isoAnim: ISO_ANIM, tick, lift: ISO_LIFT },
      )
      .catch(() => {});
  } else if (ENV_ONLY) {
    const elapsed = (Date.now() - t0) / 1000;
    await page
      .evaluate(
        ({ camDist, elapsed }) => {
          const sim = window.__game.sim,
            r = window.__game.renderer,
            inp = window.__game.input;
          const p = sim.player;
          if (r) {
            r.showPlayerNameplates = false;
            r.showNameplates = false;
          }
          if (typeof p.scale === 'number') p.scale = 0.001; // hide the player
          p.name = '';
          p.targetId = null;
          p.autoAttack = false;
          if (!window.__epos) window.__epos = { x: p.pos.x, z: p.pos.z, y: p.pos.y };
          const c = window.__epos;
          p.pos.x = c.x;
          p.pos.z = c.z;
          p.pos.y = c.y;
          sim.rebucket?.(p);
          if (inp) {
            inp.camYaw = elapsed * 0.11;
            inp.camDist = camDist;
            inp.camPitch = 0.16;
          } // slow cinematic pan
          const np = document.getElementById('nameplates');
          if (np) np.style.setProperty('display', 'none', 'important');
        },
        { camDist: CAM_DIST, elapsed },
      )
      .catch(() => {});
  } else if (CREATURE_SHOW) {
    // Turntable: PIN the creature stationary at its spawn (no drift/wander) so it
    // idles + attacks in place, orbit the camera around it, hide the player, and fire
    // the attack clip on a cadence. No movement -> no slide/drift.
    const elapsed = (Date.now() - t0) / 1000;
    await page
      .evaluate(
        ({ camDist, doAttack, elapsed }) => {
          const sim = window.__game.sim,
            r = window.__game.renderer,
            inp = window.__game.input;
          const p = sim.player,
            boss = window.__boss;
          if (!boss || boss.dead) return;
          if (r) {
            r.showPlayerNameplates = false;
            r.showNameplates = false;
          } // hide all overhead plates
          if (typeof p.scale === 'number') p.scale = 0.001; // hide the player
          p.targetId = null;
          p.autoAttack = false;
          p.name = ''; // no reticle, no player nameplate
          if (!window.__cpos) window.__cpos = { x: boss.pos.x, z: boss.pos.z, y: boss.pos.y };
          const c = window.__cpos;
          boss.pos.x = c.x;
          boss.pos.z = c.z;
          boss.pos.y = c.y;
          boss.aiState = 'idle';
          boss.inCombat = false;
          sim.rebucket?.(boss); // facing writes are ignored; the mob holds its spawn facing (front faces -Z)
          if (boss.maxHp != null) boss.hp = boss.maxHp;
          const R = 3.2; // camera on the creature's front side (-Z), gentle side-to-side arc for life
          const A = Math.PI + Math.sin(elapsed * 0.28) * 0.32;
          p.pos.x = c.x + Math.sin(A) * R;
          p.pos.z = c.z + Math.cos(A) * R;
          p.pos.y = c.y;
          sim.rebucket?.(p);
          if (inp) {
            inp.camYaw = Math.atan2(c.x - p.pos.x, c.z - p.pos.z);
            inp.camDist = camDist;
            inp.camPitch = 0.33;
          }
          try {
            r.setCameraFov(60);
          } catch {} // consistent fov across styles (octopath's 55 zoom-cut the creature)
          if (doAttack) {
            try {
              r.triggerAttack(boss.id);
            } catch {}
          }
        },
        { camDist: CAM_DIST, doAttack: tick % 8 === 0, elapsed },
      )
      .catch(() => {});
  } else {
    const doCast = tick % 4 === 0;
    const slot = Math.floor(tick / 4) % 6;
    await page
      .evaluate(
        ({ doCast, slot, cam }) => {
          const sim = window.__game.sim;
          const p = sim.player,
            boss = window.__boss;
          if (!boss || boss.dead) return;
          const dx = boss.pos.x - p.pos.x,
            dz = boss.pos.z - p.pos.z;
          const ang = Math.atan2(dx, dz);
          p.facing = ang;
          const inp = window.__game.input;
          if (inp) {
            inp.camYaw = ang;
            if (cam) {
              if (cam.pitch != null) inp.camPitch = cam.pitch;
              if (cam.dist != null) inp.camDist = cam.dist;
            }
          }
          boss.inCombat = true;
          if (boss.aiState !== 'cast') boss.aiState = 'attack';
          p.targetId = boss.id;
          p.autoAttack = true;
          if (p.maxMana != null) p.mana = p.maxMana;
          if (p.maxHp != null && p.hp < p.maxHp) p.hp = p.maxHp;
          if (boss.maxHp != null && boss.hp < boss.maxHp * 0.12) boss.hp = boss.maxHp * 0.6;
          if (doCast) {
            try {
              sim.castAbilityBySlot(slot, sim.playerId, { x: boss.pos.x, z: boss.pos.z });
            } catch {}
          }
          const run = sim.delveRunForPlayer?.(sim.playerId);
          if (run?.nhaliaBoss && (run.nhaliaBoss.bellVolleyTimer ?? 0) > 3)
            run.nhaliaBoss.bellVolleyTimer = 0.01;
        },
        { doCast, slot, cam: camRe },
      )
      .catch(() => {});
  }
  tick++;
  await sleep(300);
}
await client.send('Page.stopScreencast');
console.log('frames captured:', seq);

await page.screenshot({ path: `${OUTDIR}/hero_raw.png` });
await browser.close();

const fps = Math.max(12, Math.round(seq / SECONDS));
let ffArgs;
if (S.post) {
  ffArgs = [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    `${FRAMEDIR}/f%05d.jpg`,
    '-filter_complex',
    S.post,
    '-map',
    '[out]',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    `${OUTDIR}/${STYLE}.mp4`,
  ];
} else {
  const vf = S.pixelate ? ['-vf', `scale=${W}:${H}:flags=neighbor`] : [];
  ffArgs = [
    '-y',
    '-framerate',
    String(fps),
    '-i',
    `${FRAMEDIR}/f%05d.jpg`,
    ...vf,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    `${OUTDIR}/${STYLE}.mp4`,
  ];
}
execFileSync('ffmpeg', ffArgs, { stdio: 'inherit' });
if (S.post) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      `${OUTDIR}/hero_raw.png`,
      '-filter_complex',
      S.post,
      '-map',
      '[out]',
      `${OUTDIR}/hero.png`,
    ],
    { stdio: 'ignore' },
  );
} else if (S.pixelate) {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      `${OUTDIR}/hero_raw.png`,
      '-vf',
      `scale=${W}:${H}:flags=neighbor`,
      `${OUTDIR}/hero.png`,
    ],
    { stdio: 'ignore' },
  );
} else {
  fs.renameSync(`${OUTDIR}/hero_raw.png`, `${OUTDIR}/hero.png`);
}
console.log('wrote', `${OUTDIR}/${STYLE}.mp4`, 'at', fps, 'fps; hero', `${OUTDIR}/hero.png`);
