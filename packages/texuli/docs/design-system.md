# Design systems: component tokens, hooks and defaults

> **Status:** in the `0.9.0` workspace (in development, not on npm yet).
> Token contract v2 is [ADR-020](../../../docs/DECISIONS.md#adr-020-token-contract-v2-additive-families-and-a-real-component-tier);
> the design-system document that sets all of this from one JSON file is
> planned (ADR-021).

A design system or an agent restyles Texuli components through three
channels, none of which needs CSS of its own:

| Channel | Reaches | Set with |
| --- | --- | --- |
| Component tokens | sizes, spaces, radii, borders, shadows, z-indexes and type of each component | CSS custom properties on a scope (`--tx-button-radius`) |
| Hooks | a closed look per component (pill buttons, glass cards) | `data-tx-*-style` attributes on a scope |
| Defaults | the default `variant` and `size` props | `setDesignDefaults` (`texuli/defaults`) |

## Component tokens

Every styled component reads its own tokens, each with the registry default
(`@texuli/tokens/components`) as its CSS fallback, so the default themes keep
their pixels and nothing is declared until a scope sets a token:

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
`--tx-z-*`), so `--tx-density` and the theme radius reach them too. Each
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
| `data-tx-focus-ring-style` | `outline`, `inset`, `glow` (`ring`: default) | sets `--tx-focus-ring-offset` (and a halo for `glow`) on the focused element |

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

- **Closed vocabulary:** `DESIGN_DEFAULTS_VOCABULARY` lists, for 46
  component ids (`button`, `icon-button`, `select`, `menu`, `sheet`…), the
  `variant` and `size` values each accepts; `DesignDefaults` is typed from it.
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
carries the registry fallback, every component page carries its Tokens
section).
