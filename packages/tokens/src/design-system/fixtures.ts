/**
 * `@texuli/tokens/design-system/fixtures` (T-ds-io): fictional fixtures
 * for importer and adapter tests, so Texuli and its adopters prove
 * losslessness against the same files. All data is fictional.
 *
 * - `protoyardThemeV1Fixture()`: a flat role palette shaped like
 *   Protoyard's `protoyard-theme/v1` export (33 roles per mode, the three
 *   font stacks, radius, density, the style knobs and per-mode charts).
 *   `emitRolePalette(importRolePalette(f).document, { format: f.format })`
 *   equals it.
 * - `dtcgFixture()`: a W3C DTCG file in Texuli's layout;
 *   `emitDtcg(importDtcg(f).document)` equals it.
 * - `tokensStudioFixture()`: a Tokens Studio file (sets `global`, `light`,
 *   `dark`); `emitTokensStudio(importTokensStudio(f).document)` equals it.
 *
 * Each call returns a fresh copy. A lazy entry: the `@texuli/tokens` root
 * never imports it.
 */

import type { RolePalette } from './import.ts';

/** The format tag of the fictional Protoyard fixture. */
export const PROTOYARD_THEME_V1_FORMAT = 'protoyard-theme/v1';

const PROTOYARD_THEME_V1 = {
  format: 'protoyard-theme/v1',
  id: 'harbor',
  name: 'Harbor (fictional)',
  description:
    'A fictional protoyard-theme/v1-shaped theme: 33 roles per mode and every Protoyard knob.',
  light: {
    background: '#fafcff',
    foreground: '#0a1628',
    surface: '#f7ffff',
    surfaceForeground: '#0a1628',
    elevated: '#f7ffff',
    elevatedForeground: '#0a1628',
    muted: '#ecf4ff',
    mutedForeground: '#55647a',
    border: '#d9e2ef',
    borderStrong: '#8b939f',
    input: '#7f8792',
    ring: '#0f766e',
    primary: '#0f766e',
    primaryForeground: '#ffffff',
    primarySoft: '#d6fff9',
    primarySoftForeground: '#00302d',
    secondary: '#ffe1d1',
    secondaryForeground: '#291409',
    accent: '#c1fcf5',
    accentForeground: '#00201d',
    destructive: '#cc2827',
    destructiveForeground: '#ffffff',
    success: '#007f38',
    successForeground: '#ffffff',
    warning: '#916600',
    warningForeground: '#ffffff',
    info: '#0871c1',
    infoForeground: '#ffffff',
    sidebar: '#f2f7ff',
    sidebarForeground: '#172537',
    sidebarBorder: '#d9e2ef',
    sidebarPrimary: '#0f766e',
    link: '#07736b',
  },
  dark: {
    background: '#060b14',
    foreground: '#eff6ff',
    surface: '#10161f',
    surfaceForeground: '#eff6ff',
    elevated: '#1c222b',
    elevatedForeground: '#eff6ff',
    muted: '#1c222b',
    mutedForeground: '#95a6be',
    border: '#2c333d',
    borderStrong: '#79818c',
    input: '#6a727d',
    ring: '#0f766e',
    primary: '#3e978e',
    primaryForeground: '#0a0a0a',
    primarySoft: '#00201d',
    primarySoftForeground: '#93eae0',
    secondary: '#3e281c',
    secondaryForeground: '#ffeadf',
    accent: '#002e2a',
    accentForeground: '#d2f8f3',
    destructive: '#ff645a',
    destructiveForeground: '#0a0a0a',
    success: '#43b966',
    successForeground: '#0a0a0a',
    warning: '#cd9200',
    warningForeground: '#0a0a0a',
    info: '#4ba3f7',
    infoForeground: '#0a0a0a',
    sidebar: '#0c121a',
    sidebarForeground: '#dae9ff',
    sidebarBorder: '#272e38',
    sidebarPrimary: '#3e978e',
    link: '#68c0b6',
  },
  fontFamily: '"Yard Sans", system-ui, sans-serif',
  fontFamilyHeading: '"Yard Display", "Yard Sans", sans-serif',
  fontFamilyMono: '"Yard Mono", ui-monospace, monospace',
  radius: '0.375rem',
  density: 0.875,
  style: {
    surface: 'glass',
    focusRing: 'glow',
    elevation: 'layered',
    motion: 'expressive',
  },
  charts: {
    light: {
      categorical: [
        '#0f766e',
        '#1d4ed8',
        '#b45309',
        '#7e22ce',
        '#be123c',
        '#15803d',
        '#0369a1',
        '#4d7c0f',
      ],
      sequential: [
        '#f0fdfa',
        '#ccfbf1',
        '#99f6e4',
        '#5eead4',
        '#2dd4bf',
        '#14b8a6',
        '#0d9488',
        '#0f766e',
        '#115e59',
      ],
      diverging: [
        '#b91c1c',
        '#dc2626',
        '#f87171',
        '#fecaca',
        '#f5f5f5',
        '#99f6e4',
        '#2dd4bf',
        '#0d9488',
        '#115e59',
      ],
      grid: '#e2e8f0',
      axis: '#475569',
    },
    dark: {
      categorical: [
        '#5eead4',
        '#93c5fd',
        '#fcd34d',
        '#d8b4fe',
        '#fda4af',
        '#86efac',
        '#7dd3fc',
        '#bef264',
      ],
      sequential: [
        '#115e59',
        '#0f766e',
        '#0d9488',
        '#14b8a6',
        '#2dd4bf',
        '#5eead4',
        '#99f6e4',
        '#ccfbf1',
        '#f0fdfa',
      ],
      diverging: [
        '#fca5a5',
        '#f87171',
        '#ef4444',
        '#7f1d1d',
        '#262626',
        '#134e4a',
        '#14b8a6',
        '#2dd4bf',
        '#5eead4',
      ],
      grid: '#1e293b',
      axis: '#94a3b8',
    },
  },
} as const;

const DTCG = {
  $extensions: {
    'com.texuli.design-system': {
      accessibility: {
        contrast: 'AA',
        focus: 'ring',
      },
      color: {
        brand: {
          neutral: 'cool',
        },
      },
      components: {
        button: {
          defaults: {
            size: 'md',
            variant: 'default',
          },
          radius: 'full',
        },
      },
      description: 'A fictional brand for the DTCG fixture.',
      elevation: {
        style: 'crisp',
      },
      format: 'texuli/design-system',
      formatVersion: 1,
      icons: {
        style: 'outline',
      },
      id: 'northwind-lab',
      layout: {
        grid: {
          gutter: {
            base: 'space-4',
            md: 'space-6',
          },
        },
      },
      motion: {
        personality: 'subtle',
      },
      name: 'Northwind Lab (fictional)',
      tags: ['example'],
      typography: {
        roles: {
          heading: {
            family: 'sans',
          },
        },
      },
      version: '1.2.0',
    },
  },
  accessibility: {
    focusOffset: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 2,
      },
    },
    focusWidth: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 2,
      },
    },
    targetMin: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 24,
      },
    },
  },
  color: {
    brand: {
      secondary: {
        $type: 'color',
        $value: '#db2777',
      },
      seed: {
        $type: 'color',
        $value: '#2563eb',
      },
    },
    pin: {
      primary: {
        $type: 'color',
        $value: '#2563eb',
      },
    },
    roles: {
      dark: {
        background: {
          $type: 'color',
          $value: '#0b1120',
        },
        foreground: {
          $type: 'color',
          $value: '#e2e8f0',
        },
      },
      light: {
        background: {
          $type: 'color',
          $value: '#ffffff',
        },
        foreground: {
          $type: 'color',
          $value: '#0f172a',
        },
      },
    },
    status: {
      danger: {
        $type: 'color',
        $value: '#b91c1c',
      },
      success: {
        $type: 'color',
        $value: '#15803d',
      },
    },
  },
  icons: {
    size: {
      lg: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 24,
        },
      },
      md: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 20,
        },
      },
      sm: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 16,
        },
      },
    },
    stroke: {
      $type: 'number',
      $value: 1.5,
    },
  },
  layout: {
    breakpoints: {
      lg: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 1440,
        },
      },
      md: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 1024,
        },
      },
      sm: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 640,
        },
      },
    },
    contentMax: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 1200,
      },
    },
    grid: {
      columns: {
        base: {
          $type: 'number',
          $value: 4,
        },
        md: {
          $type: 'number',
          $value: 12,
        },
      },
    },
  },
  motion: {
    durations: {
      base: {
        $type: 'duration',
        $value: {
          unit: 'ms',
          value: 180,
        },
      },
      fast: {
        $type: 'duration',
        $value: {
          unit: 'ms',
          value: 100,
        },
      },
      slow: {
        $type: 'duration',
        $value: {
          unit: 'ms',
          value: 300,
        },
      },
    },
  },
  shape: {
    borderWidth: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 1,
      },
    },
    radius: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 10,
      },
    },
    radiusScale: {
      $type: 'number',
      $value: 1,
    },
  },
  space: {
    base: {
      $type: 'dimension',
      $value: {
        unit: 'px',
        value: 4,
      },
    },
    density: {
      $type: 'number',
      $value: 1,
    },
  },
  typography: {
    families: {
      mono: {
        stack: {
          $type: 'fontFamily',
          $value: ['Lab Mono', 'monospace'],
        },
      },
      sans: {
        stack: {
          $type: 'fontFamily',
          $value: ['Lab Sans', 'system-ui', 'sans-serif'],
        },
      },
    },
    roles: {
      body: {
        line: {
          $type: 'number',
          $value: 1.5,
        },
        size: {
          $type: 'dimension',
          $value: {
            unit: 'px',
            value: 16,
          },
        },
        weight: {
          $type: 'fontWeight',
          $value: 400,
        },
      },
      heading: {
        line: {
          $type: 'number',
          $value: 1.25,
        },
        size: {
          $type: 'dimension',
          $value: {
            unit: 'px',
            value: 24,
          },
        },
        tracking: {
          $type: 'number',
          $value: -0.01,
        },
        weight: {
          $type: 'fontWeight',
          $value: 650,
        },
      },
    },
    scale: {
      base: {
        $type: 'dimension',
        $value: {
          unit: 'px',
          value: 16,
        },
      },
      ratio: {
        $type: 'number',
        $value: 1.25,
      },
    },
  },
} as const;

const TOKENS_STUDIO = {
  dark: {
    color: {
      roles: {
        dark: {
          primary: {
            type: 'color',
            value: '#c4b5fd',
          },
          primaryForeground: {
            type: 'color',
            value: '#1e1b4b',
          },
        },
      },
    },
  },
  global: {
    color: {
      brand: {
        accent: {
          type: 'color',
          value: '#f59e0b',
        },
        seed: {
          type: 'color',
          value: '#7c3aed',
        },
      },
    },
    shape: {
      radius: {
        type: 'dimension',
        value: '4px',
      },
    },
    space: {
      density: {
        type: 'number',
        value: 0.9,
      },
    },
    surface: {
      glass: {
        alpha: {
          type: 'number',
          value: 0.8,
        },
        blur: {
          type: 'dimension',
          value: '20px',
        },
      },
    },
    typography: {
      families: {
        heading: {
          stack: {
            type: 'fontFamilies',
            value: '"Lumen Display", serif',
          },
        },
        sans: {
          stack: {
            type: 'fontFamilies',
            value: '"Lumen Sans", sans-serif',
          },
        },
      },
      roles: {
        display: {
          line: {
            type: 'number',
            value: 1.05,
          },
          size: {
            type: 'dimension',
            value: '56px',
          },
          weight: {
            type: 'fontWeights',
            value: 800,
          },
        },
      },
    },
  },
  light: {
    color: {
      dataViz: {
        light: {
          axis: {
            type: 'color',
            value: '#475569',
          },
          categorical: {
            '1': {
              type: 'color',
              value: '#6d28d9',
            },
            '2': {
              type: 'color',
              value: '#0891b2',
            },
            '3': {
              type: 'color',
              value: '#ca8a04',
            },
            '4': {
              type: 'color',
              value: '#16a34a',
            },
            '5': {
              type: 'color',
              value: '#dc2626',
            },
            '6': {
              type: 'color',
              value: '#db2777',
            },
            '7': {
              type: 'color',
              value: '#4f46e5',
            },
            '8': {
              type: 'color',
              value: '#64748b',
            },
          },
          grid: {
            type: 'color',
            value: '#e2e8f0',
          },
        },
      },
      roles: {
        light: {
          primary: {
            type: 'color',
            value: '#6d28d9',
          },
          primaryForeground: {
            type: 'color',
            value: '#ffffff',
          },
        },
      },
    },
  },
  $themes: [],
  $metadata: {
    tokenSetOrder: ['global', 'light', 'dark'],
  },
  $extensions: {
    'com.texuli.design-system': {
      format: 'texuli/design-system',
      formatVersion: 1,
      id: 'lumen-studio',
      motion: {
        personality: 'expressive',
      },
      name: 'Lumen Studio (fictional)',
      surface: {
        style: 'glass',
      },
      version: '0.3.0',
      voice: {
        tone: ['bright'],
      },
    },
  },
} as const;

/** A fresh copy of the fictional `protoyard-theme/v1`-shaped palette. */
export function protoyardThemeV1Fixture(): RolePalette & { format: string } {
  return structuredClone(PROTOYARD_THEME_V1) as unknown as RolePalette & { format: string };
}

/** A fresh copy of the fictional DTCG file. */
export function dtcgFixture(): Record<string, unknown> {
  return structuredClone(DTCG) as unknown as Record<string, unknown>;
}

/** A fresh copy of the fictional Tokens Studio file. */
export function tokensStudioFixture(): Record<string, unknown> {
  return structuredClone(TOKENS_STUDIO) as unknown as Record<string, unknown>;
}
