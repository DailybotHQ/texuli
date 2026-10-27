// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { SemanticPaletteInput, SemanticRole } from '../src/index.ts';
import {
  defineTheme,
  deriveComponentHooks,
  flattenSemanticPalette,
  getAllReferenceScales,
  getReferenceScale,
  getThemeJsonSchema,
  INTERACTION_STATES,
  isSafeCssColor,
  isSafeCssLength,
  isSafeFontFamily,
  PALETTE_STEPS,
  REFERENCE_SCALE_IDS,
  SEMANTIC_ROLES,
  semanticTokenToCssVar,
  THEME_JSON_SCHEMA,
  TX_PREFIX,
  tokenToCssVar,
  validateTheme,
} from '../src/index.ts';

function fullPalette(seed: string): SemanticPaletteInput {
  const palette = {} as SemanticPaletteInput;
  for (const role of SEMANTIC_ROLES) {
    palette[role] = seed;
  }
  palette.primary = {
    default: '#7c3aed',
    hover: '#6d28d9',
    active: '#5b21b6',
    disabled: '#c4b5fd',
    focus: '#8b5cf6',
  };
  palette.foreground = '#18181b';
  palette.background = '#ffffff';
  return palette;
}

function minimalTheme() {
  return {
    id: 'demo-theme',
    name: 'Demo',
    light: fullPalette('#f4f4f5'),
    dark: fullPalette('#27272a'),
  };
}

describe('reference scales (tier 1)', () => {
  it('exposes full 11-step OKLCH scales for every reference id; is deterministic across calls', () => {
    {
      // exposes full 11-step OKLCH scales for every reference id
      expect(REFERENCE_SCALE_IDS.length).toBeGreaterThanOrEqual(20);
      const all = getAllReferenceScales();
      for (const id of REFERENCE_SCALE_IDS) {
        const scale = getReferenceScale(id);
        expect(scale).toEqual(all[id]);
        for (const step of PALETTE_STEPS) {
          expect(scale[step]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
    // is deterministic across calls
    expect(getReferenceScale('violet')).toEqual(getReferenceScale('violet'));
  });
});

describe('semantic roles (tier 2)', () => {
  it('defines fifty roles and five interaction states; flattens interaction states for CSS maps', () => {
    // defines fifty roles and five interaction states
    expect(SEMANTIC_ROLES).toHaveLength(50);
    expect(INTERACTION_STATES).toEqual(['default', 'hover', 'active', 'disabled', 'focus']);
    {
      // flattens interaction states for CSS maps
      const theme = defineTheme(minimalTheme());
      const flat = flattenSemanticPalette(theme.light);
      expect(flat.primary).toBe('#7c3aed');
      expect(flat['primary.hover']).toBe('#6d28d9');
      expect(flat.background).toMatch(/^#/);
    }
  });
});

describe('prefix and css vars', () => {
  it('maps tokens to the --tx-* namespace', () => {
    expect(TX_PREFIX).toBe('--tx-');
    expect(tokenToCssVar('primaryForeground')).toBe('--tx-primary-foreground');
    expect(semanticTokenToCssVar('primary')).toBe('--tx-primary');
    expect(semanticTokenToCssVar('primary', 'hover')).toBe('--tx-primary-hover');
  });
});

describe('css value safety', () => {
  it('accepts hex, keywords and allowlisted color functions; refuses hostile color and font values', () => {
    // accepts hex, keywords and allowlisted color functions
    expect(isSafeCssColor('#fff')).toBe(true);
    expect(isSafeCssColor('#112233')).toBe(true);
    expect(isSafeCssColor('transparent')).toBe(true);
    expect(isSafeCssColor('oklch(0.6 0.1 250)')).toBe(true);
    expect(isSafeCssColor('color-mix(in oklab, red 50%, blue)')).toBe(true);
    // refuses hostile color and font values
    expect(isSafeCssColor('url(https://evil.example)')).toBe(false);
    expect(isSafeCssColor('red; background: url(x)')).toBe(false);
    expect(isSafeCssColor('rgb(0,0,0){}')).toBe(false);
    expect(isSafeFontFamily('Inter, sans-serif')).toBe(true);
    expect(isSafeFontFamily('ui-sans-serif, system-ui')).toBe(true);
    expect(isSafeFontFamily('"Inter", url(x)')).toBe(false);
    expect(isSafeFontFamily("Arial, 'oops")).toBe(false);
    expect(isSafeCssLength('0.625rem')).toBe(true);
    expect(isSafeCssLength('9999px')).toBe(true);
    expect(isSafeCssLength('1px; color:red')).toBe(false);
  });
});

describe('validateTheme / defineTheme', () => {
  it('accepts a complete theme and fills system defaults, and 4 related cases', async () => {
    // accepts a complete theme and fills system defaults
    await (async () => {
      const result = validateTheme(minimalTheme());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.id).toBe('demo-theme');
      expect(result.value.fontFamily).toContain('system-ui');
      expect(result.value.fontFamilyMono).toContain('ui-monospace');
      expect(result.value.density).toBe(1);
      expect(result.value.style.elevation).toBe('soft');
      expect(Object.keys(result.value.light)).toHaveLength(50);
    })();
    // rejects missing roles, bad ids and unsafe colors
    await (async () => {
      const missing = validateTheme({
        id: 'x',
        name: 'X',
        light: { background: '#fff' },
        dark: { background: '#000' },
      });
      expect(missing.ok).toBe(false);
      if (missing.ok) return;
      expect(missing.issues.some((i) => i.path.startsWith('light.'))).toBe(true);

      const badId = validateTheme({ ...minimalTheme(), id: '1bad' });
      expect(badId.ok).toBe(false);

      const unsafe = validateTheme({
        ...minimalTheme(),
        light: { ...fullPalette('#eee'), primary: 'url(javascript:alert(1))' },
      });
      expect(unsafe.ok).toBe(false);
    })();
    {
      // rejects interaction states on static roles
      const light = fullPalette('#ddd');
      light.background = { default: '#fff', hover: '#eee' };
      const result = validateTheme({ ...minimalTheme(), light });
      expect(result.ok).toBe(false);
    }
    // defineTheme throws a readable error
    expect(() => defineTheme({ id: 'x', name: 'X' })).toThrow(/Invalid theme/);
    {
      // accepts component hooks and charts
      const charts = {
        categorical: Array.from({ length: 8 }, (_, i) => `#${String(i).repeat(6).slice(0, 6)}`),
        sequential: Array.from({ length: 9 }, () => '#112233'),
        diverging: Array.from({ length: 9 }, () => '#445566'),
        grid: 'oklch(0.8 0 0)',
        axis: '#888888',
      };
      // fix categorical to real hex
      charts.categorical = [
        '#111111',
        '#222222',
        '#333333',
        '#444444',
        '#555555',
        '#666666',
        '#777777',
        '#888888',
      ];

      const theme = defineTheme({
        ...minimalTheme(),
        components: { button: 'pill', card: 'glass', focusRing: 'glow' },
        charts: { light: charts, dark: charts },
      });
      expect(theme.components?.button).toBe('pill');
      expect(theme.charts?.light.categorical).toHaveLength(8);
    }
  });
});

describe('component hooks (tier 3)', () => {
  it('derives hooks from radius and surface', () => {
    expect(deriveComponentHooks({ radius: '0px' }).button).toBe('square');
    expect(deriveComponentHooks({ radius: '9999px' }).button).toBe('pill');
    expect(deriveComponentHooks({ surface: 'glass' }).card).toBe('glass');
    expect(deriveComponentHooks({ elevation: 'flat' }).card).toBe('bordered');
    expect(deriveComponentHooks({ focusRingStyle: 'glow' }).focusRing).toBe('glow');
    expect(deriveComponentHooks({ components: { button: 'default' } }).button).toBe('default');
  });
});

describe('JSON Schema', () => {
  it('covers every semantic role and matches the exported constant', () => {
    const schema = getThemeJsonSchema();
    expect(schema).toBe(THEME_JSON_SCHEMA);
    expect(schema.required).toEqual(expect.arrayContaining(['id', 'name', 'light', 'dark']));
    const lightRequired = schema.properties.light.required as readonly string[];
    expect(lightRequired).toEqual([...SEMANTIC_ROLES]);
    expect(schema.definitions.semanticRoles.enum).toEqual([...SEMANTIC_ROLES]);
    expect(schema.definitions.referenceScaleIds.enum).toEqual([...REFERENCE_SCALE_IDS]);
    expect(JSON.stringify(schema)).not.toContain('--py-');
    expect(JSON.stringify(schema)).not.toContain('zod');
  });
});

describe('role completeness helper', () => {
  it('lists each SemanticRole exactly once', () => {
    const set = new Set<SemanticRole>(SEMANTIC_ROLES);
    expect(set.size).toBe(SEMANTIC_ROLES.length);
  });
});
