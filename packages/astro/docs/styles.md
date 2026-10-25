# `@texuli/astro/styles.css`

The `@texuli/astro/styles.css` export is a CSS entry point for Astro sites. It
imports the token package's base stylesheet and forced-colors mapping, then
adds Texuli density, radius, and print rules. It does not include component
styles for every Texuli package, a Tailwind preset, or a theme catalog.

Import it from a site-owned global stylesheet so Astro includes it in the
document:

```css
@import '@texuli/astro/styles.css';
```

## Contents

- `@texuli/tokens/base.css` provides the base token contract and layer.
- `@texuli/tokens/forced-colors.css` maps the token system for forced-colors
  environments.
- `data-tx-density` selects the `compact`, `comfortable`, or `spacious`
  density scale (`0.875`, `1`, or `1.125`).
- `data-tx-radius` selects the `compact`, `comfortable`, or `rounded` radius
  scale (`0.75`, `1`, or `1.25`).
- `@media print` requests a light color scheme, sets motion and shadow tokens
  for print, and uses economical print color adjustment.

The integration sets the density and radius attributes before paint when those
options are configured. A host may set the same supported attributes on the
root element directly. The integration also applies matching token overrides
to a cached theme so those choices continue to win when the theme cache is
restored.

## CSS and Tailwind consumers

This stylesheet imports token base and forced-colors CSS directly. The
`astro-tailwind` packed consumer fixture instead imports the token base and
Tailwind preset from `@texuli/tokens`; that fixture does not use
`@texuli/astro/styles.css` or the Astro integration. Follow the setup that
matches the CSS pipeline of your site.

The exact stylesheet content is in [`src/styles.css`](../src/styles.css).
`packages/astro/tests/integration.test.ts` checks the imports, supported
variants, and print rule.
