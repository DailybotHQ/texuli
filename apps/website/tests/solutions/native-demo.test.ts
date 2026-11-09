// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import specCatalog from '../../../../packages/spec/catalog/components.json';
import blueprintSchema from '../../../../packages/spec/schemas/blueprint.schema.json';
import {
  type Schema,
  type SpecCatalog,
  validateBlueprint,
} from '../../../../packages/spec/src/index.ts';
import NativeDemoIsland from '../../src/components/sections/native/demo/NativeDemoIsland.svelte';
import NativeDemoPreview from '../../src/components/sections/native/demo/NativeDemoPreview.svelte';
import {
  NATIVE_DEMO_FIXTURE,
  NATIVE_DEMO_FIXTURE_JSON,
  NATIVE_DEMO_PARITY,
  NATIVE_DEMO_SPEC_VERSION,
  NATIVE_DEMO_TRACE_JSON,
} from '../../src/components/sections/native/demo/native-demo-data.ts';

const section = readFileSync(
  resolve('apps/website/src/components/sections/native/demo/NativeDemo.astro'),
  'utf8'
);

describe('Native Demo A', () => {
  it('uses a real @texuli/spec golden fixture that validates and has trace-backed parity rows', () => {
    expect(
      validateBlueprint(NATIVE_DEMO_FIXTURE, {
        blueprintSchema: blueprintSchema as unknown as Schema,
        catalog: specCatalog as unknown as SpecCatalog,
      })
    ).toEqual({ ok: true, diagnostics: [] });
    expect(NATIVE_DEMO_SPEC_VERSION).toBe('0.13.0');
    expect(NATIVE_DEMO_FIXTURE.id).toBe('report-week-42');
    expect(NATIVE_DEMO_FIXTURE_JSON).toContain('Delivery report, week 42');
    expect(NATIVE_DEMO_FIXTURE_JSON).toContain('charts-stacked-bar');

    const rows = new Map(NATIVE_DEMO_PARITY.map((row) => [row.id, row]));
    for (const id of ['layout-doc', 'blocks-text', 'blocks-data', 'charts-stacked-bar']) {
      const row = rows.get(id);
      expect(row, id).toBeDefined();
      expect(row?.web).toBe('Supported');
      expect(row?.composeDesktop).not.toBe('Unsupported');
      expect(row?.conformance).toBe('Supported');
      expect(row?.tracePath).toBe('native/conformance/expected/report-on-demand.trace.json');
    }
    expect(NATIVE_DEMO_TRACE_JSON).toContain('"id": "charts-stacked-bar"');
    expect(section).toContain('data-tx-native-demo-parity=');
    expect(section).toContain('not as a fabricated native preview');
    expect(section).toContain('client:visible');
    expect(section).toContain('packages/spec/fixtures/golden/report-on-demand.json');
    expect(section).toContain('native/conformance/expected/report-on-demand.trace.json');
  });

  it('renders the validated golden through the real web player for the static preview', async () => {
    const { container } = render(NativeDemoPreview);
    await waitFor(() => expect(container.textContent).toContain('Delivery report, week 42'));
    expect(
      container.querySelector('[data-tx-native-demo-preview="report-on-demand"]')
    ).not.toBeNull();
    expect(container.querySelector('script, [onerror], [onclick]')).toBeNull();
  });

  it('exposes text JSON and trace, copies the fixture, and resets island controls', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(NativeDemoIsland, {
      props: {
        blueprintJson: NATIVE_DEMO_FIXTURE_JSON,
        traceJson: NATIVE_DEMO_TRACE_JSON,
        specVersion: NATIVE_DEMO_SPEC_VERSION,
      },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Copy validated JSON' }));
    expect(writeText).toHaveBeenCalledWith(NATIVE_DEMO_FIXTURE_JSON);
    expect(screen.getByRole('status').textContent).toContain('copied');

    await fireEvent.click(screen.getByRole('button', { name: 'View JSON' }));
    expect(
      (screen.getByRole('textbox', { name: 'Blueprint JSON text' }) as HTMLTextAreaElement).value
    ).toBe(NATIVE_DEMO_FIXTURE_JSON);

    await fireEvent.click(screen.getByRole('button', { name: 'View Kotlin trace' }));
    expect(
      screen.getByRole('region', { name: 'Recorded Compose Desktop semantic trace' }).textContent
    ).toContain('not a native UI preview');

    await fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(screen.queryByRole('region', { name: 'Validated blueprint JSON' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Demo reset');
  });
});
