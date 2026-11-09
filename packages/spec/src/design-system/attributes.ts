import { SPEC_COMPONENT_IDS, type SpecComponentId } from '../../generated/typescript/vocabulary.ts';

/** Root attribute names shared by styled components, wrappers, and design-system tooling. */
export const DS_COMPONENT_ATTRIBUTE = 'data-tx-component';
export const DS_VARIANT_ATTRIBUTE = 'data-tx-variant';
export const DS_SIZE_ATTRIBUTE = 'data-tx-size';
export const DS_TONE_ATTRIBUTE = 'data-tx-tone';
export const DS_DENSITY_ATTRIBUTE = 'data-tx-density';

const catalogIds = new Set<string>(SPEC_COMPONENT_IDS);

export interface DesignSystemRootAxes {
  readonly variant?: string;
  readonly size?: string;
  readonly tone?: string;
  readonly density?: string;
}

export interface DesignSystemRootAttributes {
  readonly [DS_COMPONENT_ATTRIBUTE]: SpecComponentId;
  readonly [DS_VARIANT_ATTRIBUTE]?: string;
  readonly [DS_SIZE_ATTRIBUTE]?: string;
  readonly [DS_TONE_ATTRIBUTE]?: string;
  readonly [DS_DENSITY_ATTRIBUTE]?: string;
}

/**
 * Build the data attributes for a catalog component root. Axis values are included only
 * when provided; they are descriptive metadata and are not normalized or filtered here.
 *
 * @throws Error when `id` is not one of the generated catalog component ids.
 */
export function dsRootAttributes(
  id: string,
  axes?: DesignSystemRootAxes
): DesignSystemRootAttributes {
  if (typeof id !== 'string' || !catalogIds.has(id)) {
    throw new Error('Unknown Texuli catalog component id');
  }

  return {
    [DS_COMPONENT_ATTRIBUTE]: id as SpecComponentId,
    ...(axes?.variant === undefined ? {} : { [DS_VARIANT_ATTRIBUTE]: axes.variant }),
    ...(axes?.size === undefined ? {} : { [DS_SIZE_ATTRIBUTE]: axes.size }),
    ...(axes?.tone === undefined ? {} : { [DS_TONE_ATTRIBUTE]: axes.tone }),
    ...(axes?.density === undefined ? {} : { [DS_DENSITY_ATTRIBUTE]: axes.density }),
  };
}
