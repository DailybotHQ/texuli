/**
 * Map catalog component ids to behavior scenarios (tests/behavior/scenarios),
 * and count each scenario's checks from its spec.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let scenarioSet: Set<string> | null = null;

function loadScenarios(): Set<string> {
  if (scenarioSet) return scenarioSet;
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../');
  const dir = join(repoRoot, 'tests/behavior/scenarios');
  try {
    scenarioSet = new Set(
      readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    );
  } catch {
    scenarioSet = new Set();
  }
  return scenarioSet;
}

/** Normalize a catalog id toward a behavior scenario name. */
export function guessBehaviorScenario(componentId: string): string | undefined {
  const scenarios = loadScenarios();
  if (scenarios.has(componentId)) return componentId;

  // Common aliases: dropdown-menu-trigger -> dropdown-menu
  const aliases: Record<string, string> = {
    'alert-dialog': 'alert-dialog',
    'dropdown-menu': 'dropdown-menu',
    'dropdown-menu-trigger': 'dropdown-menu',
    'dropdown-menu-content': 'dropdown-menu',
    'dropdown-menu-item': 'dropdown-menu',
    'context-menu': 'context-menu',
    'context-menu-trigger': 'context-menu',
    'hover-card': 'hover-card',
    'hover-card-content': 'hover-card',
    'select-trigger': 'select',
    'select-content': 'select',
    'select-item': 'select',
    'select-value': 'select',
    menubar: 'menubar',
    'menubar-trigger': 'menubar',
    'navigation-menu': 'navigation-menu',
    dialog: 'dialog',
    combobox: 'combobox',
    checkbox: 'checkbox',
    switch: 'switch',
    radio: 'radio',
    'radio-group': 'radio-group',
    label: 'label',
    tooltip: 'tooltip',
    popover: 'popover',
    'popover-content': 'popover',
    sheet: 'sheet',
    drawer: 'drawer',
    toast: 'toast',
    toaster: 'toast',
    accordion: 'accordion',
    collapsible: 'collapsible',
    avatar: 'avatar',
    calendar: 'calendar',
    'date-picker': 'date-picker',
    'date-field': 'date-field',
    menu: 'menu',
    command: 'command',
    'command-palette': 'command',
    listbox: 'listbox',
    'color-picker': 'color-picker',
    'file-drop': 'file-drop',
  };

  const mapped = aliases[componentId];
  if (mapped && scenarios.has(mapped)) return mapped;

  // Strip -content / -trigger suffixes
  const stripped = componentId
    .replace(/-trigger$/, '')
    .replace(/-content$/, '')
    .replace(/-item$/, '')
    .replace(/-portal$/, '')
    .replace(/-viewport$/, '')
    .replace(/-value$/, '')
    .replace(/-group$/, '')
    .replace(/-label$/, '')
    .replace(/-separator$/, '');
  if (stripped !== componentId && scenarios.has(stripped)) return stripped;

  return undefined;
}

export function hasBehaviorScenario(name: string): boolean {
  return loadScenarios().has(name);
}

/** For tests: force-reload scenario list. */
export function resetBehaviorScenarioCache(): void {
  scenarioSet = null;
}

export function behaviorScenariosExist(): boolean {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../');
  return existsSync(join(repoRoot, 'tests/behavior/scenarios'));
}

/**
 * How many behavior checks a scenario's spec defines: its rows
 * (`id: '…'` in `defineRows`) plus standalone `test(…)` cases.
 */
export function behaviorCheckCount(name: string): number {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../../');
  try {
    const spec = readFileSync(
      join(repoRoot, 'tests/behavior/scenarios', `${name}.spec.ts`),
      'utf8'
    );
    const rows = spec.match(/^\s+id: '[a-z0-9-]+',$/gm)?.length ?? 0;
    const tests = spec.match(/^\s*test\(/gm)?.length ?? 0;
    return rows + tests;
  } catch {
    return 0;
  }
}
