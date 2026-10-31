/// <reference types="node" />
/**
 * `DesignSystemProvider` (`texuli/design-system`, ADR-023, T-ds-runtime): a
 * scope element that applies a compiled design system with
 * `applyDesignSystem`, provides its component defaults, switches in one
 * style write, and is the scope portals inside it follow. The texuli root
 * never reaches it, so apps without a design system pay nothing.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createScopedPortalRoot, findPortalScope } from '@texuli/core';
import {
  designSystemDeclarations,
  applyDesignSystem as tokensApply,
} from '@texuli/tokens/design-system/apply';
import {
  type CompiledDesignSystem,
  compileDesignSystem,
  DESIGN_SYSTEM_ATTRIBUTES,
  resolveDesignSystem,
} from '@texuli/tokens/design-system/compile';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyDesignSystem,
  loadDesignSystemCompiler,
  PROVIDER_ATTRIBUTES,
} from '../src/design-system/index.ts';
import Harness from './fixtures/DesignSystemProviderHarness.svelte';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
type Doc = Record<string, unknown>;
const json = (path: string): Doc => JSON.parse(readFileSync(join(root, path), 'utf8'));

async function compiled(path: string): Promise<CompiledDesignSystem> {
  const resolved = await resolveDesignSystem(json(path), { trust: 'developer' });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const result = compileDesignSystem(resolved.document, {
    trust: 'developer',
    modes: ['light', 'dark'],
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

const acme = {
  ...(await compiled('packages/spec/fixtures/design-systems/acme.json')),
  defaults: { button: { variant: 'outline' } },
} as CompiledDesignSystem;
const minimal = await compiled('packages/spec/fixtures/design-systems/minimal.json');

function inlineVars(el: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < el.style.length; i++) {
    const name = el.style.item(i);
    if (name.startsWith('--tx-')) out[name] = el.style.getPropertyValue(name);
  }
  return out;
}

const expected = (system: CompiledDesignSystem, mode: 'light' | 'dark') =>
  Object.fromEntries(designSystemDeclarations(system.vars[mode] ?? {}));

afterEach(cleanup);

describe('DesignSystemProvider', () => {
  it('scopes the compiled variables, attributes and component defaults to its element', async () => {
    render(Harness, { compiled: acme });
    await tick();
    const scope = screen.getByTestId('scope');
    expect(scope.getAttribute('data-tx-scope')).toBe('acme');
    expect(scope.getAttribute('data-tx-mode')).toBe('light');
    for (const name of DESIGN_SYSTEM_ATTRIBUTES) {
      expect(scope.getAttribute(name), name).toBe(acme.attrs[name] ?? null);
    }
    expect(inlineVars(scope)).toEqual(expected(acme, 'light'));
    // Component defaults come from the compiled design system.
    expect(screen.getByTestId('defaults').textContent).toBe('{"variant":"outline"}');
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('tx-button--outline');
    // Portals opened inside follow this scope (T-scope-portals).
    const button = screen.getByRole('button', { name: 'Save' });
    expect(findPortalScope(button)).toBe(scope);
    const portal = createScopedPortalRoot(scope);
    expect(portal?.element.style.getPropertyValue('--tx-primary')).toBe(
      acme.vars.light?.['--tx-primary']
    );
    expect(portal?.element.getAttribute('data-tx-ds')).toBe('acme');
    portal?.destroy();
  });

  it('switches mode and design system in one style write each', async () => {
    const view = render(Harness, { compiled: acme });
    await tick();
    const scope = screen.getByTestId('scope');
    for (const [system, mode] of [
      [acme, 'dark'],
      [minimal, 'dark'],
      [minimal, 'light'],
      [acme, 'light'],
    ] as const) {
      const records: MutationRecord[] = [];
      const observer = new MutationObserver((list) => records.push(...list));
      observer.observe(scope, { attributes: true, attributeFilter: ['style'] });
      await view.rerender({ compiled: system, mode });
      await tick();
      records.push(...observer.takeRecords());
      observer.disconnect();
      expect(records.length, `${system.id} ${mode}`).toBe(1);
      expect(inlineVars(scope)).toEqual(expected(system, mode));
      expect(scope.getAttribute('data-tx-mode')).toBe(mode);
      expect(scope.getAttribute('data-tx-ds')).toBe(system.id);
    }
    // The defaults follow the provider: minimal sets none, so the button is back to `default`.
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.className).toContain('tx-button--outline');
    await view.rerender({ compiled: minimal, mode: 'light' });
    await tick();
    expect(button.className).toContain('tx-button--default');
    await view.rerender({ compiled: acme, mode: 'light' });
    await tick();
    expect(button.className).toContain('tx-button--outline');
    // happy-dom re-parses ~310 custom properties per write; under CI load the
    // six switches take several seconds. The real switch cost is measured in
    // Chromium (tests/perf/design-system-switch.test.ts).
  }, 20_000);

  it('renders the allowlisted attributes in markup, so designSystemStyle matches server HTML', () => {
    expect([...PROVIDER_ATTRIBUTES]).toEqual([...DESIGN_SYSTEM_ATTRIBUTES]);
  });
});

describe('runtime helpers for hosts without @texuli/tokens (T-ds-blueprint)', () => {
  it('re-exports applyDesignSystem and loads the compiler on demand', async () => {
    expect(applyDesignSystem).toBe(tokensApply);
    const compiler = await loadDesignSystemCompiler();
    expect(compiler.compileDesignSystem).toBe(compileDesignSystem);
    const source = readFileSync(join(root, 'packages/texuli/src/design-system/index.ts'), 'utf8');
    // Only a dynamic import reaches the compiler, so the subpath stays small.
    expect(source).not.toMatch(/from\s+'@texuli\/tokens\/design-system\/compile'/);
    expect(source).toContain("import('@texuli/tokens/design-system/compile')");
  });
});

describe('laziness: texuli/design-system', () => {
  it('stays out of the texuli root import graph', () => {
    const src = join(root, 'packages/texuli/src');
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)) {
        const spec = match[1] as string;
        expect(spec, relative(src, file)).not.toMatch(/design-system/);
        if (spec.startsWith('.') && /\.(?:ts|svelte)$/.test(spec)) visit(join(dirname(file), spec));
      }
    };
    visit(join(src, 'index.ts'));
    expect(seen.size).toBeGreaterThan(50);
  });
});
