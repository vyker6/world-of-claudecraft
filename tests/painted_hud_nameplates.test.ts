// The overhead nameplates follow the Painted HUD: the mock's plate width, the ink and gold
// fills, the grade marks, and the condensed level figure.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRADE_MARK, GRADED_NAME_FILL } from '../src/render/nameplate_canvas';
import {
  NAMEPLATE_BASE_WIDTH,
  NAMEPLATE_BOSS_WIDTH,
  NAMEPLATE_HEALTH_HEIGHT,
} from '../src/render/nameplate_pick_core';

// Every source file in this checkout is CRLF, so the newline-embedded expectations below
// read the file as LF rather than pinning the checkout's line endings.
const canvas = readFileSync('src/render/nameplate_canvas.ts', 'utf8').replace(/\r\n/g, '\n');

describe('painted nameplates', () => {
  it('uses the mock plate width and health bar height', () => {
    expect(NAMEPLATE_BASE_WIDTH).toBe(160);
    expect(NAMEPLATE_BOSS_WIDTH).toBe(200);
    expect(NAMEPLATE_HEALTH_HEIGHT).toBe(4);
  });
  it('sets names in Cinzel ink and levels in the condensed face', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: pins source text, not a template
    expect(canvas).toContain("font: `700 14px ${TITLE_FONT}`,\n  fill: '#f0eadc',");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: pins source text, not a template
    expect(canvas).toContain("font: `700 16px ${TITLE_FONT}`,\n  fill: '#f0eadc',");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: pins source text, not a template
    expect(canvas).toContain('font: `700 18px ${LEVEL_FONT}`,');
    expect(canvas).toContain(
      'const LEVEL_FONT = \'"Barlow Semi Condensed", "Fira Sans", sans-serif\';',
    );
  });
  it('marks elites and bosses the way the mock does', () => {
    expect(GRADE_MARK.elite).toBe('◆');
    expect(GRADE_MARK.boss).toBe('♛');
    expect(canvas).toContain("export const GRADED_NAME_FILL = '#e2be6e';");
    expect(GRADED_NAME_FILL).toBe('#e2be6e');
  });
});
