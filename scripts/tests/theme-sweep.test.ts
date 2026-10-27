import { describe, expect, it } from 'vitest';
import {
  buildThemeSweepReport,
  CONTRAST_FLOORS,
  evaluateThemeEvidence,
  formatThemeSweepMarkdown,
  loadThemeSample,
  selectExamples,
  selectThemeSample,
  THEME_SAMPLE_CONFIG,
  type ThemeMetadata,
  type ThemeSweepEvidence,
} from '../theme-sweep.ts';

const themeFixture: ThemeMetadata[] = THEME_SAMPLE_CONFIG.map((sample, index) => ({
  id: sample.id,
  seed: `#${String(index + 1).padStart(6, '0')}`,
  collection: sample.id === 'graphite' ? 'mono' : 'industry',
  contrastLevel: sample.contrast,
  darkFirst: sample.tone === 'dark-first',
}));

const passingEvidence: ThemeSweepEvidence = {
  modesRendered: ['light', 'dark'],
  contrastRatios: {
    normalText: [CONTRAST_FLOORS.normalText],
    largeText: [CONTRAST_FLOORS.largeText],
    nonText: [CONTRAST_FLOORS.nonText],
  },
  forcedColorsRendered: true,
  unresolvedVariables: [],
  evidencePointers: ['tests/visual/component-light.png', 'tests/visual/component-dark.png'],
};

describe('theme sweep policy and reporting', () => {
  it('selects the fixed gamut sample in config order and validates it against the manifest', () => {
    const sample = selectThemeSample([...themeFixture].reverse());
    expect(sample.map((theme) => theme.id)).toEqual(THEME_SAMPLE_CONFIG.map(({ id }) => id));
    expect(sample).toHaveLength(14);
    expect(sample.some((theme) => theme.contrastLevel === 'AAA')).toBe(true);
    expect(sample.some((theme) => theme.darkFirst)).toBe(true);
    expect(() => selectThemeSample(themeFixture.slice(1))).toThrow(
      /missing from the tokens manifest/
    );
    expect(() =>
      selectThemeSample(themeFixture.map((theme) => ({ ...theme, id: 'duplicate' })))
    ).toThrow(/Duplicate theme metadata id/);
  });

  it('offers the full token catalog in stable ID order', () => {
    const selected = selectThemeSample(
      [
        ...themeFixture,
        {
          id: 'zeta-theme',
          seed: '#abcdef',
          collection: 'industry',
          contrastLevel: 'AA',
          darkFirst: false,
        },
        {
          id: 'alpha-theme',
          seed: '#fedcba',
          collection: 'mono',
          contrastLevel: 'AAA',
          darkFirst: true,
        },
      ],
      true
    );
    expect(selected.map((theme) => theme.id)).toEqual(
      [...selected.map((theme) => theme.id)].sort()
    );
    expect(selected.every((theme) => theme.sample === null)).toBe(true);
  });

  it('keeps the configured sample aligned with the current workspace theme manifest', async () => {
    const selected = await loadThemeSample();
    expect(selected.map((theme) => theme.id)).toEqual(THEME_SAMPLE_CONFIG.map(({ id }) => id));
  });

  it('sorts examples and rejects duplicate or unsafe example IDs', () => {
    expect(selectExamples([{ id: 'zeta', title: '  Second   example ' }, { id: 'alpha' }])).toEqual(
      [
        { id: 'alpha', title: 'alpha' },
        { id: 'zeta', title: 'Second example' },
      ]
    );
    expect(() => selectExamples([{ id: 'same' }, { id: 'same' }])).toThrow(/Duplicate example id/);
    expect(() => selectExamples([{ id: '../unsafe' }])).toThrow(/Invalid example id/);
  });

  it('evaluates contrast, light/dark coverage, forced colors and unresolved tokens', () => {
    expect(evaluateThemeEvidence(passingEvidence).status).toBe('pass');
    expect(
      evaluateThemeEvidence({
        ...passingEvidence,
        contrastRatios: { ...passingEvidence.contrastRatios, normalText: [4.49] },
      })
    ).toMatchObject({
      status: 'fail',
      issues: ['normalText contrast measurement 1 is below 4.5:1.'],
    });
    expect(
      evaluateThemeEvidence({
        ...passingEvidence,
        modesRendered: ['light'],
        forcedColorsRendered: false,
        unresolvedVariables: ['--tx-card-border'],
      })
    ).toMatchObject({
      status: 'fail',
      issues: [
        'Both light and dark modes must be rendered.',
        'Forced-colors rendering did not pass.',
        'Unresolved CSS variable: --tx-card-border.',
      ],
    });
    expect(
      evaluateThemeEvidence({
        ...passingEvidence,
        contrastRatios: { ...passingEvidence.contrastRatios, largeText: [] },
      })
    ).toMatchObject({
      status: 'incomplete',
      issues: ['No largeText contrast measurements were captured.'],
    });
  });

  it('writes a deterministic example × theme matrix with pending cells and evidence pointers', () => {
    const report = buildThemeSweepReport([{ id: 'zeta' }, { id: 'alpha' }], themeFixture, {
      [`alpha:${THEME_SAMPLE_CONFIG[0]!.id}`]: passingEvidence,
    });
    expect(report.exampleIds).toEqual(['alpha', 'zeta']);
    expect(report.cells[0]).toMatchObject({ status: 'pass', exampleId: 'alpha' });
    expect(report.cells[1]).toMatchObject({ status: 'pending', exampleId: 'alpha' });
    const markdown = formatThemeSweepMarkdown(report);
    expect(markdown).toContain('| Example | accessible-high-contrast |');
    expect(markdown).toContain('| alpha | PASS | PENDING |');
    expect(markdown).toContain('tests/visual/component-light.png');
    expect(formatThemeSweepMarkdown(report)).toBe(markdown);
    expect(JSON.stringify(report)).toBe(
      JSON.stringify(
        buildThemeSweepReport([{ id: 'alpha' }, { id: 'zeta' }], [...themeFixture].reverse(), {
          [`alpha:${THEME_SAMPLE_CONFIG[0]!.id}`]: passingEvidence,
        })
      )
    );
  });
});
