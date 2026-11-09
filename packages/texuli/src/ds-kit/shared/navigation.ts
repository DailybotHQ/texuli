/**
 * The kit's sections and their stable ids (kit API §11.1): every section and item has an
 * `id` a host can deep-link to, `<prefix>-<section>` and `<prefix>-<section>-<item>`.
 */
import { kitIdPart } from './limits.ts';
import type { KitSectionId } from './types.ts';

export interface KitSectionMeta {
  readonly id: KitSectionId;
  readonly label: string;
}

/** Every section, in the kit's order. */
export const KIT_SECTIONS: readonly KitSectionMeta[] = Object.freeze([
  { id: 'foundations', label: 'Foundations' },
  { id: 'voice', label: 'Voice and rules' },
  { id: 'matrix', label: 'Components' },
  { id: 'library', label: 'Library' },
  { id: 'changes', label: 'Changes' },
]);

export const KIT_DEFAULT_PREFIX = 'tx-ds-kit';

/** The prefix as an id fragment (a host prefix is sanitized the same way as item ids). */
export function kitPrefix(prefix: string | undefined): string {
  return prefix === undefined ? KIT_DEFAULT_PREFIX : kitIdPart(prefix);
}

/** The `id` of a section. */
export function kitSectionId(prefix: string, section: KitSectionId): string {
  return `${prefix}-${section}`;
}

/** The `id` of an item inside a section. */
export function kitItemId(prefix: string, section: KitSectionId, item: string): string {
  return `${prefix}-${section}-${kitIdPart(item)}`;
}

/**
 * The sections the kit shows: the requested ones (default: all), in the kit's order, kept to
 * the ones `available` lists (a section without its data, or not built yet, is left out).
 */
export function kitVisibleSections(
  requested: readonly KitSectionId[] | undefined,
  available: readonly KitSectionId[]
): KitSectionMeta[] {
  const order = requested ?? KIT_SECTIONS.map((s) => s.id);
  return order
    .filter((id, i) => order.indexOf(id) === i && available.includes(id))
    .map((id) => KIT_SECTIONS.find((s) => s.id === id))
    .filter((s): s is KitSectionMeta => s !== undefined);
}
