/**
 * CSS system color keywords used under `forced-colors: active` and the
 * high-contrast mode. Only names the platform defines — never hex or oklch.
 * @see https://drafts.csswg.org/css-color/#css-system-colors
 */
export const SYSTEM_COLOR_KEYWORDS = [
  'Canvas',
  'CanvasText',
  'LinkText',
  'VisitedText',
  'ActiveText',
  'ButtonFace',
  'ButtonText',
  'ButtonBorder',
  'Field',
  'FieldText',
  'Highlight',
  'HighlightText',
  'SelectedItem',
  'SelectedItemText',
  'Mark',
  'MarkText',
  'GrayText',
  'AccentColor',
  'AccentColorText',
] as const;

export type SystemColorKeyword = (typeof SYSTEM_COLOR_KEYWORDS)[number];

export function isSystemColorKeyword(value: string): value is SystemColorKeyword {
  return (SYSTEM_COLOR_KEYWORDS as readonly string[]).includes(value);
}
