/**
 * Design values for the DOCX writer (ADR-024), loaded only when `design`
 * is passed: the package's fonts and colors with every value the design
 * resolves.
 */
import type { CalloutTone } from '../model/types.ts';
import { DESIGN_TONES, type DocumentDesign, designHex, firstFamily } from '../output/design.ts';
import type { DocxTheme } from './docx.ts';

export function docxDesign(design: DocumentDesign, base: DocxTheme): DocxTheme {
  const body = firstFamily(design.fonts?.sans) ?? base.body;
  const heading = firstFamily(design.fonts?.heading);
  const tones = {} as DocxTheme['tones'];
  for (const tone of Object.keys(base.tones) as CalloutTone[]) {
    tones[tone] = {
      fill: designHex(design, DESIGN_TONES[tone].fill) ?? base.tones[tone].fill,
      border: designHex(design, DESIGN_TONES[tone].bar) ?? base.tones[tone].border,
    };
  }
  return {
    body,
    heading: heading && heading !== body ? heading : null,
    mono: firstFamily(design.fonts?.mono) ?? base.mono,
    text: designHex(design, 'foreground'),
    link: designHex(design, 'link') ?? base.link,
    rule: designHex(design, 'border') ?? base.rule,
    code: designHex(design, 'muted') ?? base.code,
    tones,
  };
}
