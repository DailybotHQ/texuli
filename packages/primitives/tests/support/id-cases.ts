import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Component } from 'svelte';
import { describe, expect, it } from 'vitest';
import { brokenIdRefs } from './id-refs.ts';

/**
 * FIX-consumer-ids: a table of primitives rendered with consumer ids on their
 * id-bearing parts. Each case opens what renders on demand, then checks the
 * ids are kept on the right elements, a `<label for>` names its control,
 * the listed references point at the consumer ids, and no reference dangles.
 */
export interface IdCase {
  name: string;
  fixture: Component;
  /** Brings the parts that render on demand into the document. */
  open?: () => Promise<unknown>;
  /** id → what must carry it (a role, or a tag for elements without one). */
  ids: Record<string, string>;
  /** `<label for>` text → the role of the control it must name. */
  labels?: Record<string, string>;
  /** Extra checks: references that must point at the consumer ids. */
  refs?: Record<string, { attribute: string; id: string }>;
}

export { fireEvent, screen };

export function runIdCases(title: string, cases: readonly IdCase[]): void {
  describe(title, () => {
    for (const testCase of cases) {
      it(testCase.name, async () => {
        render(testCase.fixture);
        await testCase.open?.();
        for (const [id, role] of Object.entries(testCase.ids)) {
          await waitFor(() => {
            const element = document.getElementById(id);
            expect(element, `#${id}`).toBeTruthy();
            const actual = element?.getAttribute('role') ?? element?.tagName.toLowerCase();
            expect(actual, `#${id} role`).toBe(role);
          });
        }
        for (const [text, role] of Object.entries(testCase.labels ?? {})) {
          expect(
            screen.getByLabelText(text).getAttribute('role') ??
              screen.getByLabelText(text).tagName.toLowerCase()
          ).toBe(role);
        }
        for (const [id, ref] of Object.entries(testCase.refs ?? {})) {
          expect(
            document.getElementById(id)?.getAttribute(ref.attribute),
            `#${id} ${ref.attribute}`
          ).toBe(ref.id);
        }
        await waitFor(() => expect(brokenIdRefs()).toEqual([]));
      });
    }
  });
}
