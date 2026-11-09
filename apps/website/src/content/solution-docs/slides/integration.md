## Stage

`DeckStage` from `@texuli/slides/stage` is the Svelte 5 presenter. Import `@texuli/slides/styles.css` once. Hosts that bring every renderer use `DeckStageCore` from `@texuli/slides/stage-core` so the build emits none of the default chunks.

The canvas is 1280 × 720 for 16:9 (also 4:3, 9:16 and 1:1) and scales into the host. Hash routes are `#/<slide>/<step>`. Only one stage on a page owns the hash.

## Layouts

Twenty-one layouts ship in `@texuli/slides/layouts`: title hero, section divider, splits, cards, media, quote, code, big stat, table, process, timeline, team, closing call to action, chart, and free blocks. Backgrounds are 13 presets, hex, gradients, image or video, with a scrim that keeps slide text at 4.5:1.

Any slide-renderable catalog component can sit on a slide, loaded lazily, at the host's trust tier (`@texuli/slides/components`).

## Print and PPTX

`@texuli/slides/export` prints one page per visible slide (the browser saves PDF) and writes a local, deterministic PPTX: text and tables as editable PowerPoint, images and charts as pictures the host supplies, plus a report of what it leaves out. There is no server-side PDF renderer.
