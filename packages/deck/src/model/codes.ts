/**
 * Every diagnostic code deck model v2 reports (model-v2 §3.9), with its usual
 * severity and a one-line meaning. JSON validation, the cross-field passes,
 * the untrusted loader, migration and the host hooks all use these codes, so
 * authors, agents and docs read one table. Codes are stable kebab-case.
 */
import type { DeckDiagnostic, DiagnosticSeverity } from '../schema/index.ts';

export interface DeckCodeInfo {
  /** The severity the engine reports this code with. */
  readonly severity: DiagnosticSeverity;
  /** Where it comes from. */
  readonly group: 'structure' | 'cross-field' | 'policy' | 'version' | 'loader' | 'host' | 'style';
  readonly meaning: string;
}

function code(
  severity: DiagnosticSeverity,
  group: DeckCodeInfo['group'],
  meaning: string
): DeckCodeInfo {
  return Object.freeze({ severity, group, meaning });
}

/** The documented code table. `too-many` and `too-deep` are shared by the kit and the loader. */
export const DECK_CODES = Object.freeze({
  // Structure (the schema kit and the layout catalog)
  'invalid-type': code('error', 'structure', 'The value has the wrong JSON type.'),
  required: code('error', 'structure', 'A required key is missing.'),
  'unknown-key': code('error', 'structure', 'The object has a key the model does not define.'),
  'too-short': code('error', 'structure', 'The text is shorter than its minimum (code points).'),
  'too-long': code('error', 'structure', 'The text is longer than its maximum (code points).'),
  'too-few': code('error', 'structure', 'The list has fewer items than its minimum.'),
  'too-many': code(
    'error',
    'structure',
    'The list, record or deck has more items than its maximum.'
  ),
  'out-of-range': code('error', 'structure', 'The number is outside its allowed range.'),
  'not-integer': code('error', 'structure', 'The number must be a whole number.'),
  'not-finite': code('error', 'structure', 'NaN and Infinity are not data.'),
  pattern: code('error', 'structure', 'The text does not match the required syntax.'),
  reserved: code('error', 'structure', 'The value is reserved in this position.'),
  enum: code('error', 'structure', 'The value is not one of the listed values.'),
  'unknown-kind': code('error', 'structure', 'A union `kind` names no known variant.'),
  'unsafe-text': code(
    'error',
    'structure',
    'The text holds control, line-break or bidi-override characters.'
  ),
  'unsafe-key': code(
    'error',
    'structure',
    '`__proto__`, `constructor` and `prototype` are refused.'
  ),
  'too-deep': code('error', 'structure', 'The value nests deeper than allowed.'),
  cycle: code('error', 'structure', 'The value contains itself.'),
  'too-large': code('error', 'loader', 'The input is larger than the byte or node budget.'),
  'invalid-input': code(
    'error',
    'loader',
    'The input is not plain JSON data (accessors, class instances, functions…).'
  ),
  'unknown-layout': code(
    'error',
    'structure',
    'The slide `layout` is not a catalog id or slide kind.'
  ),
  'layout-props': code(
    'error',
    'structure',
    'A layout props rule failed (e.g. comparison row width).'
  ),
  'invalid-block': code(
    'error',
    'structure',
    'A free-slide item is not a block shape (`type`, `id`, step fields).'
  ),
  // Style, theme and backgrounds
  'unknown-background': code('error', 'style', 'The background preset or spec kind is unknown.'),
  'solid-conflict': code('error', 'style', 'A solid background sets both `token` and `color`.'),
  'media-kind': code('error', 'style', 'An image background has a video source, or the reverse.'),
  'invalid-palette-color': code('warning', 'style', 'A palette color could not be read; replaced.'),
  'unknown-theme-kind': code(
    'error',
    'style',
    'A theme reference `kind` is not catalog, embedded or seed.'
  ),
  'embedded-theme': code('error', 'style', 'An embedded theme is not an object.'),
  'unknown-theme': code(
    'warning',
    'style',
    'The catalog theme id is unknown to the host; default used.'
  ),
  'unknown-font-pair': code(
    'warning',
    'style',
    'The font pairing is unknown to the host; theme font used.'
  ),
  'unknown-code-theme': code(
    'warning',
    'style',
    'The code theme is unknown to the host; default used.'
  ),
  // Cross-field (parseDeck)
  'duplicate-id': code('error', 'cross-field', 'A slide or section id is used twice.'),
  'duplicate-block-id': code('error', 'cross-field', 'A block id is used twice in the deck.'),
  'unknown-slide': code('error', 'cross-field', 'A section or `navigation.start` names no slide.'),
  'section-overlap': code('error', 'cross-field', 'A slide is listed in more than one section.'),
  'stack-not-contiguous': code(
    'error',
    'cross-field',
    'A vertical-stack section lists slides that are not adjacent in `slides`.'
  ),
  'start-hidden': code('error', 'cross-field', '`navigation.start` names a hidden slide.'),
  'all-hidden': code('error', 'cross-field', 'Every slide is hidden; nothing would present.'),
  'fragment-conflict': code(
    'error',
    'cross-field',
    'A step marker sets both `fragment` and `reveal`.'
  ),
  'too-many-steps': code('error', 'cross-field', 'A slide has more than 32 distinct steps.'),
  'step-unrevealed': code(
    'warning',
    'cross-field',
    'A step marker sits where the layout reveals nothing.'
  ),
  'step-missing': code(
    'warning',
    'cross-field',
    'A props marker sets `fragment` or `reveal` but no `step`; it is ignored.'
  ),
  // Host phase (parse options)
  'unknown-component': code('error', 'host', 'The component id is not in the host registry.'),
  'component-props': code('error', 'host', 'The host registry refused the component props.'),
  'block-props': code('error', 'host', 'The host block validator refused a block.'),
  // Version and migration
  'unsupported-version': code('error', 'version', '`formatVersion` is not 2.'),
  migrated: code('warning', 'version', 'The input was converted to model v2; review the note.'),
  // Untrusted loader
  'invalid-json': code('error', 'loader', 'The text is not valid JSON (line and column given).'),
  'hidden-characters': code(
    'warning',
    'loader',
    'Invisible or reordering characters were removed from a string.'
  ),
  'invalid-deck': code('error', 'loader', 'The input is not a recognized deck shape.'),
} as const satisfies Record<string, DeckCodeInfo>);

export type DeckCode = keyof typeof DECK_CODES;

/** The deck diagnostic, narrowed to the documented codes. */
export type DeckIssue = DeckDiagnostic<DeckCode>;

/** True when `value` is a documented code (own keys only). */
export function isDeckCode(value: unknown): value is DeckCode {
  return typeof value === 'string' && Object.hasOwn(DECK_CODES, value);
}
