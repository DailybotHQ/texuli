# Design systems: component tokens, hooks and defaults

> **Status:** released in `0.9.0` (pre-1.0).
> Token contract v2 is [ADR-020](../../../docs/DECISIONS.md#adr-020-token-contract-v2-additive-families-and-a-real-component-tier);
> the design-system document that sets all of this from one JSON file
> (ADR-021) and `DesignSystemProvider` (`texuli/design-system`, ADR-023) are
> in development for `0.10.0`, not on npm.

A design system or an agent restyles Texuli components through three
channels, none of which needs CSS of its own:

| Channel | Reaches | Set with |
| --- | --- | --- |
| Component tokens | sizes, spaces, radii, borders, shadows, z-indexes and type of each component | CSS custom properties on a scope (`--tx-button-radius`) |
| Hooks | a closed look per component (pill buttons, glass cards) | `data-tx-*-style` attributes on a scope |
| Defaults | the default `variant` and `size` props | `setDesignDefaults` (`texuli/defaults`) |

## Component tokens

Every styled component reads its own tokens with one fallback level: the
registry default (`@texuli/tokens/components`), which names a system token
`@texuli/tokens/base.css` declares (`var(--tx-button-gap, var(--tx-space-2))`).
Component tokens themselves are never declared, so they cost nothing until a
scope sets one, and the default themes keep their pixels:

```css
[data-tx-scope="acme"] {
  --tx-button-radius: 9999px;
  --tx-card-padding-inline: 1.5rem;
  --tx-dialog-z-index: 80;
}
```

Each component page lists its tokens in a generated **Tokens** section (for
example [ui-button](ui-button.md#tokens)); every token and its exact read
expression is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).
Sizes and spaces a component has no token for read the system tokens
(`--tx-space-*`, `--tx-size-*`, `--tx-shape-radius-*`, `--tx-elevation-*`,
`--tx-z-*`) plainly (`var(--tx-space-4)`), so `--tx-density` and the theme
radius reach them too. Import `@texuli/tokens/base.css` (the quick start
already does): it declares those system defaults. Each
stylesheet lists the literals it keeps (hit areas, hairlines, layout limits)
and why, in its header comment.

## Hooks

The tier-3 hooks (`ComponentHooks` in `@texuli/tokens/contract`) are data
attributes on any ancestor. The no-flash script (`@texuli/tokens/no-flash`)
writes them on `<html>` from the cached appearance; the Astro integration
writes the button, card and focus ring hooks (not the input hook yet). Each
sets component tokens, so a token set closer to the component still wins.

| Attribute | Values | Effect |
| --- | --- | --- |
| `data-tx-button-style` | `pill`, `square` (`default`: theme radius) | `--tx-button-radius` |
| `data-tx-card-style` | `bordered`, `glass` (`solid`: default) | `bordered` drops `--tx-card-elevation`; `glass` mixes `--tx-card-background` with transparency and blurs the backdrop |
| `data-tx-input-style` | `compact`, `comfortable` (`default`) | `--tx-input-height` and `--tx-input-padding-inline` one control step down or up |
| `data-tx-focus-ring-style` | `outline`, `inset`, `glow` (`ring`: default) | sets `--tx-focus-ring-offset` (and a halo for `glow`) on the focused element (the rules live in `@texuli/tokens/base.css`) |

## Scopes and overlays

A scope is any element carrying `data-tx-scope` (ADR-023). `applyTheme(el)`
(`@texuli/tokens`) writes it (empty unless the host already named the
scope), and so does `applyDesignSystem` (`@texuli/tokens/design-system/apply`, unreleased). `@texuli/tokens/base.css`
declares the system token defaults on `:where(:root, [data-tx-theme],
[data-tx-scope])`, so derived tokens (space, radius and type steps) resolve
against the nearest scope; nothing needs `:root`.

Overlays keep their scope:

- **In place** (menus, context menus, menubars, selects, comboboxes,
  popovers, hover cards, tooltips, navigation menus, date pickers, the
  Toaster): they render inside the subtree and show in the top layer, so they
  inherit its tokens and its `[data-tx-scope="…"]` rules directly.
- **Portaled** (Dialog, AlertDialog, Sheet, Drawer, DetailPanel,
  ResponsiveModal, CommandPalette, the app navigation drawers, the media
  Lightbox): `Dialog.Portal` and `AlertDialog.Portal` mount in a scoped
  portal root, a `display: contents` child of `body` that mirrors the
  scope's `data-tx-*` attributes (including a named `data-tx-scope="acme"`,
  so the rules above match it too) and its inline custom properties, kept in
  sync while it lives. A host that wants a frame passes the target instead
  (`portal` on Dialog and AlertDialog, `to` on the primitives).

Custom properties a scope gets only through a class rule are not mirrored;
put them on a `[data-tx-scope="…"]` rule or inline. Details:
[core-portal](../../core/docs/core-portal.md#token-scopes-adr-023).

## Defaults

CSS cannot choose a default variant or size, so `texuli/defaults` provides
them through a Svelte context. A component uses its design default only when
its own prop is undefined; without a provider it costs one `getContext`.

```svelte
<script lang="ts">
  import { setDesignDefaults } from 'texuli/defaults';

  // Static defaults:
  setDesignDefaults({ button: { variant: 'outline', size: 'sm' }, card: { variant: 'flat' } });

  // Or reactive: pass a function.
  // let size = $state<'sm' | 'md'>('sm');
  // setDesignDefaults(() => ({ button: { size } }));
</script>
```

- **Closed vocabulary:** `DESIGN_DEFAULTS_VOCABULARY` lists, for 45
  component ids (`button`, `icon-button`, `select`, `menu`, `sheet`…), the
  `variant` and `size` values each accepts; `DesignDefaults` is typed from it.
  `Table` keeps its built-in `plain` variant for now (**planned**: the read
  would push `@texuli/data/grid-editing` over its size cap).
- **Untrusted input:** `validateDesignDefaults(input)` keeps known
  components, props and values and reports the rest with a path and a code
  (`not-object`, `unknown-component`, `unknown-prop`, `unknown-value`);
  `setDesignDefaults` runs it and returns the issues, so agent-written
  defaults can never select a class that does not exist.
- **Nesting:** an inner provider merges over the outer one, per component
  and prop. `getDesignDefaults()` (or `getDesignDefaults('button')`) returns
  the defaults in effect.
- **Precedence:** explicit prop, then the nearest provider, then the outer
  providers, then the component's built-in default.

Tests: `packages/texuli/tests/design-defaults.test.ts` (every component with
a `variant` or `size` prop, the vocabulary against each family's constants,
hostile input), `packages/tokens/tests/token-contract-v2.test.ts` (every read
is in its exact one-level form, `base.css` declares every system default,
every component page carries its Tokens section).

## DesignSystemProvider

> **Status:** in development for `0.10.0`, not on npm.

`texuli/design-system` exports `DesignSystemProvider`: a `<div>` scope that
applies a compiled design system
([design-system-runtime.md](../../tokens/docs/design-system-runtime.md))
and provides its component defaults to every Texuli component inside.

```svelte
<script lang="ts">
  import { DesignSystemProvider } from 'texuli/design-system';
  import { Button } from 'texuli/button';
  import compiled from './acme.compiled.json'; // compileDesignSystem output, cached

  let mode = $state<'light' | 'dark'>('light');
</script>

<DesignSystemProvider {compiled} {mode} class="preview">
  <Button>Save</Button>
</DesignSystemProvider>
```

| Prop | Default | Effect |
| --- | --- | --- |
| `compiled` | required | A `CompiledDesignSystem` (or a cached JSON copy) |
| `mode` | `light` | The compiled mode to apply |
| `variant` | `compiled.variant` | Must match the variant it was compiled for |
| `scope` | the design system's id | The `data-tx-scope` name, so `[data-tx-scope="acme"]` rules match |
| `fonts` | `true` | Register `fontFaces` lazily on first use |
| `base` | the document's base URI | What relative font paths resolve against |
| `ref` | | The scope element (bindable) |

- **Scope:** the element carries `data-tx-scope`, `data-tx-mode` and the
  allowlisted `data-tx-ds*` and hook attributes in markup (escaped
  attribute values, so server HTML already matches `designSystemStyle`'s
  default `[data-tx-ds="<id>"]` selector), and the variables inline after
  mount through `applyDesignSystem`. Portaled overlays inside (Dialog,
  Sheet, CommandPalette…) mount in a scoped portal root that mirrors them
  (see Scopes and overlays above).
- **Switching:** a new `compiled` or `mode` re-applies in one style write;
  the element is restored only when the provider unmounts.
- **Defaults:** `compiled.defaults` goes through `setDesignDefaults`, so the
  closed vocabulary filters it and an inner `setDesignDefaults` still wins.
- **Server rendering:** effects do not run on the server, so put
  `designSystemStyle(compiled)` in the page head (the `@texuli/astro`
  `designSystem` option does it) for a first paint with the variables.
- **Cost:** a subpath of its own, 3,345 B gzip with the runtime bundled; the
  `texuli` root never imports it (a test walks the import graph; the root
  measured 217,091 B before and after).

The subpath also re-exports `applyDesignSystem` (with its
`ApplicableDesignSystem` and `ApplyDesignSystemOptions` types) and offers
`loadDesignSystemCompiler()`, which imports
`@texuli/tokens/design-system/compile` on demand as a lazy chunk (never at
import), for hosts that compile at run time without depending on
`@texuli/tokens` themselves: `@texuli/player` uses both for a blueprint's
`designSystem` (spec 0.10.0).

Tests: `packages/texuli/tests/design-system-provider.test.ts`.
