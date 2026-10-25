/**
 * Live primitive demos (T-site-live-primitives): the data each demo declares
 * in its `<script module>` (`export const spec`). The frame (`LiveDemo.svelte`)
 * builds the props panel, the code sample, the keyboard hints and the
 * controlled and uncontrolled panels from it.
 *
 * Every element a demo renders for an anatomy part carries
 * `data-demo-part="<part>"`, the part's name exactly as the anatomy diagram
 * lists it (`Accordion.Trigger`, or `Trigger` in a namespace import).
 */

/** One prop in the props panel, in the manifest prop kinds. */
export type PropSpec =
  | { kind: 'enum'; name: string; label: string; options: readonly string[]; default: string }
  | { kind: 'boolean'; name: string; label: string; default: boolean }
  | {
      kind: 'number';
      name: string;
      label: string;
      min: number;
      max: number;
      step: number;
      default: number;
    }
  | { kind: 'string'; name: string; label: string; default: string };

export type PropValue = string | number | boolean;
export type DemoValues = Readonly<Record<string, PropValue>>;

/** A keyboard hint: the keys (KeyboardEvent.key values) and what they do. */
export interface KeyHint {
  keys: readonly string[];
  action: string;
}

/**
 * A key check the browser spec runs: focus `focus` inside the uncontrolled
 * panel (after opening it with `open` first, when set: a click, or a
 * right-click with `openWith: 'contextmenu'`), press `press`, then expect
 * `selector` to carry `attribute="value"` (or, with `count`, that many
 * matches), or with `fileChooser` that the system file chooser opened.
 * All selectors are scoped to the panel and its floating content.
 */
export interface KeyCheck {
  open?: string;
  openWith?: 'click' | 'contextmenu';
  focus: string;
  press: string;
  expect: {
    selector?: string;
    attribute?: string;
    value?: string;
    count?: number;
    fileChooser?: boolean;
  };
}

/** A controlled-panel check: click `act` (outside the primitive), then expect. */
export interface ControlCheck {
  act: string;
  expect: { selector: string; attribute?: string; value?: string; count?: number };
}

export interface DemoSpec {
  props: readonly PropSpec[];
  keys: readonly KeyHint[];
  /** One line under the uncontrolled panel's heading. */
  uncontrolled: string;
  /** One line under the controlled panel's heading. */
  controlled: string;
  /** The code sample for the current prop values. */
  code: (values: DemoValues) => string;
  keyCheck?: KeyCheck;
  controlCheck: ControlCheck;
}

export type DemoMode = 'uncontrolled' | 'controlled';

/** The props every demo component receives from the frame. */
export interface DemoProps {
  values: DemoValues;
  mode: DemoMode;
  /** Where floating parts portal to: inside the themed, directed frame. */
  portal: HTMLElement | undefined;
  /** Reading direction of the frame (some primitives take `dir`). */
  dir: 'ltr' | 'rtl';
}

/** The initial values of a spec's props. */
export function defaultValues(spec: Pick<DemoSpec, 'props'>): Record<string, PropValue> {
  return Object.fromEntries(spec.props.map((prop) => [prop.name, prop.default]));
}

/** Typed readers for demo components (a wrong kind falls back). */
export function str(values: DemoValues, name: string, fallback = ''): string {
  const value = values[name];
  return typeof value === 'string' ? value : fallback;
}
export function num(values: DemoValues, name: string, fallback = 0): number {
  const value = values[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function bool(values: DemoValues, name: string, fallback = false): boolean {
  const value = values[name];
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Attribute text for a code sample: `name` for true, nothing for the default,
 * `name="value"` for strings and `name={n}` for numbers.
 */
export function attr(name: string, value: PropValue, fallback?: PropValue): string {
  if (value === fallback) return '';
  if (typeof value === 'boolean') return value ? ` ${name}` : ` ${name}={false}`;
  if (typeof value === 'number') return ` ${name}={${value}}`;
  return ` ${name}="${value}"`;
}

/** Display text for a key in a hint. */
export function keyLabel(key: string): string {
  const names: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Escape: 'Esc',
  };
  return names[key] ?? key;
}

/** Accessible name for a key in a hint (arrows read as words). */
export function keyName(key: string): string {
  const names: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up arrow',
    ArrowDown: 'Down arrow',
    ArrowLeft: 'Left arrow',
    ArrowRight: 'Right arrow',
    Escape: 'Escape',
  };
  return names[key] ?? key;
}

/**
 * A code-sample line for the Texuli style options a demo applies through a
 * class recipe (they are not primitive props), for example
 * `<!-- Styled with dialogContentClass({ size: 'lg' }) from 'texuli/dialog' -->`.
 */
export function recipeLine(recipe: string, from: string, options: DemoValues): string {
  const entries = Object.entries(options).map(
    ([name, value]) => `${name}: ${typeof value === 'string' ? `'${value}'` : String(value)}`
  );
  const call = entries.length ? `${recipe}({ ${entries.join(', ')} })` : `${recipe}()`;
  return `<!-- Styled with ${call} from '${from}' -->`;
}

/** The closing script tag for code samples (written whole, it would end a Svelte script block). */
export const SCRIPT_END = '</' + 'script>';
