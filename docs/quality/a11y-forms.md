# Accessibility sweep: forms and inputs

**Task:** `T-quality-a11y-forms` · **Gate:** `tests/e2e/a11y-forms.spec.ts`

Automated axe-core checks for form and input examples. Findings are fixed at
the component source; the gate never disables axe rules. APCA is out of scope;
WCAG 2.x contrast is the contrast gate.

## Scope (under gate)

| Family | Example ids |
| --- | --- |
| Actions | `texuli-button`, `texuli-toggle` |
| Field shell | `texuli-field` |
| Text | `texuli-input` |
| Choice | `texuli-choice` |
| Lists | `texuli-combobox`, `ui-select` |
| Date / number | `texuli-date`, `texuli-number-pin` |
| Range / files / tags | `texuli-slider`, `texuli-file-upload`, `texuli-tags-color` |

## What the gate checks

1. **Light and dark axe** — every fixture above. Zero violations, zero rule exclusions.
2. **Forced colors** — every fixture under `forcedColors: 'active'`.
3. **400% reflow** — every fixture at 320 CSS-px width; no horizontal document overflow; axe clean.
4. **Keyboard** — field focus, choice Space, combobox/select listbox open/close, slider arrows, number spinbutton.
5. **RTL** — every fixture with `dir=rtl` on the document.
6. **Listbox width polish** — combobox and select listboxes are at least as wide as their trigger (same-width default; longer content may grow).

## Run

```sh
TEXULI_E2E_PORT=<lane-port> pnpm exec playwright test tests/e2e/a11y-forms.spec.ts
```

Projects: Chromium, WebKit, mobile Chromium. Lane ports only (COMMON.md); 4870 / 489x are lead-reserved.

## Honesty limits

- axe does not prove screen-reader speech.
- APCA is out of scope; WCAG 2.x contrast is the contrast gate.
- Forced-colors still needs a visual pass beyond axe.
- Open listboxes are checked when keyboard/open paths succeed; portal timing can vary by browser.

## Findings fixed at source (this task)

| Finding | Source fix |
| --- | --- |
| `label-content-name-mismatch` on toggle | Drop mismatching `aria-label` when visible text names the control (`ToggleDemo`) |
| `aria-required-children` on color swatches | `role="list"` → `role="group"` (`ColorPicker.svelte`) |
| File-upload contrast (muted + opacity 0.55 → ~2.27:1) | Disabled state no longer fades the whole zone; description uses solid foreground (`file-upload.css`) |
| Field error under forced-colors (Mark yellow on Canvas) | Error/required use `CanvasText` + bold underline (`field.css`) |
| Date range control overflows at 320 CSS-px | Control/field wrap + `max-inline-size: 100%`; calendar constrained (`date.css`); demo padding tightened |
| Combobox/Select listbox narrower than trigger | Positioner sets `minInlineSize` from anchor width (`Content.svelte`) |

## Findings log

| Date | Result | Notes |
| --- | --- | --- |
| 2026-10-23 | 168/168 pass (chromium, webkit, mobile) on port 4940 | Zero axe exclusions; reflow host overflow ≤16; listbox sameWidth polish covered |
| 2026-10-25 | 112/112 pass (chromium, mobile) on dev `852b8d2a`, port 4961 | WebKit was not selected in this current run; the complete three-project matrix is not re-verified today. |
