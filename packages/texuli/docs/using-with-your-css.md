# Using Texuli with your own CSS

**Package:** `texuli`  
**Related:** [Button](./ui-button.md), site guide [Theming](https://texuli.com/guides/theming/)

## Layer contract

Texuli component styles ship in CSS cascade layers:

| Layer | Who owns it | Purpose |
| --- | --- | --- |
| *(your early layer)* | Host app | Resets and **element** defaults (`a`, `body`, …) |
| `tx.base` | `@texuli/tokens/base.css` | Base reset and token surfaces |
| `tx.components` | `texuli/*` components | Component chrome (Button, Card, …) |
| *(your late layer or unlayered classes)* | Host app | App utilities and component overrides |

Declare the full order **once, first** in the host stylesheet (before importing
Texuli), then put element defaults in the early host layer:

```css
/* Hyphenated host names stay top-level. Dotted names nest (site.base is a
   child of site), which would put site.overrides *before* tx.components. */
@layer site-base, tx.base, tx.components, site-overrides;

@layer site-base {
  /* Element defaults / resets — before Texuli components */
  a {
    color: var(--tx-link);
  }
}

/* After @import '@texuli/tokens/base.css' and component CSS: */
@layer site-overrides {
  .my-primary-button {
    /* Beats tx.components without !important */
    color: CanvasText;
  }
}
```

When `@texuli/tokens/base.css` later runs `@layer tx.base, tx.components`, those
names already exist in this order, so Texuli joins the stack instead of
reordering it.

## Why this matters

**Unlayered** global element rules (for example a bare `a { color: … }` outside
any `@layer`) beat **every** layered rule by CSS design — including
`.tx-button--default` in `tx.components`. That makes an anchor Button paint
link ink on a primary fill and fail contrast.

Put those element defaults in a layer declared **before** `tx.base`. Texuli
components then keep their AA-gated token pairs. Your own **classes** still win
when they live in a later layer (or as unlayered class rules with enough
specificity for your app).

## Do not

- Ship unlayered library rules that pin `a.tx-button` colors at high
  specificity (that would trap consumers who need to override).
- Rely on `!important` to “fix” host `a {}` vs Button.
- Name host layers with dots when they must sandwich `tx.*` (`site.overrides`
  nests under `site` and still loses to `tx.components`).

## Anchor Buttons

`Button` with `href` renders a real `<a class="tx-button …">`. The
`primaryForeground` / `primary` pair (and the documented `button.default-anchor`
AA gate pair) still applies. Host link color only applies when it is layered
under Texuli, not when it is unlayered.

## A class from the parent's `<style>` (G-060)

A Svelte `<style>` block is scoped: the compiler adds the component's hash
class (`svelte-1abc23`) to every selector and to the elements in that
component's own markup. A Texuli component's root element is in the
component's markup, not yours, so it never gets your hash. A scoped rule for
a class you pass in therefore never matches it:

```svelte
<Button class="save">Save</Button>
<span class="save">Saved 2 minutes ago</span>

<style>
  /* Compiles to .save.svelte-1abc23: it styles the span, never the Button. */
  .save {
    font-weight: 700;
  }
</style>
```

Svelte reports `css_unused_selector` (and drops the rule) only when no
element of your own carries the class. When one does, as in the example
above or halfway through a migration from native `<button>` elements, the
rule compiles with no warning and silently skips the Button.

Reach the component's root with `:global()`, and keep the rule local by
putting a scoped wrapper of your own in front of it:

```svelte
<div class="toolbar">
  <Button class="save">Save</Button>
</div>

<style>
  /* .toolbar.svelte-1abc23 .save: only Buttons inside this toolbar. */
  .toolbar :global(.save) {
    font-weight: 700;
  }
</style>
```

The rule is unlayered, so it beats `@layer tx.components` without
`!important`. The root also carries `data-tx-button` and `data-variant`
hooks (`.toolbar :global([data-tx-button][data-variant='ghost'])`).

### A minimal Button when migrating from native buttons

`Button` has no unstyled variant. Pick the lightest one that fits:
- `variant="ghost"`: transparent background, foreground text, a muted hover
  fill; it keeps the size's padding, block size, focus ring and disabled
  state.
- `variant="link"`: link color with no padding and no minimum block size,
  underlined on hover.

Then remove what you do not need through the wrapper, for example
`.toolbar :global(.save) { padding-inline: 0; }`. For a control with no
Texuli chrome at all, keep the native `<button>`.
