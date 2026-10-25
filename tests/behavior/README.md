# Behavior suite

Texuli's own behavior checks for `@texuli/primitives`: one scenario page per
primitive, and a list of **rows** that drive it as a user would. Each row
asserts only what a user or assistive technology can observe, so a row stays
true however the markup changes.

```bash
# Every primitive on Chromium, WebKit and the Pixel 7 (set your lane port)
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior

# One primitive
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/dialog.spec.ts

# Also assert the open-to-focus timing limits (off by default; see below)
TEXULI_PERF=1 TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior

# Report the last run against the limits (rows, open-to-focus p75)
pnpm exec tsx tests/behavior/harness/limits-cli.ts [<primitive>] [--measure]
```

## The oracle

`harness/oracle.ts` holds what a row may observe:
- roles, accessible names and states;
- the focus sequence, Escape, outside pointer and outside focus;
- the events a scenario reports (`behaviorEvent` in the scenario,
  `behaviorEvents(page)` in the row);
- scroll lock and inertness.

It never reads DOM shape or class names.

| Helper | What it does |
| --- | --- |
| `gotoScenario(page, primitive)` | Opens `/?behavior=<primitive>` and waits until the scenario has mounted |
| `focusedElement(page)` | Role and accessible name of what has focus |
| `focusSequence(page, n, { reverse })` | The focus stops of `n` Tab (or Shift+Tab) presses |
| `focusIsWithin(locator)` | Whether focus is inside a layer |
| `isInert(locator)` | Whether focus cannot land on an element |
| `isScrollLocked(page)` | Whether the page refuses to scroll |
| `pointerOutside(page)` | A pointer press on the frame's outside area |
| `openToFocus({ trigger, within, close })` | Samples of the time from activating a trigger to focus inside the layer |
| `behaviorEvents(page)` | The events the scenario reported, in order |
| `frame.before/after/outside(page)` | The frame's fixed controls around every scenario |

## Pass rules (absolute limits)

A primitive passes when:
1. **every row passes**, on Chromium, WebKit and the Pixel 7. A flaky row gets
   at most two retries;
2. its subpath stays within its **`texuli.budgets.json` cap** (`pnpm size`);
3. its **open-to-focus p75** stays within its limit in
   `OPEN_TO_FOCUS_P75_MS` (`harness/limits.ts`; 150 ms where none is
   listed).

Timing is a wall-clock check, so it is asserted only with `TEXULI_PERF=1`.
The samples are always written to `tmp/behavior-results/<project>/` for
`limits-cli.ts`. The listed limits were measured with
`limits-cli.ts --measure`: the worst p75 across the three projects, doubled
and rounded up to 10 ms, with a 50 ms floor.

## Files

```text
tests/behavior/scenarios/<primitive>/scenario.svelte   the scenario page (@texuli/primitives public API)
tests/behavior/scenarios/<primitive>.spec.ts           the rows
tests/behavior/scenarios/common.ts                     helpers the scenarios share
tests/behavior/harness/                                 oracle, limits, row runner, self test, sample
tests/fixtures/behavior/                                the host and registry the fixture app mounts
```

A scenario is found by convention (`tests/fixtures/behavior/registry.ts`) and
loads lazily. Scenarios import packages by their public names
(`@texuli/primitives/<name>`).

## Writing a row

```ts
import { expect } from '@playwright/test';
import { defineRows, scenario } from '../harness/index.ts';
import { focusedElement } from '../harness/oracle.ts';

scenario(
  'dialog',
  defineRows([
    {
      id: 'escape-returns-focus',
      title: 'Escape closes it and focus returns to the trigger',
      async run({ page }) {
        await page.getByRole('button', { name: 'Open settings' }).click();
        await page.keyboard.press('Escape');
        await expect.poll(() => focusedElement(page)).toEqual({ role: 'button', name: 'Open settings' });
      },
    },
  ])
);
```

Rows are held to the WAI-ARIA Authoring Practices pattern for the primitive.
Row ids are lowercase slugs, unique within a scenario.

## The self test

`harness/self.spec.ts` checks the harness itself:
- the limit rules on fixed data;
- the sample scenario (`harness/sample/`): every row passes, and the
  open-to-focus samples are recorded;
- a deliberately broken copy (focus not returned, scroll lock never released),
  which fails exactly the two rows that guard those bugs;
- an unknown scenario, which reports an error instead of hanging.
