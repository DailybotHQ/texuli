/**
 * The bindable root element every rendering part accepts (`bind:ref`). Parts
 * that render a `child` snippet leave the element to the consumer; `ref` then
 * stays `null` and the consumer binds its own element.
 */
export interface RefProp {
  /** The part's rendered root element (bindable). */
  ref?: HTMLElement | null;
}
