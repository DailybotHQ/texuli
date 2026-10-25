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

/** Join id lists for `aria-describedby` / `aria-labelledby`, dropping empties. */
export function joinIds(...ids: (string | null | undefined | false)[]): string | undefined {
  return ids.filter(Boolean).join(' ') || undefined;
}
