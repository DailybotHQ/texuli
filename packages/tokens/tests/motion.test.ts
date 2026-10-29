// @vitest-environment node
import { readFileSync } from 'node:fs';
import { springEasing, springSettle } from '@texuli/core/motion/spring';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME_STYLE,
  defineTheme,
  SEMANTIC_ROLES,
  type SemanticPaletteInput,
  type ThemeInput,
} from '../src/contract/index.ts';
import { themeVariables } from '../src/css/index.ts';
import * as root from '../src/index.ts';
import {
  MOTION_DURATION_STEPS,
  MOTION_DURATIONS,
  MOTION_EASING_NAMES,
  MOTION_EASINGS,
  MOTION_SPRING_NAMES,
  MOTION_SPRING_SAMPLES,
  MOTION_SPRINGS,
  MOTION_VARIABLE_NAMES,
  motionDurationVar,
  motionEasingVar,
  motionSpringVars,
  motionVariables,
  slowerDuration,
} from '../src/motion/index.ts';

const baseCss = readFileSync('packages/tokens/src/css/base.css', 'utf8');

function palette(background: string, foreground: string): SemanticPaletteInput {
  const value = {} as SemanticPaletteInput;
  for (const role of SEMANTIC_ROLES) value[role] = background;
  value.foreground = foreground;
  return value;
}

function theme(style?: ThemeInput['style']) {
  return defineTheme({
    id: 'motion-demo',
    name: 'Motion demo',
    light: palette('#ffffff', '#111827'),
    dark: palette('#111827', '#f9fafb'),
    style,
  });
}

describe('motion tokens', () => {
  it('names five durations, five easings and three springs, and keeps the theme defaults', () => {
    expect(MOTION_DURATION_STEPS).toEqual(['instant', 'fast', 'base', 'slow', 'slower']);
    expect(MOTION_EASING_NAMES).toHaveLength(5);
    expect(MOTION_SPRING_NAMES).toEqual(['gentle', 'snappy', 'bouncy']);
    const { fast, base, slow } = DEFAULT_THEME_STYLE.motion.durations;
    expect({ fast, base, slow }).toEqual({
      fast: MOTION_DURATIONS.fast,
      base: MOTION_DURATIONS.base,
      slow: MOTION_DURATIONS.slow,
    });
    expect(MOTION_EASINGS.standard).toBe(DEFAULT_THEME_STYLE.motion.easing);
    expect(slowerDuration(MOTION_DURATIONS.slow)).toBe(MOTION_DURATIONS.slower);
    for (const [slow, slower] of [
      [0, 0],
      [Number.NaN, 0],
      [-5, 0],
      [200, 333],
      [900, 1000],
      [2000, 2000],
    ] as const) {
      expect(slowerDuration(slow), String(slow)).toBe(slower);
    }
    expect('motionVariables' in root).toBe(true);
  });

  it('precomputes every spring curve with the core solver', () => {
    for (const name of MOTION_SPRING_NAMES) {
      const token = MOTION_SPRINGS[name];
      const solved = springEasing(token, { samples: MOTION_SPRING_SAMPLES });
      expect(token.easing, name).toBe(solved.easing);
      expect(token.durationMs, name).toBe(solved.durationMs);
      expect(springSettle(token).settled, name).toBe(true);
      expect(token.durationMs, name).toBeLessThan(1000);
    }
  });

  it('emits --tx-motion-* variables, all zero and linear under reduced motion', () => {
    const vars = motionVariables();
    expect(vars['--tx-motion-instant']).toBe('0ms');
    expect(vars['--tx-motion-slower']).toBe('500ms');
    expect(vars['--tx-motion-ease-emphasized']).toBe(MOTION_EASINGS.emphasized);
    expect(vars['--tx-motion-spring-snappy']).toBe(MOTION_SPRINGS.snappy.easing);
    expect(vars['--tx-motion-spring-snappy-duration']).toBe(
      `${MOTION_SPRINGS.snappy.durationMs}ms`
    );
    expect(Object.keys(vars)).toEqual(MOTION_VARIABLE_NAMES);
    expect(MOTION_VARIABLE_NAMES).toHaveLength(5 + 5 + 3 * 2);

    const themed = motionVariables({ durations: { fast: 100, slow: 600, base: Number.NaN } });
    expect(themed['--tx-motion-fast']).toBe('100ms');
    expect(themed['--tx-motion-base']).toBe('200ms');
    expect(themed['--tx-motion-slower']).toBe('1000ms');

    const reduced = motionVariables({ reducedMotion: true });
    for (const [name, value] of Object.entries(reduced)) {
      expect(value, name).toMatch(/^(0ms|linear)$/);
    }
    expect(motionDurationVar('slower')).toBe('--tx-motion-slower');
    expect(motionEasingVar('exit')).toBe('--tx-motion-ease-exit');
    expect(motionSpringVars('gentle')).toEqual({
      easing: '--tx-motion-spring-gentle',
      duration: '--tx-motion-spring-gentle-duration',
    });
  });

  it('adds slower to the theme variables, following the theme', () => {
    const vars = themeVariables({ theme: theme(), mode: 'light' });
    // `instant` is constant: base.css declares it once on :root.
    expect(vars['--tx-motion-instant']).toBeUndefined();
    expect(vars['--tx-motion-slower']).toBe('500ms');
    const custom = themeVariables({
      theme: theme({ motion: { durations: { fast: 150, base: 200, slow: 200 } } }),
      mode: 'dark',
    });
    expect(custom['--tx-motion-slower']).toBe('333ms');
    expect(
      themeVariables({ theme: theme(), mode: 'light', reducedMotion: true })['--tx-motion-slower']
    ).toBe('0ms');
  });

  it('ships the theme-independent tokens in base.css and zeroes them in both reduced-motion rules', () => {
    const vars = motionVariables();
    // The formatter wraps long values; compare with whitespace collapsed.
    const rootBlock = (/:root \{([\s\S]*?)\n {2}\}/.exec(baseCss)?.[1] ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\( /g, '(')
      .replace(/ \)/g, ')');
    for (const name of MOTION_VARIABLE_NAMES) {
      if (['--tx-motion-fast', '--tx-motion-base', '--tx-motion-slow'].includes(name)) continue;
      expect(rootBlock, name).toContain(`${name}: ${vars[name]};`);
    }
    const reducedRules = [
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n {2}\}/.exec(baseCss)?.[1] ?? '',
      /\[data-tx-motion="reduce"\],[\s\S]*?\{([\s\S]*?)\n {2}\}/.exec(baseCss)?.[1] ?? '',
    ];
    for (const rule of reducedRules) {
      expect(rule.length).toBeGreaterThan(0);
      for (const name of MOTION_VARIABLE_NAMES) {
        if (name === '--tx-motion-instant' || name === '--tx-motion-ease-linear') continue;
        expect(rule, name).toMatch(new RegExp(`${name}: (0ms|linear) !important;`));
      }
    }
  });

  it('is documented', () => {
    const doc = readFileSync('packages/tokens/docs/tokens-motion.md', 'utf8');
    const names = Object.keys(root).filter((name) =>
      /^(MOTION_(?!PRESETS)|motion|slowerDuration)/.test(name)
    );
    expect(names.length).toBeGreaterThan(10);
    expect(names.filter((name) => !doc.includes(`\`${name}`))).toEqual([]);
    for (const name of MOTION_VARIABLE_NAMES) expect(doc, name).toContain(name);
  });
});
