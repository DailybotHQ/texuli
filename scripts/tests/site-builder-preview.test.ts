// @vitest-environment node

import type { PlayerDiagnosticsEvent } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  builderPathOf,
  DEFAULT_PREVIEW_VIEW,
  PREVIEW_WIDTH_PX,
  parseView,
  previewIssues,
  previewSummary,
  stageClass,
  stageInlineSize,
  viewText,
} from '../../apps/website/src/components/builder/preview/model.ts';

const event = (overrides: Partial<PlayerDiagnosticsEvent> = {}): PlayerDiagnosticsEvent => ({
  status: 'draft',
  surface: 'tree',
  diagnostics: [],
  receipt: null,
  stateIssues: [],
  ...overrides,
});

const missingBlock = {
  check: 'render',
  code: 'missing-required',
  severity: 'error',
  path: '0.children.0.children.1',
  message: 'Required prop "block" is missing.',
  id: 'blocks-text',
} as const;

describe('builder preview model', () => {
  it('maps player node paths to builder paths', () => {
    expect(builderPathOf('0')).toEqual([]);
    expect(builderPathOf('0.children.2')).toEqual([2]);
    expect(builderPathOf('0.children.0.children.1')).toEqual([0, 1]);
    expect(builderPathOf('0.children.1.props.block.items.0')).toEqual([1]);
    expect(builderPathOf('$.tree')).toBeNull();
    expect(builderPathOf('')).toBeNull();
  });

  it('lists validation diagnostics with the node they belong to, once each', () => {
    const issues = previewIssues(
      event({ status: 'invalid', diagnostics: [missingBlock, { ...missingBlock }] })
    );
    expect(issues).toEqual([
      {
        key: 'missing-required@0.children.0.children.1',
        severity: 'error',
        code: 'missing-required',
        message: 'Required prop "block" is missing.',
        path: [0, 1],
      },
    ]);
  });

  it('adds state issues and painter errors after the diagnostics', () => {
    const issues = previewIssues(
      event({
        stateIssues: [{ code: 'state-shape', path: 'state', message: 'State must be an object.' }],
      }),
      [
        { code: 'node-error', id: 'charts-line', path: '0.children.3', phase: 'load' },
        { code: 'no-loader', id: 'charts-line', path: '0.children.4' },
      ]
    );
    expect(issues.map((issue) => [issue.code, issue.path])).toEqual([
      ['state-shape', null],
      ['node-error', [3]],
      ['no-loader', [4]],
    ]);
    expect(issues[1]?.message).toBe('This component failed to load or render in the preview.');
  });

  it('summarizes the draft for the polite status line', () => {
    expect(previewSummary(null, 0)).toBe('Preparing the preview…');
    expect(previewSummary(event(), 0)).toBe('No issues: the draft passes validation.');
    expect(previewSummary(event({ status: 'invalid' }), 2)).toBe(
      'The draft has 2 issues; the preview paints the rest with placeholders.'
    );
    expect(previewSummary(event({ status: 'invalid', surface: 'notice' }), 1)).toBe(
      'The draft cannot be previewed: 1 issue.'
    );
    expect(previewSummary(event(), 1)).toBe('1 issue in the draft.');
  });
});

describe('preview breakpoints and color mode (PLAN_005 task 6)', () => {
  it('constrains the stage to a real width per breakpoint, never a scale', () => {
    expect(PREVIEW_WIDTH_PX).toEqual({ mobile: 390, tablet: 768, desktop: null });
    expect(stageInlineSize('mobile')).toBe('390px');
    expect(stageInlineSize('tablet')).toBe('768px');
    expect(stageInlineSize('desktop')).toBe('100%');
  });

  it('names the width and mode in the stage classes', () => {
    expect(stageClass(DEFAULT_PREVIEW_VIEW)).toBe(
      'builder-preview__stage builder-preview__stage--desktop builder-preview__stage--light'
    );
    expect(stageClass({ width: 'mobile', mode: 'dark' })).toContain(
      'builder-preview__stage--mobile'
    );
    expect(stageClass({ width: 'mobile', mode: 'dark' })).toContain('builder-preview__stage--dark');
  });

  it('writes and reads the view exactly, refusing anything else', () => {
    for (const view of [
      { width: 'mobile', mode: 'dark' },
      { width: 'tablet', mode: 'light' },
      DEFAULT_PREVIEW_VIEW,
    ] as const) {
      expect(parseView(viewText(view))).toEqual(view);
    }
    for (const bad of [
      '',
      'dark',
      'dark  mobile',
      'DARK mobile',
      'dark mobile extra',
      'sepia mobile',
      'dark watch',
    ]) {
      expect(parseView(bad), bad).toBeNull();
    }
  });
});
