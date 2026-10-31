/**
 * The one compiled-value check every design-system writer shares: the
 * runtime (`applyDesignSystem`, `designSystemStyle`, the no-flash entry, and
 * through them the provider, the slides stage and the player) and the
 * emitters (`emitCss`, the report swatches). Kept tiny: the 2 KB runtime
 * bundles it.
 *
 * A value is printable ASCII with no declaration, block, comment, escape,
 * priority, markup, at-rule or scheme characters, and it calls only color,
 * math and easing functions. So it can never fetch (`url()`, `image()`,
 * `image-set()`, `src()`, `cross-fade()`, `element()`, `paint()`) or read
 * (`var()`, `attr()`), in any case or escaped spelling.
 */

/**
 * Anything outside printable ASCII (controls, bidi, zero-width), the
 * declaration, block, escape, priority, markup and at-rule characters, and
 * comments. Selectors and attribute values pass it too.
 */
export const CSS_UNSAFE = /[^ -~]|[;{}<>\\!@`]|\/\*|\*\//;

/**
 * A design-system id or variant key the default scope selector may hold:
 * every spec id (`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$`) and every spec map key
 * (`^[a-z][a-z0-9-]{0,47}$`) passes, and nothing that could leave the
 * attribute selector (a quote, a bracket, a comma) does.
 */
export const DESIGN_SYSTEM_NAME = /^[a-z][a-z0-9-]*$/;

// A scheme, a protocol-relative URL, or a call to any function but the color,
// math and easing functions the compiler writes (a parenthesis with no name
// before it is grouping). Widen the list when the compiler starts writing a
// new function.
const VALUE_UNSAFE =
  /:|\/\/|(?<![\w-])(?!(?:calc|max|color-mix|cubic-bezier|linear|oklch|rgb)\()[\w-]+\s*\(/i;

/** True when `value` is one safe custom-property value (every writer of compiled values shares it). */
export function isSafeCompiledValue(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 512 ||
    CSS_UNSAFE.test(value) ||
    VALUE_UNSAFE.test(value)
  )
    return false;
  // Balanced quotes and parentheses (n pieces hold n - 1 separators).
  const pieces = (char: string) => value.split(char).length;
  return pieces('"') % 2 === 1 && pieces("'") % 2 === 1 && pieces('(') === pieces(')');
}
