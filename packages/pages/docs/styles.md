# `@texuli/pages/styles.css`

The stylesheet of the editor and the reader. `PageEditor` and `PageReader`
import it, so a bundler that keeps CSS side effects (`sideEffects:
["**/*.css"]`) needs nothing else; import `@texuli/pages/styles.css` yourself
when yours drops them. Import the token stylesheet once
(`@texuli/tokens/base.css`).

- **Tokens only:** colors, radii, borders, focus rings and shadows come from
  the `--tx-*` contract, with system-color fallbacks.
- **Logical properties only** (`inline-size`, `margin-inline`,
  `border-inline-start`, `padding-block`), so right-to-left documents follow
  `dir` (the root takes the document's `meta.dir` and `meta.locale`).
- **Forced colors:** selection, the active slash option, separators and
  frames map to `Highlight`, `HighlightText`, `ButtonText` and `CanvasText`.
- **Reduced motion:** layout motion runs through `texuli/motion`, which is
  instant under `prefers-reduced-motion: reduce`.

## Hooks

| Selector | What it is |
| --- | --- |
| `.tx-pages`, `.tx-pages-editor`, `.tx-pages-reader` | The roots |
| `.tx-pages-row`, `[data-block-type]`, `[data-block-id]`, `[data-block-selected]` | A block row and its state |
| `.tx-pages-row__gutter`, `.tx-pages-row__add`, `.tx-pages-row__handle` | The insert button and drag handle |
| `.tx-pages-text`, `.tx-pages-summary` | Text rows and toggle summaries (the editor surface inside) |
| `.tx-pages-slash`, `.tx-pages-slash__input`, `.tx-pages-slash__list`, `.tx-pages-slash__item`, `.tx-pages-slash__group`, `.tx-pages-slash__empty` | The slash menu |
| `.tx-pages-callout[data-tone]`, `.tx-pages-toggle`, `.tx-pages-quote`, `.tx-pages-divider` | Containers |
| `.tx-pages-columns`, `.tx-pages-column`, `.tx-pages-columns__separator`, `[data-resizing]` | Columns and their splitter |
| `.tx-pages-embed[data-kind][data-state]`, `.tx-pages-badge`, `.tx-pages-wrapped`, `.tx-pages-media` | Embeds (`loading`, `painted`, `refused`, `reference`), the trust badge, wrapped blocks, images |
| `.tx-pages-page-link`, `.tx-pages-breadcrumb`, `.tx-pages-outline` | Navigation |
| `.tx-pages-heading[data-level]`, `.tx-pages-pre`, `.tx-pages-list-view`, `.tx-pages-details` | Reader blocks |
| `.tx-pages-actions`, `.tx-pages-action` | The undo and redo buttons |
| `.tx-pages-row__body` | The block beside the gutter |
| `.tx-pages-callout__title`, `.tx-pages-toggle__summary`, `.tx-pages-toggle__button`, `.tx-pages-toggle__body` | Callout titles and toggle parts |
| `.tx-pages-embed__caption`, `.tx-pages-notice`, `.tx-pages-loading` | The embed caption, refusals and loading text |
| `.tx-pages-reader__body`, `.tx-pages-link`, `.tx-pages-code-inline` | The reader body, inline links and inline code |
| `.tx-pages-visually-hidden` | Text for assistive technology only |
