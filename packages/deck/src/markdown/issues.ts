/**
 * The diagnostics of the deck Markdown dialect: stable `md-*` codes, each
 * with its severity and meaning, reported as the engine's `DeckDiagnostic`
 * with a `source` line and column (1-based; columns count UTF-16 units).
 */
import {
  createDiagnostic,
  type DeckDiagnostic,
  type DiagnosticSeverity,
  type DiagnosticSource,
  type PathSegment,
} from '../schema/index.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';

export interface DeckMarkdownCodeInfo {
  readonly severity: DiagnosticSeverity;
  readonly meaning: string;
}

function code(severity: DiagnosticSeverity, meaning: string): DeckMarkdownCodeInfo {
  return Object.freeze({ severity, meaning });
}

/** Every code the Markdown reader and writer report. */
export const DECK_MARKDOWN_CODES = Object.freeze({
  'md-too-large': code('error', 'The document is over the byte, line or line-length bound.'),
  'md-invisible-char': code(
    'error',
    'A control, bidi or invisible formatting character (removed before parsing).'
  ),
  'md-frontmatter-key': code('error', 'The frontmatter key is not in the closed key set.'),
  'md-frontmatter-value': code(
    'error',
    'The frontmatter value is not a scalar of the right type (no lists, maps or YAML tags).'
  ),
  'md-frontmatter-unclosed': code('error', 'The frontmatter has no closing `---`.'),
  'md-title-missing': code('warning', 'No `title` in the frontmatter; one was derived.'),
  'md-html-refused': code(
    'error',
    'Raw HTML is refused; it renders nothing (inline tags stay text).'
  ),
  'md-iframe-refused': code('error', 'iframes (tags and backgrounds) are refused.'),
  'md-css-refused': code('error', 'A CSS value (gradient, url()) is refused; use a preset.'),
  'md-class-refused': code('error', 'A `class` that maps to nothing is refused.'),
  'md-style-refused': code('error', 'A `style` attribute is refused.'),
  'md-handler-refused': code('error', 'An `on*` event handler attribute is refused.'),
  'md-attr-unknown': code('error', 'The attribute is not in the closed attribute set.'),
  'md-attr-unsupported': code('warning', 'A reveal.js attribute with no deck equivalent; dropped.'),
  'md-attr-value': code('error', 'The attribute value is invalid, or the comment is malformed.'),
  'md-attr-duplicate': code('error', 'The attribute is set twice for the same target.'),
  'md-attr-conflict': code('error', 'Two attributes contradict each other.'),
  'md-comment-unclosed': code('error', 'An HTML comment never closes before the end of the slide.'),
  'md-element-orphan': code('error', 'An `.element` comment has no element before it.'),
  'md-effect-approximated': code(
    'warning',
    'A reveal.js fragment effect with no exact equivalent was mapped to the nearest one.'
  ),
  'md-fragment-approximated': code(
    'warning',
    'Per-item fragments that differ were folded into one list-level step.'
  ),
  'md-fragment-not-steppable': code(
    'warning',
    'This layout does not reveal that element; the fragment was dropped.'
  ),
  'md-layout-unknown': code('error', 'The `layout` is not one of the 20 layouts or a slide kind.'),
  'md-layout-extra': code('error', 'Content the layout has no field for.'),
  'md-layout-missing': code('error', 'A field the layout needs is missing from the slide.'),
  'md-region-unknown': code('error', 'The `:::` directive is unknown, or not allowed here.'),
  'md-region-unclosed': code(
    'error',
    'A `:::` directive never closes before the end of the slide.'
  ),
  'md-directive-depth': code('error', 'Directives nest deeper than a region holding a fence.'),
  'md-json': code('error', 'A `:::` JSON body is not one valid JSON object.'),
  'md-json-limit': code('error', 'A `:::` JSON body is over a size, depth or node bound.'),
  'md-tier-ignored': code('warning', 'The document cannot choose a trust tier; the host does.'),
  'md-code-unclosed': code('error', 'A code fence never closes before the end of the slide.'),
  'md-code-steps': code('error', 'A `[1-2|4-6]` highlight step list is malformed or too long.'),
  'md-code-offset-unsupported': code(
    'warning',
    'A `[n: …]` line offset is not supported; dropped.'
  ),
  'md-code-info': code('warning', 'Unread text after a code fence language; dropped.'),
  'md-math-unclosed': code('error', 'A `$$` block never closes before the end of the slide.'),
  'md-tex-unsupported': code('error', 'The formula uses TeX outside the supported subset.'),
  'md-tex-limit': code('error', 'The formula is over a size, nesting or node bound.'),
  'md-url-refused': code('error', 'A link or media URL fails the deck URL syntax.'),
  'md-inline-image': code('warning', 'An image inside text renders as its alt text only.'),
  'md-heading-inline': code('warning', 'Headings are plain text; inline Markdown shows literally.'),
  'md-too-many-slides': code('error', 'More than 200 slides; the rest were not read.'),
  'md-stack-start': code('error', 'A `--` vertical slide with no horizontal slide before it.'),
  'md-unrepresentable': code('warning', 'A deck field the Markdown dialect cannot express.'),
} as const);

export type DeckMarkdownCode = keyof typeof DECK_MARKDOWN_CODES;

/** Collects issues with the dialect's cap; errors are counted past the cap. */
export class IssueSink {
  readonly issues: DeckDiagnostic[] = [];
  errors = 0;
  truncated = false;
  readonly max: number;

  constructor(max: number = DECK_MARKDOWN_LIMITS.issues) {
    this.max = max;
  }

  add(issue: DeckDiagnostic): void {
    if (issue.severity === 'error') this.errors++;
    if (this.issues.length >= this.max) {
      this.truncated = true;
      return;
    }
    this.issues.push(issue);
  }

  report(
    code: DeckMarkdownCode,
    message: string,
    source: DiagnosticSource,
    path: readonly PathSegment[] = [],
    fix?: string
  ): void {
    this.add(
      createDiagnostic(code, message, path, {
        severity: DECK_MARKDOWN_CODES[code].severity,
        source,
        ...(fix === undefined ? {} : { fix }),
      })
    );
  }
}
