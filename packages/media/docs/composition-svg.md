# Composition SVG renderer

**Package:** `@texuli/media`  
**Import:** `import { CompositionSvg, renderCompositionSvg, compositionToSvgString } from '@texuli/media/composition-svg'`  
**Tests:** `packages/media/tests/composition-svg.test.ts`  
**Example:** `media-composition-svg`

## Contract

- Input is validated with `validateComposition` (unless `validate: false`).
- Image `src` values are filtered again with `safeImageSrc` from
  `@texuli/core/url-policy` (subpath import).
- **Text stays text:** text layers become SVG `<text>` nodes, never path
  outlines, never `{@html}`.
- Root SVG is `role="img"` with `<title>` / `aria-label`, focusable by default
  (`tabindex="0"`) for keyboard access.
- Unsafe compositions surface a `role="alert"` error panel in the Svelte
  component; the pure API returns `{ ok: false, errors }`.

## API

| Export | Role |
| --- | --- |
| `renderCompositionSvg` | Build an `SvgElementNode` tree |
| `serializeSvg` / `compositionToSvgString` | XML string (escaped) |
| `CompositionSvg` | Svelte renderer (no HTML sinks) |
| `escapeXml` | Shared XML escape helper |

Class names use `cx` from `texuli/cx`. Styles live in `@layer tx.components`.
