# Animation timeline

**Package:** `@texuli/media`  
**Import:** `@texuli/media/timeline` (the `AnimationTimeline` component and the
model) · `@texuli/media/timeline/model` (the framework-free model; also
re-exported from `@texuli/media`)  
**Source:** `packages/media/src/timeline/`  
**Tests:** `packages/media/tests/timeline.test.ts`

An editor surface for animations over a [composition v2](composition-v2.md):
one row per layer and group, with the layer's time window and its keyframes,
a playhead, an optional live preview, and undo/redo. Every edit goes through a
framework-free model that keeps the document valid.

```svelte
<script lang="ts">
  import { AnimationTimeline, type TimelineDocument } from '@texuli/media/timeline';

  let document: TimelineDocument | undefined = $state();
</script>

<AnimationTimeline
  composition={compositionJson}
  animation={animationJson}
  bind:value={document}
  onchange={(next) => save(next.composition, next.animation)}
/>
```

## The model

A `TimelineDocument` pairs a `composition` (v2) with its `animation`. Load
both with `validateCompositionV2` and `validateAnimationV2`; the component
does this itself.

`applyTimelineAction(document, action)` returns a `TimelineEditResult`: the
new document, or the issues that refused the edit. It never mutates its input.
The `TimelineAction` types are:

| Action | Effect |
| --- | --- |
| `set-window` | Set a layer's or group's `timing` (`startMs`, optional `endMs`); an end at the composition's end is stored as the default |
| `clear-window` | Remove `timing`: the layer shows for the whole timeline |
| `add-keyframe` | Add a keyframe at `timeMs` with optional `values` (`KeyframeValues`; `opacity: 1` by default), creating the track if needed |
| `move-keyframe` | Move keyframe `index` to `timeMs`; the track is re-sorted |
| `update-keyframe` | Merge `values` into keyframe `index` |
| `set-easing` | Set the easing into keyframe `index` |
| `remove-keyframe` | Remove keyframe `index`; a track that becomes empty is dropped |

Every accepted result stays valid:

- **Windows:** whole milliseconds inside the timeline, `endMs` after
  `startMs`, and a window that still overlaps its group's window
  (`TIMELINE_LIMITS.minWindowMs`). A composition without `durationMs` cannot
  take windows.
- **Keyframes:** whole milliseconds within the animation's duration, unique
  per track. The edited animation passes `validateAnimationV2`, so value
  ranges, track limits (64 keyframes) and the group-track rule (only opacity
  and the offset) all hold. An animation keeps at least one keyframe.

A seeded test applies 400 random edits and checks that every accepted
document passes both full validators.

`timelineRows(document)` returns the `TimelineRow` view model, in paint order:
`layerId`, `kind`, nesting `depth`, a short `label` (a text layer's text, an
image's alt, else the id), the layer's own `window`, its `effective` window
after its groups, and its keyframe times. `timelineDuration(document)` is the
longer of the animation and composition durations. `snapTime(time, step,
duration)` rounds to a step inside the timeline.

### History

`createTimelineHistory(document)` and `timelineHistoryReducer(history,
action)` provide undo and redo. A `TimelineHistory` holds `past`, `present`,
`future` and the last refusal's `errors`; a `TimelineHistoryAction` is
`apply`, `undo`, `redo` or `replace`. A refused action leaves `present` as it
was and records its issues. Consecutive moves of the same keyframe, window
edits of the same layer, and same-field updates merge into one undo step, as
in the image editor. History keeps at most `TIMELINE_LIMITS.maxHistory` (100)
steps.

## The component

`AnimationTimeline` validates its `composition` and `animation` props (at
`trust`, `untrusted` by default) and shows the issues instead when they fail.
The entry is small; the editor UI and the preview renderer load as separate
chunks when it mounts.

| Prop | Default | What it does |
| --- | --- | --- |
| `composition`, `animation` | required | The documents to edit; a new value restarts the history |
| `trust` | `untrusted` | URL policy tier for validation and preview |
| `value` | — | Bindable: the edited `TimelineDocument` |
| `onchange` | — | Called with each accepted document |
| `timeMs` | `0` | Bindable playhead |
| `stepMs` | `100` | Keyboard and drag step; Shift moves ten steps |
| `preview` | `true` | Render the frame at the playhead (`sampleCompositionV2` through `CompositionSvg`) |
| `title` | `labels.title` | The region's name |
| `labels` | English defaults | Any subset of `TimelineLabels`; see Labels below |

Structure and keyboard:

- **Region:** the editor is a named region. A “Timeline controls” group holds
  Undo, Redo and a “Playhead” slider with a seconds value text.
- **Table:** a table captioned “Layers, windows and keyframes”, with one row
  header per layer, indented by group depth. Each row has “Start of …” and
  “End of …” sliders for its window, a Clear button when the layer has its own
  window, its keyframe buttons, and “Add a keyframe … at <playhead>”.
- **Keyframe buttons:** each is named with its position, layer and time.
  Left/Right moves it by the step (reversed in right-to-left layouts), Shift
  moves ten steps, and Delete or Backspace removes it. Clicking selects it and
  moves the playhead there. Pointer dragging moves it along the track, snapped
  to the step.
- **Inspector:** the selected keyframe's easing and opacity.
- **Undo and redo:** Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes.
  The Undo and Redo buttons carry these shortcuts in `aria-keyshortcuts`.
- **Opacity field:** clearing it is not an edit; the field shows the current
  value again.
- **Announcements:** a polite status line announces each edit, or why it was
  not applied.

Styles use the `--tx-*` tokens and logical properties, with a forced-colors
mapping. Focus rings use `--tx-focus-ring-width` and `--tx-focus-ring-offset`.
The keyframe diamond is 1rem, and its pointer target extends to 1.5rem (24px).

## Labels

Every visible and announced string is a `TimelineLabels` entry (the type is
exported from `@texuli/media/timeline`). Pass any subset as `labels`; the rest
keep their English defaults. Placeholders such as `{layer}` and `{time}` are
filled as plain text, and `seconds` (`{value} s`) formats every time shown.
Layer names and the model's refusal messages come from the document and the
model, not from labels.

## Not covered yet

- Pointer dragging has no automated test: the component tests run in
  happy-dom, which has no layout.
- There is no example in the examples registry, and no visual baseline.
- The inspector edits only easing and opacity; other keyframe values go
  through `update-keyframe`.
- Playback in the editor is scrub-only; the editor does not play the
  animation.
- Changing the animation's or composition's duration, reordering or
  regrouping layers, and multi-select edits are not implemented.
