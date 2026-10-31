/**
 * Design values for the PDF writer (ADR-024), loaded only when `design` is
 * passed: the writer's colors with every role the design resolves, and
 * the standard 14 family (Times for a serif body stack, its metrics loaded
 * on use; Helvetica otherwise).
 */
import type { CalloutTone } from '../model/types.ts';
import {
  DESIGN_TONES,
  type DocumentDesign,
  type DocumentDesignRole,
  designHex,
  isSerifStack,
} from '../output/design.ts';
import { HELVETICA_FAMILY, type StandardFamily } from './fonts.ts';
import type { Colors, Rgb } from './pdf.ts';

const rgbOf = (hex: string): Rgb => [
  Number.parseInt(hex.slice(0, 2), 16) / 255,
  Number.parseInt(hex.slice(2, 4), 16) / 255,
  Number.parseInt(hex.slice(4, 6), 16) / 255,
];

export async function pdfDesign(
  design: DocumentDesign,
  base: Colors
): Promise<{ colors: Colors; family: StandardFamily }> {
  const pick = (role: DocumentDesignRole, fallback: Rgb): Rgb => {
    const hex = designHex(design, role);
    return hex ? rgbOf(hex) : fallback;
  };
  const tones = {} as Colors['tones'];
  for (const tone of Object.keys(base.tones) as CalloutTone[]) {
    tones[tone] = {
      fill: pick(DESIGN_TONES[tone].fill, base.tones[tone].fill),
      bar: pick(DESIGN_TONES[tone].bar, base.tones[tone].bar),
    };
  }
  const background = designHex(design, 'background');
  const colors: Colors = {
    ink: pick('foreground', base.ink),
    muted: pick('mutedForeground', base.muted),
    link: pick('link', base.link),
    rule: pick('border', base.rule),
    codeBg: pick('muted', base.codeBg),
    tones,
    page: background && background !== 'FFFFFF' ? rgbOf(background) : null,
  };
  const family = isSerifStack(design.fonts?.sans)
    ? (await import('./times.ts')).TIMES_FAMILY
    : HELVETICA_FAMILY;
  return { colors, family };
}
