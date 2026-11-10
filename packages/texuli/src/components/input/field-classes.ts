import { variants } from '../../internal/variants.ts';
// Side-effect: recipe-only imports still get Input/Textarea chrome.
import './field.css';

/** Shared field variants for Input and Textarea (standalone chrome). */
export const fieldVariants = variants({
  base: 'tx-field',
  variants: {
    control: {
      input: 'tx-input',
      textarea: 'tx-textarea',
    },
  },
  defaultVariants: {
    control: 'input',
  },
});

/**
 * Input and Textarea appearance: `default` is the bordered control; `plain`
 * drops the control chrome (border, fill, shadow, inline padding) so the text
 * sits in line with the surrounding copy, for inline-edit titles and bodies.
 * Focus stays visible as an outline.
 */
export const FIELD_APPEARANCES = ['default', 'plain'] as const;
export type FieldAppearance = (typeof FIELD_APPEARANCES)[number];

/**
 * Input and Textarea text size. `control` is the form-control size (the
 * default); the rest follow the type scale like Heading and Text: `xs`
 * (caption), `sm`, `md` (body), `lg` (heading role), `xl` (title role),
 * `2xl`–`4xl` (display family on the font-size scale) and `display`.
 */
export const FIELD_SIZES = [
  'control',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  'display',
] as const;
export type FieldSize = (typeof FIELD_SIZES)[number];

/** Hostile or stale values fall back to the defaults. */
export function fieldAppearance(value: unknown): FieldAppearance {
  return (FIELD_APPEARANCES as readonly unknown[]).includes(value)
    ? (value as FieldAppearance)
    : 'default';
}

export function fieldSize(value: unknown): FieldSize {
  return (FIELD_SIZES as readonly unknown[]).includes(value) ? (value as FieldSize) : 'control';
}
