# Component: Stepper and Wizard

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/stepper/`  
**Tests:** `packages/texuli/tests/navigation.test.ts`  
**Example:** `texuli-stepper`  
**Task:** T-ui-stepper

## Imports

```ts
import { Stepper, Wizard, type StepperStep } from 'texuli/stepper';
```

## Stepper

Progress navigation for a list of steps.

| Prop | Type | Notes |
| --- | --- | --- |
| `steps` | `StepperStep[]` | `{ id, label, description? }` — labels are author-localizable |
| `current` | `number` | 0-based active index |
| `completed` | `Iterable<string>` | step ids; default = all before `current` |
| `orientation` | `'horizontal' \| 'vertical'` | default horizontal |
| `onStepClick` | `(index) => void` | enables buttons on complete + current |
| `label` | `string` | `aria-label` for the nav (default `"Progress"`) |

States: `complete` | `current` | `upcoming` (data attributes + screen-reader phrases).

## Wizard

Multi-step form shell: Stepper + panel + Back/Next/Finish.

| Prop | Notes |
| --- | --- |
| `bind:current` | Active step index |
| `content` | Snippet `({ step, index })` |
| `canAdvance` | Sync gate for Next/Finish |
| `validate` | Sync/async; `false` or string stays; may throw |
| `onFinish` | Called after last step validates |
| `backLabel` / `nextLabel` / `finishLabel` | Localizable |
| `secondaryActions` | Optional footer snippet (start side) |

`Wizard` uses the styled `Button` (`texuli/button`) for actions (loading while validate/onFinish pending).

## Tokens and layers

CSS lives in `@layer tx.components` (`stepper.css`). Colors and radii use `--tx-*`.
Logical properties only. Forced-colors border fallbacks on markers.

## Accessibility

- `nav` with accessible name; `aria-current="step"` on the active item
- Clickable steps are real buttons with focus rings
- Wizard panel is focusable (`tabindex="-1"`) and receives focus on step change
- Validation failures use `role="alert"`
