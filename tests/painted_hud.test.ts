// The Painted HUD theme layer: WoC's HUD reskinned to the simpleMMO Painted HUD without
// editing hud.css. These pins hold the theme to its contract: it lives in the empty `hud`
// cascade layer, is scoped under body.hud-painted, is on by default, declares the locked
// faces, and positions every region from the measured --pt-* properties only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOOL_SETTINGS } from '../src/game/settings';

// The fork checkout is CRLF in the working tree while the blobs are LF, so every pin below
// reads a normalised copy and stays true on either checkout.
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const css = read('src/styles/hud.painted.css');
const index = read('src/styles/index.css');
const main = read('src/main.ts');

describe('painted hud theme layer', () => {
  it('is imported into the hud layer after components', () => {
    const at = index.indexOf('@import "./hud.painted.css" layer(hud);');
    expect(at).toBeGreaterThan(index.indexOf('@import "./components.css";'));
    expect(at).toBeLessThan(index.indexOf('@import "./shell.css";'));
  });
  it('wraps every rule in @layer hud and scopes it under body.hud-painted', () => {
    expect(css.trimStart().startsWith('/*')).toBe(true);
    expect(css).toMatch(/^@layer hud \{/m);
    // Selectors sit one level in, inside `@layer hud {`. The match is per line so that a
    // declaration or a closing brace inside an @font-face block cannot pose as a selector.
    const selectors = css.match(/^ {2}[^@\s/][^{\n]*\{/gm) ?? [];
    for (const sel of selectors) expect(sel, sel).toMatch(/^ {2}body\.hud-painted/);
  });
  it('declares the three locked faces from shipped files', () => {
    for (const face of ['"Cinzel"', '"Fira Sans"', '"Barlow Semi Condensed"']) {
      expect(css).toContain(`font-family: ${face};`);
    }
    expect(css).toContain('url("/fonts/fira-sans-400.ttf")');
    expect(css).toContain('url("/fonts/barlow-semi-condensed-700.ttf")');
    expect(css).toContain('url("/fonts/cinzel-400-700-latin.woff2")');
  });
  it('is on by default and toggled by the paintedHud setting', () => {
    expect(BOOL_SETTINGS.paintedHud.def).toBe(true);
    expect(main).toContain("document.body.classList.toggle('hud-painted', on);");
  });
  it('never positions from a literal pixel offset', () => {
    const body = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face \{[^}]*\}/g, '');
    const literal = body.match(/^\s*(left|right|top|bottom|width|height):\s*[0-9.]+px;/gm) ?? [];
    expect(literal).toEqual([]);
  });
});

describe('painted cluster', () => {
  it('seats the bar painting by the measured rail and picks it by class chrome', () => {
    expect(css).toContain('bottom: var(--pt-bar-bottom);');
    expect(css).toContain('width: var(--pt-bar-w);');
    expect(css).toContain('body.hud-painted[data-painted-chrome="reaver"] #bottom-bar::before');
    expect(css).toContain('body.hud-painted[data-painted-chrome="hero"] #bottom-bar::before');
    expect(css).toContain('url("/ui/painted/bar_reaver.webp")');
    expect(css).toContain('url("/ui/painted/bar_hero.webp")');
  });
  // The eight slots are addressed by data-hotbar-slot, not by child index: MovableFrame
  // prepends four nodes of its own to #actionbar (two of them BUTTONs), so nth-child AND
  // nth-of-type both count past the bar's real first slot and seated slot 1 in well 5.
  it('seats each of the eight slots in its measured well', () => {
    for (let n = 1; n <= 8; n++) {
      expect(css).toContain(
        `body.hud-painted #actionbar .action-btn[data-hotbar-slot="${n - 1}"] {`,
      );
      expect(css).toContain(`left: var(--pt-well-${n}-x);`);
    }
  });
  it('fills the orbs and the strip from measured rects', () => {
    for (const p of [
      '--pt-hp-orb-x',
      '--pt-res-orb-x',
      '--pt-strip-top',
      '--pt-strip-end',
      '--pt-level-plate-w',
    ]) {
      expect(css).toContain(`var(${p})`);
    }
  });
});
