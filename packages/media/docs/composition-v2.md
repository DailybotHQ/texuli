# Composition v2: groups and layer timing

**Package:** `@texuli/media`  
**Import:** `@texuli/media/composition-v2` (also re-exported from `@texuli/media`)  
**Source:** `packages/media/src/composition-v2/`  
**Tests:** `packages/media/tests/composition-v2.test.ts`, golden compositions in
`packages/media/tests/golden/composition-v2/`, and the v2 cases in
`packages/media/tests/export.test.ts`

Composition v2 adds two things to the v1 model
([composition-model](../src/composition-model/types.ts)):

- **Groups.** A `group` layer holds `children` (leaves or groups, nested up to
  8 levels). It moves its children by `offset`, multiplies their `opacity`,
  and gates them with its own `timing`.
- **Layer timing.** Any layer or group may carry `timing: { startMs, endMs? }`:
  it is on screen from `startMs` up to `endMs`, which defaults to the
  composition's `durationMs`. Timing needs a `durationMs` on the composition.

v2 is additive. v1 documents, validators and renderers are unchanged. The v2
engine resolves any instant to a flat, valid v1 scene, so the SVG renderer,
the canvas renderer and the WebM exporter draw v2 without knowing about it.

```ts
import {
  resolveCompositionAt,
  sampleCompositionV2,
  validateAnimationV2,
  validateCompositionV2,
} from '@texuli/media/composition-v2';
import { renderCompositionSvg } from '@texuli/media/composition-svg';

const checked = validateCompositionV2(untrustedJson); // trust: 'untrusted' by default
if (checked.ok) {
  const frame = resolveCompositionAt(checked.composition, 2_300); // a v1 Composition
  const svg = renderCompositionSvg(frame);
}
```

## Validation

`validateCompositionV2(input, options)` returns a `CompositionV2Validation`:
`{ ok: true, composition }` with a fresh `CompositionV2`, or
`{ ok: false, errors }` with v1-style issues (`path`, `code`, `message`).
It never throws.

- **Leaves** are parsed by the same code as v1 layers, so a shape, text or
  image leaf (`CompositionLeafV2`) is checked exactly like a v1 layer,
  including the image URL policy at the requested `trust`. The only extra key
  allowed on a leaf is `timing`.
- **Groups** (`GroupLayer`) accept only `id`, `type`, `children`, `offset`,
  `opacity` and `timing`. They take no transform, blend mode or mask, so
  every resolved frame can stay a flat v1 scene. A group needs at least one
  child.
- **Timing** (`LayerTiming`): whole milliseconds, with `startMs` before the
  end of the composition, `endMs` after `startMs`, and `endMs` at most
  `durationMs`. A layer whose window never overlaps its group's window is an
  error.
- **Ids** are unique across every level. Masks reference leaves only; a mask
  pointing at a group is a `missing-mask` error. Mask cycles fail as in v1.
- **Limits** (`COMPOSITION_V2_LIMITS`): at most 256 layers and groups in
  total, at most 8 nesting levels, plus every v1 limit, including the
  serialized size.
- A `version: 1` document is validated by the unchanged v1 validator (so it
  may not use groups or timing) and returned upgraded.
  `upgradeComposition(v1)` does the same for an already-validated v1
  composition.

Errors point at tree paths such as `layers[2].children[1].src`. The golden
set pins the outcome of each hostile input: missing duration, inverted or
overlong windows, windows outside their group, duplicate ids across groups,
empty groups, group transforms and masks, masks on groups, unsafe nested
images, v1 documents with timing, unknown versions, and `__proto__` keys.

## Resolving a frame

`resolveCompositionAt(composition, timeMs, groups?)` returns the flat v1
`Composition` on screen at `timeMs`:

- The time is clamped to `[0, durationMs]`; a non-finite time reads as 0.
- Windows are half-open, except that a window reaching the end of the
  composition includes its final instant, so the last frame shows what was on
  screen just before it.
- A layer outside its window, or inside a group that is off screen, is left
  out. Group offsets add up into each leaf's frame, and group opacities
  multiply into the leaf's opacity. Frames are clamped to the v1 bounds
  (±32,768), which only affects layers far off canvas.
- A leaf whose mask layer is off screen is hidden; with an inverted mask it
  shows unmasked instead. Hiding cascades down mask chains.
- The optional `groups` map (`GroupState`: `opacity`, `offsetX`, `offsetY`)
  overrides group values, which is how animation drives groups.

Static compositions (no `durationMs`) resolve every layer at any time.

`resolveLayerWindows(composition)` lists each leaf's effective window
(`LayerWindow`: `layerId`, `startMs`, `endMs`) after its groups' windows, in
paint order. `compositionLeaves(composition)` returns every leaf as one static
v1 composition, which is what an exporter preloads (image sources) and
reports (provenance) for the whole timeline.

## Animation

v2 uses v1 animation documents ([animation](animation.md)):

- `validateAnimationV2(animation, composition)` checks leaf tracks exactly as
  v1 checks tracks against their layer. A track that targets a group may set
  only `opacity`, `translateX` and `translateY` (the group offset); any other
  field fails at its keyframe path. Every track must name an existing layer
  or group.
- `sampleCompositionV2(composition, animation, timeMs, options)` returns the
  animated flat v1 frame. Group tracks set group opacity and offset, layer
  windows decide what is on screen, and leaf tracks animate the leaves, all on
  one clock: the animation's time, looping when `loop` is set. Under
  `reducedMotion`, everything, timing included, freezes at `stillTimeMs`
  (default 0), as in v1.

## Rendering and export

Render any frame with the v1 renderers: pass `resolveCompositionAt(...)` or
`sampleCompositionV2(...)` to `renderCompositionSvg` or `CompositionSvg`
(`@texuli/media/composition-svg`), `CompositionCanvas`
(`@texuli/media/composition-canvas`), or `drawComposition`
(`@texuli/media/composition-canvas/draw`). `exportWebm` accepts a v2
composition directly. It validates both documents with the v2 validators,
preloads every leaf's image once, draws each frame from
`sampleCompositionV2`, and reports provenance for every image leaf.

Not implemented yet: v2-aware SVG/PNG export helpers (export a resolved frame
instead), a v2 player component (`CompositionAnimationPlayer` plays v1),
group rotation and scale, group masks and blend modes, and catalog manifests
for v2 compositions.
