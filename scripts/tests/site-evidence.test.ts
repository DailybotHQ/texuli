// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  behaviorCheckCount,
  guessBehaviorScenario,
  hasBehaviorScenario,
  resetBehaviorScenarioCache,
} from '../../apps/website/src/components/evidence/behavior-map.ts';
import { resolveGzipBudget } from '../../apps/website/src/components/evidence/budgets.ts';
import {
  evidenceForComponent,
  formatBytes,
  sizeEntryForComponent,
} from '../../apps/website/src/components/evidence/load-evidence.ts';

describe('site evidence loaders', () => {
  it('maps components to size entries and budgets', () => {
    expect(sizeEntryForComponent('button', 'texuli')).toBe('texuli/button');
    expect(sizeEntryForComponent('dialog', '@texuli/primitives')).toBe('@texuli/primitives/dialog');
    expect(sizeEntryForComponent('select-trigger', 'texuli')).toBe('texuli/select-trigger');
    const budget = resolveGzipBudget('@texuli/primitives/dialog');
    expect(budget).toBeTypeOf('number');
    expect(budget!).toBeGreaterThan(1000);
    expect(formatBytes(11589)).toMatch(/KiB/);
  });

  it('resolves behavior scenarios and counts their checks', () => {
    resetBehaviorScenarioCache();
    expect(guessBehaviorScenario('dialog')).toBe('dialog');
    expect(guessBehaviorScenario('dropdown-menu-trigger')).toBe('dropdown-menu');
    expect(guessBehaviorScenario('layout-sidebar')).toBeUndefined();
    expect(hasBehaviorScenario('dialog')).toBe(true);
    expect(behaviorCheckCount('dialog')).toBeGreaterThan(5);
    expect(behaviorCheckCount('no-such-scenario')).toBe(0);
  });

  it('builds evidence cards for button and dialog', () => {
    const button = evidenceForComponent('button', 'texuli');
    expect(button.id).toBe('button');
    expect(button.size.entry).toBe('texuli/button');
    expect(button.browsers.projects).toEqual(['chromium', 'webkit', 'mobile']);
    expect(button.axe.suites.length).toBeGreaterThan(0);
    expect(button.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const dialog = evidenceForComponent('dialog', '@texuli/primitives');
    expect(dialog.behavior.scenario).toBe('dialog');
    expect(dialog.behavior.status).toBe('checked');
    expect(dialog.behavior.checks).toBeGreaterThan(5);
    expect(button.behavior.status).toBe('n/a');
    expect(dialog.size.gzipMeasured).toBe(11589);
    expect(dialog.size.gzipBudget).toBeTypeOf('number');
  });
});
