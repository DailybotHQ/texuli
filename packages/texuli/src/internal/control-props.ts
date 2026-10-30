/**
 * Where the extra attributes of a styled form component go (FIX-choice-aria).
 *
 * A styled control often wraps its focusable control (a checkbox button, an
 * input) in a field wrapper. Attributes a consumer passes split in two:
 * - **control**: `aria-*`, `data-*`, event handlers (`on*`) and the form and
 *   focus attributes below. They name, describe and wire the control, so an
 *   unlabeled control keeps `aria-label` (WCAG 4.1.2).
 * - **wrapper**: everything else (`style`, `hidden`, `dir`, `lang`…).
 *   `class` follows each component's own rule:
 *   the wrapper when labeled, the control when unlabeled (the same rule as
 *   `ref`).
 */
// Form and focus attributes that can reach a component's rest props (`id`,
// `name`, `value`, `disabled` and `required` are explicit props of every
// component that splits, and they go to the control already).
const CONTROL_ATTRIBUTES =
  /^(?:aria-|data-|on[a-z])|^(?:tabindex|title|autofocus|form|readonly|autocomplete|inputmode|placeholder)$/;

export interface ControlPropsSplit {
  control: Record<string, unknown>;
  wrapper: Record<string, unknown>;
}

/** Split a component's rest props into control and wrapper attributes. */
export function splitControlProps(props: Readonly<Record<string, unknown>>): ControlPropsSplit {
  const control: Record<string, unknown> = {};
  const wrapper: Record<string, unknown> = {};
  for (const name in props) (CONTROL_ATTRIBUTES.test(name) ? control : wrapper)[name] = props[name];
  return { control, wrapper };
}

export interface RequiredControlPropsSplit extends ControlPropsSplit {
  /** True when the consumer passed `aria-required` (true or `"true"`). */
  required: boolean;
}

/**
 * {@link splitControlProps} that takes `aria-required` (for example from a
 * Field's control props) out of `control` and reports it as `required`, for
 * the component to apply the supported way. A `group` of date or time
 * segments or a `slider` thumb does not support `aria-required` (axe
 * `aria-allowed-attr`): native `required` goes on each segment input or the
 * slider's form input instead. A checkbox primitive derives
 * `aria-required` from `required`, so a spread one would be overwritten.
 */
export function splitRequiredControlProps(
  props: Readonly<Record<string, unknown>>
): RequiredControlPropsSplit {
  const split = splitControlProps(props);
  const flag = split.control['aria-required'];
  delete split.control['aria-required'];
  return { ...split, required: flag === true || flag === 'true' };
}

/** Join id lists for `aria-describedby` / `aria-labelledby`, dropping empties. */
export function joinIds(...ids: (string | null | undefined | false)[]): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined;
}
