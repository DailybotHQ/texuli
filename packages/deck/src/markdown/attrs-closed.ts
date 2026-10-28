/**
 * The closed attribute sets: `.slide` attributes (with their reveal.js
 * aliases), `.element` and brace attributes, fragment effect mapping, and the
 * background they assemble. Anything outside the sets is a diagnostic:
 * `class`, `style`, `on*` and iframes are refused by name.
 */
import {
  DECK_BACKGROUND_PRESET_IDS,
  DECK_GRADIENT_IDS,
  DECK_MEDIA_FITS,
  DECK_MEDIA_POSITIONS,
  DECK_PATTERNS,
  DECK_SOLID_TOKENS,
} from '../model/backgrounds/schema.ts';
import { BLOCK_TONES } from '../model/deck.ts';
import {
  BLOCK_REVEALS,
  DECK_TRANSITIONS,
  FRAGMENT_EFFECTS,
  type FragmentEffect,
  type FragmentTone,
  MAX_AUTHORED_STEP,
  SLIDE_ID_PATTERN,
} from '../model/shared.ts';
import type { Attr } from './attributes.ts';
import type { DeckMarkdownCode, IssueSink } from './issues.ts';

const SLUG = new RegExp(SLIDE_ID_PATTERN, 'u');

/** A fragment request read from attributes. */
export interface MarkSpec {
  /** A fragment was asked for (`fragment`, `class="fragment"`, `step` or `reveal`). */
  fragment: boolean;
  effect?: FragmentEffect;
  tone?: FragmentTone | 'neutral';
  reveal?: (typeof BLOCK_REVEALS)[number];
  /** An explicit step number. */
  step?: number;
  line: number;
  column: number;
}

export interface ElementRead {
  mark?: MarkSpec;
  id?: string;
  /** Other allowed attributes, by name. */
  other: Map<string, Attr>;
}

function report(
  sink: IssueSink,
  code: DeckMarkdownCode,
  message: string,
  attr: Attr,
  fix?: string
) {
  sink.report(code, message, { line: attr.line, column: attr.column }, [], fix);
}

/** reveal.js and deck effect names → a deck fragment effect (and tone). */
export function mapEffect(
  name: string
): { effect: FragmentEffect; tone?: FragmentTone; approximate?: boolean } | null {
  if ((FRAGMENT_EFFECTS as readonly string[]).includes(name)) {
    return { effect: name as FragmentEffect };
  }
  switch (name) {
    case 'fade-in':
    case 'fade':
      return { effect: 'in' };
    case 'fade-out':
      return { effect: 'out' };
    case 'fade-in-then-out':
      return { effect: 'in-then-out' };
    case 'highlight-red':
      return { effect: 'highlight', tone: 'danger' };
    case 'highlight-blue':
      return { effect: 'highlight', tone: 'info' };
    case 'highlight-green':
      return { effect: 'highlight', tone: 'success' };
    case 'highlight-current-red':
      return { effect: 'highlight', tone: 'danger', approximate: true };
    case 'highlight-current-blue':
      return { effect: 'highlight', tone: 'info', approximate: true };
    case 'highlight-current-green':
      return { effect: 'highlight', tone: 'success', approximate: true };
    case 'fade-down':
    case 'fade-left':
    case 'fade-right':
    case 'fade-in-then-semi-out':
      return { effect: 'fade-up', approximate: true };
    case 'semi-fade-out':
      return { effect: 'out', approximate: true };
    case 'zoom-in':
      return { effect: 'grow', approximate: true };
    case 'current-visible':
      return { effect: 'in-then-out', approximate: true };
    default:
      return null;
  }
}

function applyEffect(sink: IssueSink, mark: MarkSpec, name: string, attr: Attr): boolean {
  const mapped = mapEffect(name);
  if (!mapped) return false;
  if (mapped.approximate) {
    report(
      sink,
      'md-effect-approximated',
      `"${name}" has no exact deck equivalent; it plays as "${mapped.effect}".`,
      attr
    );
  }
  mark.effect = mapped.effect;
  if (mapped.tone !== undefined && mark.tone === undefined) mark.tone = mapped.tone;
  return true;
}

/** Refusals shared by every attribute set. True when the attribute was handled. */
function refuse(sink: IssueSink, attr: Attr): boolean {
  const name = attr.name.toLowerCase();
  if (name === 'style') {
    report(
      sink,
      'md-style-refused',
      'A `style` attribute is refused.',
      attr,
      'Use a layout, a background or a theme.'
    );
    return true;
  }
  if (/^on/.test(name)) {
    report(
      sink,
      'md-handler-refused',
      `The event handler "${attr.name.slice(0, 40)}" is refused.`,
      attr
    );
    return true;
  }
  if (name.includes('iframe')) {
    report(
      sink,
      'md-iframe-refused',
      'iframes are refused.',
      attr,
      'Use `::: component <id>` instead.'
    );
    return true;
  }
  if (name === 'tier') {
    report(
      sink,
      'md-tier-ignored',
      'A document cannot choose its trust tier; the host does.',
      attr,
      'Remove `tier`.'
    );
    return true;
  }
  return false;
}

const ELEMENT_DATA_UNSUPPORTED = /^data-/;

/**
 * Read `.element` or brace attributes. `allowed` names the extra attributes
 * this target accepts (width, height, avatar…); the fragment attributes and
 * `id` are always read.
 */
export function readElement(
  attrs: readonly Attr[],
  allowed: ReadonlySet<string>,
  sink: IssueSink
): ElementRead {
  const out: ElementRead = { other: new Map() };
  let mark: MarkSpec | undefined;
  const ensure = (attr: Attr): MarkSpec => {
    mark ??= { fragment: false, line: attr.line, column: attr.column };
    return mark;
  };
  const seen = new Set<string>();
  for (const attr of attrs) {
    if (refuse(sink, attr)) continue;
    const name = attr.name === 'data-fragment-index' ? 'step' : attr.name;
    if (seen.has(name) && name !== 'class') {
      report(sink, 'md-attr-duplicate', `"${name}" is set twice.`, attr);
      continue;
    }
    seen.add(name);
    const value = attr.value;
    switch (name) {
      case 'fragment': {
        const m = ensure(attr);
        m.fragment = true;
        if (value !== true && !applyEffect(sink, m, value, attr)) {
          report(
            sink,
            'md-attr-value',
            `Unknown fragment effect "${value.slice(0, 40)}".`,
            attr,
            `Use one of: ${FRAGMENT_EFFECTS.join(', ')}.`
          );
        }
        continue;
      }
      case 'class': {
        const tokens = value === true ? [] : value.split(/\s+/).filter(Boolean);
        if (!tokens.includes('fragment')) {
          report(
            sink,
            'md-class-refused',
            'Classes are refused; only `class="fragment <effect>"` is read.',
            attr,
            'Use `fragment="<effect>"`.'
          );
          continue;
        }
        const m = ensure(attr);
        m.fragment = true;
        for (const token of tokens) {
          if (token === 'fragment') continue;
          if (!applyEffect(sink, m, token, attr)) {
            report(
              sink,
              'md-class-refused',
              `The class "${token.slice(0, 40)}" maps to nothing.`,
              attr
            );
          }
        }
        continue;
      }
      case 'step': {
        const step = value === true ? Number.NaN : Number(value);
        if (
          !Number.isInteger(step) ||
          step < 0 ||
          step > MAX_AUTHORED_STEP ||
          !/^\d+$/.test(String(value))
        ) {
          report(
            sink,
            'md-attr-value',
            `"step" is a whole number from 0 to ${MAX_AUTHORED_STEP}.`,
            attr
          );
          continue;
        }
        const m = ensure(attr);
        m.fragment = true;
        m.step = step;
        continue;
      }
      case 'reveal': {
        if (value === true || !(BLOCK_REVEALS as readonly string[]).includes(value)) {
          report(sink, 'md-attr-value', `"reveal" is one of: ${BLOCK_REVEALS.join(', ')}.`, attr);
          continue;
        }
        const m = ensure(attr);
        m.fragment = true;
        m.reveal = value as (typeof BLOCK_REVEALS)[number];
        continue;
      }
      case 'tone': {
        if (value === true || !(BLOCK_TONES as readonly string[]).includes(value)) {
          report(sink, 'md-attr-value', `"tone" is one of: ${BLOCK_TONES.join(', ')}.`, attr);
          continue;
        }
        ensure(attr).tone = value as FragmentTone | 'neutral';
        continue;
      }
      case 'id': {
        if (value === true || !SLUG.test(value)) {
          report(sink, 'md-attr-value', '"id" is a lowercase slug (a-z, 0-9, -).', attr);
          continue;
        }
        out.id = value;
        continue;
      }
      default:
        break;
    }
    if (allowed.has(name)) {
      out.other.set(name, attr);
      continue;
    }
    if (ELEMENT_DATA_UNSUPPORTED.test(name)) {
      report(
        sink,
        'md-attr-unsupported',
        `"${name.slice(0, 40)}" has no deck equivalent; dropped.`,
        attr
      );
      continue;
    }
    report(sink, 'md-attr-unknown', `Unknown attribute "${name.slice(0, 40)}" here.`, attr);
  }
  if (mark) out.mark = mark;
  return out;
}

// ---------------------------------------------------------------------------
// Slide attributes

/** What `.slide` attributes set on a slide (before ids and layouts are resolved). */
export interface SlideAttrRead {
  id?: string;
  layout?: string;
  master?: string;
  title?: string;
  theme?: string;
  transition?: string;
  hidden?: boolean;
  steps?: string[];
  background?: unknown;
  section?: string;
  sectionTitle?: string;
  sectionEnd?: boolean;
  /** Where each field was written (for the source map). */
  at: Map<string, Attr>;
}

/** reveal.js names → canonical names (values are mapped where they differ). */
const SLIDE_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'data-background-color': 'background-color',
  'data-background-image': 'background-image',
  'data-background-video': 'background-video',
  'data-background-size': 'background-fit',
  'data-background-position': 'background-position',
  'data-background-gradient': 'background-gradient',
  'data-transition': 'transition',
  'data-auto-animate': 'auto-animate',
});

const SLIDE_UNSUPPORTED = new Set([
  'data-transition-speed',
  'data-background-transition',
  'data-autoslide',
  'data-state',
  'data-background-repeat',
  'data-background-interactive',
  'data-auto-animate-id',
  'data-auto-animate-easing',
  'data-auto-animate-duration',
  'data-auto-animate-restart',
  'data-timing',
]);

/** Accepted and implied: background video always loops, muted. */
const SLIDE_IMPLIED = new Set([
  'data-background-video-loop',
  'data-background-video-muted',
  'data-background-video-mute',
]);

const SLIDE_NAMES = new Set([
  'id',
  'layout',
  'master',
  'title',
  'theme',
  'transition',
  'auto-animate',
  'hidden',
  'steps',
  'background',
  'background-color',
  'background-gradient',
  'background-pattern',
  'background-image',
  'background-video',
  'background-poster',
  'background-alt',
  'background-full',
  'background-fit',
  'background-position',
  'background-overlay',
  'tone',
  'section',
  'section-title',
  'section-end',
]);

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandHex(value: string): string {
  if (value.length === 7) return value;
  return `#${[...value.slice(1)].map((c) => c + c).join('')}`;
}

/** Read `.slide` attributes: aliases mapped, refusals reported, the background assembled. */
export function readSlideAttrs(attrs: readonly Attr[], sink: IssueSink): SlideAttrRead {
  const out: SlideAttrRead = { at: new Map() };
  const values = new Map<string, Attr>();
  let overlayClass: { tone: 'dark' | 'light'; overlay: number } | undefined;
  let classTone: 'dark' | 'light' | undefined;

  for (const attr of attrs) {
    if (refuse(sink, attr)) continue;
    const lower = attr.name.toLowerCase();
    if (SLIDE_IMPLIED.has(lower)) continue;
    if (lower === 'data-background-iframe') continue; // refused above (name contains iframe)
    if (SLIDE_UNSUPPORTED.has(lower)) {
      report(sink, 'md-attr-unsupported', `"${attr.name}" has no deck equivalent; dropped.`, attr);
      continue;
    }
    if (lower === 'data-visibility') {
      if (attr.value === 'hidden') values.set('hidden', { ...attr, value: true });
      else report(sink, 'md-attr-value', '`data-visibility` is read only as "hidden".', attr);
      continue;
    }
    if (lower === 'data-background-opacity') {
      const opacity = attr.value === true ? Number.NaN : Number(attr.value);
      if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
        report(sink, 'md-attr-value', '`data-background-opacity` is a number from 0 to 1.', attr);
        continue;
      }
      const overlay = Math.round(Math.min(0.9, Math.max(0, 1 - opacity)) * 100) / 100;
      values.set('background-overlay', { ...attr, value: String(overlay) });
      continue;
    }
    if (lower === 'class') {
      const tokens = attr.value === true ? [] : attr.value.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (token === 'has-dark-background') classTone = 'dark';
        else if (token === 'has-light-background') classTone = 'light';
        else if (token === 'slide-bg-overlay--dark') overlayClass = { tone: 'dark', overlay: 0.6 };
        else if (token === 'slide-bg-overlay--light')
          overlayClass = { tone: 'light', overlay: 0.65 };
        else {
          report(
            sink,
            'md-class-refused',
            `The class "${token.slice(0, 40)}" maps to nothing; classes are refused.`,
            attr,
            'Use a `layout`, `background-*` or `tone` attribute.'
          );
        }
      }
      continue;
    }
    const name = Object.hasOwn(SLIDE_ALIASES, lower) ? (SLIDE_ALIASES[lower] ?? lower) : lower;
    if (!SLIDE_NAMES.has(name)) {
      if (lower.startsWith('data-')) {
        report(
          sink,
          'md-attr-unsupported',
          `"${attr.name.slice(0, 40)}" has no deck equivalent; dropped.`,
          attr
        );
      } else
        report(
          sink,
          'md-attr-unknown',
          `Unknown slide attribute "${attr.name.slice(0, 40)}".`,
          attr
        );
      continue;
    }
    if (values.has(name)) {
      report(sink, 'md-attr-duplicate', `"${name}" is set twice for this slide.`, attr);
      continue;
    }
    values.set(name, { ...attr, name });
  }

  const text = (name: string): string | undefined => {
    const attr = values.get(name);
    if (!attr) return undefined;
    if (attr.value === true) {
      report(sink, 'md-attr-value', `"${name}" needs a value.`, attr);
      return undefined;
    }
    out.at.set(name, attr);
    return attr.value;
  };
  const flag = (name: string): boolean | undefined => {
    const attr = values.get(name);
    if (!attr) return undefined;
    out.at.set(name, attr);
    if (attr.value === true || attr.value === 'true') return true;
    if (attr.value === 'false') return false;
    report(sink, 'md-attr-value', `"${name}" is a flag (or true / false).`, attr);
    return undefined;
  };
  const oneOf = (name: string, allowed: readonly string[]): string | undefined => {
    const value = text(name);
    if (value === undefined) return undefined;
    if (allowed.includes(value)) return value;
    report(
      sink,
      'md-attr-value',
      `"${name}" is one of: ${allowed.join(', ')}.`,
      values.get(name) as Attr
    );
    return undefined;
  };

  const id = text('id');
  if (id !== undefined) out.id = id;
  const layout = text('layout');
  if (layout !== undefined) out.layout = layout;
  const master = text('master');
  if (master !== undefined) out.master = master;
  const title = text('title');
  if (title !== undefined) out.title = title;
  const theme = text('theme');
  if (theme !== undefined) out.theme = theme;
  const hidden = flag('hidden');
  if (hidden !== undefined) out.hidden = hidden;
  const steps = text('steps');
  if (steps !== undefined) out.steps = steps.split('|').map((label) => label.trim());
  const section = text('section');
  if (section !== undefined) out.section = section;
  const sectionTitle = text('section-title');
  if (sectionTitle !== undefined) out.sectionTitle = sectionTitle;
  const sectionEnd = flag('section-end');
  if (sectionEnd === true) out.sectionEnd = true;

  // Transition (auto-animate is reveal's morph)
  const transitionAttr = values.get('transition');
  const autoAnimate = flag('auto-animate');
  if (transitionAttr) {
    const raw = text('transition');
    if (raw !== undefined) {
      const first = raw.split(/\s+/)[0] ?? '';
      const base = first.replace(/-(?:in|out)$/, '');
      if ((DECK_TRANSITIONS as readonly string[]).includes(raw)) out.transition = raw;
      else if (raw === 'convex' || raw === 'concave' || base === 'convex' || base === 'concave') {
        out.transition = 'slide';
        report(
          sink,
          'md-attr-unsupported',
          `The transition "${raw}" plays as "slide".`,
          transitionAttr
        );
      } else if ((DECK_TRANSITIONS as readonly string[]).includes(base)) {
        out.transition = base;
        report(
          sink,
          'md-attr-unsupported',
          `The transition "${raw}" plays as "${base}".`,
          transitionAttr
        );
      } else {
        report(
          sink,
          'md-attr-value',
          `"transition" is one of: ${DECK_TRANSITIONS.join(', ')}.`,
          transitionAttr
        );
      }
    }
  }
  if (autoAnimate === true) {
    if (out.transition !== undefined && out.transition !== 'morph') {
      report(
        sink,
        'md-attr-conflict',
        '`auto-animate` is the morph transition; it conflicts with `transition`.',
        values.get('auto-animate') as Attr
      );
    } else out.transition = 'morph';
  }

  // Background
  const kinds: string[] = [];
  const preset = oneOf('background', DECK_BACKGROUND_PRESET_IDS);
  const colorRaw = text('background-color');
  const gradientRaw = text('background-gradient');
  const pattern = oneOf('background-pattern', DECK_PATTERNS);
  const image = text('background-image');
  const video = text('background-video');
  let background: unknown;
  if (preset !== undefined) {
    kinds.push('background');
    background = preset;
  }
  if (colorRaw !== undefined) {
    kinds.push('background-color');
    if ((DECK_SOLID_TOKENS as readonly string[]).includes(colorRaw)) {
      background = { kind: 'solid', token: colorRaw };
    } else if (HEX.test(colorRaw)) {
      background = { kind: 'solid', color: expandHex(colorRaw) };
    } else {
      report(
        sink,
        /[(;]/.test(colorRaw) ? 'md-css-refused' : 'md-attr-value',
        `"${colorRaw.slice(0, 40)}" is not a palette token or #rrggbb.`,
        values.get('background-color') as Attr,
        `Use ${DECK_SOLID_TOKENS.join(', ')} or #rrggbb.`
      );
    }
  }
  if (gradientRaw !== undefined) {
    kinds.push('background-gradient');
    const match = /^(?:gradient-)?([a-z]+)(?:[ \t]*,?[ \t]*(\d{1,3})(?:deg)?)?$/.exec(
      gradientRaw.trim()
    );
    const name = match?.[1];
    if (match && name !== undefined && (DECK_GRADIENT_IDS as readonly string[]).includes(name)) {
      const spec: Record<string, unknown> = { kind: 'gradient', gradient: name };
      if (match[2] !== undefined) spec.angle = Number(match[2]);
      background = spec;
    } else {
      report(
        sink,
        /[(;:]/.test(gradientRaw) ? 'md-css-refused' : 'md-attr-value',
        'CSS gradients are refused; name a gradient preset.',
        values.get('background-gradient') as Attr,
        `Use one of: ${DECK_GRADIENT_IDS.join(', ')} (optionally with an angle: "dusk, 135deg").`
      );
    }
  }
  if (pattern !== undefined) {
    kinds.push('background-pattern');
    background = { kind: 'pattern', pattern };
  }
  if (image !== undefined || video !== undefined) {
    if (image !== undefined) kinds.push('background-image');
    if (video !== undefined) kinds.push('background-video');
    const full = flag('background-full') === true;
    const spec: Record<string, unknown> =
      image !== undefined
        ? { kind: full ? 'image-full' : 'image', src: image }
        : { kind: full ? 'video-full' : 'video', src: video };
    const alt = text('background-alt');
    if (alt !== undefined) spec.alt = alt;
    const poster = text('background-poster');
    if (poster !== undefined) spec.poster = poster;
    const fit = oneOf('background-fit', DECK_MEDIA_FITS);
    if (fit !== undefined) spec.fit = fit;
    const position = oneOf('background-position', DECK_MEDIA_POSITIONS);
    if (position !== undefined) spec.position = position;
    const tone = oneOf('tone', ['dark', 'light']) ?? classTone ?? overlayClass?.tone;
    if (tone !== undefined) spec.tone = tone;
    const overlayRaw = text('background-overlay');
    if (overlayRaw !== undefined) {
      const overlay = Number(overlayRaw);
      if (!Number.isFinite(overlay)) {
        report(
          sink,
          'md-attr-value',
          '"background-overlay" is a number from 0 to 0.9.',
          values.get('background-overlay') as Attr
        );
      } else spec.overlay = overlay;
    } else if (overlayClass) spec.overlay = overlayClass.overlay;
    background = spec;
  } else {
    for (const name of [
      'background-full',
      'background-alt',
      'background-poster',
      'background-fit',
      'background-position',
      'background-overlay',
      'tone',
    ]) {
      const attr = values.get(name);
      if (attr) {
        report(
          sink,
          'md-attr-conflict',
          `"${name}" applies only to an image or video background.`,
          attr
        );
      }
    }
  }
  if (kinds.length > 1) {
    report(
      sink,
      'md-attr-conflict',
      `A slide has one background; it sets ${kinds.join(' and ')}.`,
      values.get(kinds[1] ?? '') as Attr
    );
  }
  if (background !== undefined) {
    out.background = background;
    out.at.set('background', values.get(kinds[0] ?? '') as Attr);
  }
  return out;
}
