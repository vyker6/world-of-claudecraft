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
