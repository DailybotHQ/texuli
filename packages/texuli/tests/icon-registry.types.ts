/**
 * Compile-time contract (D-G-021): an app augments `IconNames` so `Icon`'s
 * `icon` prop accepts its registered names, and `registerIcons` takes
 * components or path data. Included by the texuli tsconfig.
 */
import type { ComponentProps } from 'svelte';
import type Icon from '../src/components/icons/Icon.svelte';
import { type IconName, type IconRegistry, registerIcons } from '../src/components/icons/index.ts';
import CustomIcon from './fixtures/CustomIcon.svelte';

declare module '../src/components/icons/index.ts' {
  interface IconNames {
    rocket: true;
    spark: true;
  }
}

type IconProp = NonNullable<ComponentProps<typeof Icon>['icon']>;

// Must compile: built-in and augmented names are both icon names.
export const builtIn: IconProp = 'search';
export const registeredName: IconName = 'rocket';
export const registeredProp: IconProp = 'spark';

// @ts-expect-error a name nobody declared is still refused
export const undeclared: IconProp = 'not-registered';

// Must compile: components and 24x24 path data are glyphs.
export const registry: IconRegistry = { rocket: CustomIcon, spark: 'M12 3v18M3 12h18' };
export const register: (icons: IconRegistry) => void = registerIcons;

// @ts-expect-error raw markup objects are not glyphs
export const notAGlyph: IconRegistry = { rocket: { svg: '<svg></svg>' } };
