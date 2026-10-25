/**
 * Build a full library theme from a declarative definition.
 * Palette engine is {@link generateThemeFromSeed}. Full contract validation
 * (`defineTheme`) is not called here so production/`@texuli/tokens/build`
 * stays free of the schema walker — tests call {@link defineTheme} on the
 * result when they need the gate.
 */
import type { Theme, ThemeInput } from '../contract/types.ts';
import { generateThemeFromSeed } from '../generator/seed.ts';
import { getFontPairing } from '../style-presets/fonts.ts';
import type { LibraryThemeDefinition } from './types.ts';

/**
 * Assemble one complete light/dark theme from its definition.
 * Chart tokens stay out of this path (`loadLibraryThemeCharts` derives them).
 * Contrast is enforced by the seed engine; schema validation is test/DEV-only
 * via `defineTheme` at the call site (see library-port tests).
 */
export function buildLibraryTheme(definition: LibraryThemeDefinition): Theme {
  const seeded = generateThemeFromSeed({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    seed: definition.seed,
    ...(definition.secondary ? { secondary: definition.secondary } : {}),
    ...(definition.neutral ? { neutral: definition.neutral } : {}),
    ...(definition.contrastLevel === 'AAA' ? { contrast: 'AAA' as const } : {}),
    ...(definition.radius !== undefined ? { radius: definition.radius } : {}),
    ...(definition.density !== undefined ? { density: definition.density } : {}),
  });

  const pairing = definition.font ? getFontPairing(definition.font) : undefined;
  const assembled: ThemeInput = {
    ...seeded,
    description: definition.description || seeded.description,
    ...(pairing
      ? {
          fontFamily: pairing.fontFamily,
          fontFamilyHeading: pairing.fontFamilyHeading,
          fontFamilyMono: pairing.fontFamilyMono,
        }
      : {}),
    ...(definition.radius !== undefined ? { radius: definition.radius } : {}),
    ...(definition.density !== undefined ? { density: definition.density } : {}),
    ...(definition.style
      ? {
          style: {
            ...seeded.style,
            ...definition.style,
            ...(definition.style.typography
              ? {
                  typography: {
                    ...seeded.style.typography,
                    ...definition.style.typography,
                  },
                }
              : {}),
            ...(definition.style.shape
              ? {
                  shape: {
                    ...seeded.style.shape,
                    ...definition.style.shape,
                  },
                }
              : {}),
            ...(definition.style.motion
              ? {
                  motion: {
                    ...seeded.style.motion,
                    ...definition.style.motion,
                  },
                }
              : {}),
            ...(definition.style.focusRing
              ? {
                  focusRing: {
                    ...seeded.style.focusRing,
                    ...definition.style.focusRing,
                  },
                }
              : {}),
          },
        }
      : {}),
  };
  return assembled as Theme;
}
