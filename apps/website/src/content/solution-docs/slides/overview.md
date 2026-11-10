## What Slides is

Slides is a complete present-a-deck system: `@texuli/deck` holds the framework-free model v2, JSON and Markdown codecs, navigation engine and templates; `@texuli/slides` is the Svelte 5 stage on top of it (layouts, presenter, print and PPTX). Both packages are published as `0.16.0` and are **in development** (pre-1.0). Pin the exact version or use `^0.16.0`.

The live demo on this site is on the Slides landing, `/solutions/slides/`. The technical docs you are reading live at `/guides/solutions/slides/`.

## What you get

- A validated deck as data (`formatVersion: 2`), not HTML.
- JSON or Markdown in, the same model out.
- A stage that scales a fixed canvas, follows `#/<slide>/<step>`, and takes keyboard and touch.
- 21 layouts, 13 background presets with a 4.5:1 text scrim, fragments, presenter view, print-to-PDF and local PPTX.

There is no hosted editor and no deck storage. The host app keeps the data.
