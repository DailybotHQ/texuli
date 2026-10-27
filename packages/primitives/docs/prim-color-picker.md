# ColorPicker primitive

**Package:** `@texuli/primitives`
**Import:** `import { ColorPicker } from '@texuli/primitives/color-picker'`
**Tests:** `packages/primitives/tests/models.test.ts`, `packages/primitives/tests/forms.test.ts`
**Browser check:** `tests/behavior/scenarios/color-picker.spec.ts`

`ColorPicker.Root` provides controlled or uncontrolled color state and composes
the headless parts through Svelte snippets. It accepts `bind:value`,
`defaultValue`, `onValueChange`, and `format` (`hex`, `rgb`, `hsl` or `oklch`).
The optional `child` snippet receives the root's role and accessible-name props
for a custom wrapper:

```svelte
<ColorPicker.Root bind:value label="Brand color">
  <ColorPicker.Area />
  <ColorPicker.Hue />
  <ColorPicker.Alpha />
  <ColorPicker.FormatInput />
  <ColorPicker.Swatch value="#2457d6" label="Blue" />
</ColorPicker.Root>
```

`value` is a CSS hex, rgb, hsl or oklch string. Set `format` to choose the
format emitted by later edits; the text input accepts all four formats. The
area edits OKLCH lightness
and chroma while preserving hue; hue and opacity are independent sliders.
Pointer input works on the area, and its keyboard bindings are arrows (Shift
for a larger step), Home (black/neutral) and End (white/high chroma). The
format input rejects values outside these supported formats and keeps the
last accepted color. Swatches are named buttons with their parsed `data-color`
and `aria-pressed` state.

This is a headless primitive. Consumers supply dimensions, color-area gradients,
focus styling and token-based contrast styles. It has no runtime dependencies
and does not use the browser's native color picker.
