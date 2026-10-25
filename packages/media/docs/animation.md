# Composition keyframe animation

**Package:** `@texuli/media`  
**Import:** `import { sampleComposition, validateAnimation, createTimeline } from '@texuli/media/animation'`  
`import { CompositionAnimationPlayer } from '@texuli/media/animation/player'`  
**Tests:** `packages/media/tests/animation.test.ts`  
**Example:** `media-animation`

## Contract

- Animation documents are versioned JSON (`version: 1`) with `durationMs` and
  `tracks[]` of layer keyframes (opacity + numeric transforms only).
- `validateAnimation` rejects unknown fields, bad easing names, unsorted times,
  missing layer ids (when a composition is supplied), and oversize documents.
- `sampleComposition` interpolates with named easings (`linear`, `ease-in`,
  `ease-out`, `ease-in-out`).
- **Reduced motion:** sampling and the player freeze at a still frame (`stillTimeMs`,
  default 0); play is disabled.
- Timeline scrubber is a real range input + Play/Pause buttons (keyboard operable).
- Renders through `CompositionSvg` (text stays text; sources already validated
  on the composition).

## API

| Export | Role |
| --- | --- |
| `validateAnimation` | Fail-closed validation |
| `sampleComposition` | Composition snapshot at `timeMs` |
| `createTimeline` | Play / pause / seek controller |
| `CompositionAnimationPlayer` | Svelte UI with scrubber |
| `applyEasing` / `lerp` | Pure math helpers |
