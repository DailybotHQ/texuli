# Spec motion: the closed motion vocabulary (spec 0.6.0)

**Package:** `@texuli/spec`
**Subpath:** `@texuli/spec/motion`
**Source:** `packages/spec/src/motion.ts`, `schemas/blueprint.schema.json`
(`$defs.nodeMotion`, `$defs.envelopeMotion` and the four enums)
**Tests:** `packages/spec/tests/motion.test.ts`, the four
`fixtures/invalid/motion-*.json` fixtures and the motion in
`fixtures/golden/app-dashboard.json`
**Decisions:** [ADR-012](../../../docs/DECISIONS.md#adr-012-spec-evolution-one-additive-minor-per-release-wave),
[ADR-013](../../../docs/DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)

> **Status: released in `@texuli/spec@0.6.0`.** Spec `0.6.0` is pinned for
> release 0.6.0 (ADR-012); a later normative change takes a new spec
> version. `@texuli/spec@0.5.0` carries spec `0.5.0`, without motion.

Agents declare motion as data: named presets and token steps. A blueprint
never carries CSS, keyframes, easing curves, durations in milliseconds or
code, and anything outside the vocabulary is refused.

## The vocabulary

A node may carry `motion`:

```json
{
  "id": "layout-card",
  "props": { "title": "Pipeline" },
  "motion": { "enter": "rise", "exit": "fade", "layout": true, "stagger": "fast", "duration": "base" },
  "children": []
}
```

| Field | Values | Meaning |
| --- | --- | --- |
| `enter` | `fade`, `rise`, `scale`, `slide-start`, `slide-end` | How the node appears: a fade, a fade in from the block end, a fade growing from 96%, or a fade in from the inline start or end (mirrored right to left) |
| `exit` | the same presets | How it leaves (the enter reversed) |
| `layout` | `true`, `false` | Animate a change of its position or size among its siblings (FLIP) |
| `stagger` | `none`, `fast`, `base` | The offset between its entering children (a fifth of the duration token: 30 ms and 40 ms); the whole spread is held to 1,000 ms |
| `duration` | `fast`, `base`, `slow` | The duration token step (default `base`): the theme's `--tx-motion-fast`, `--tx-motion-base` and `--tx-motion-slow` (150, 200 and 300 ms by default) |

The envelope may carry `motion: { "level": "full" | "subtle" | "none" }`,
the level every node motion plays at: `subtle` shortens durations and keeps
only the fade, `none` paints at once. A host's level wins over it, and the
reader's reduced-motion preference makes everything instant.

Put `motion` before `children` (and the envelope `motion` before `tree`):
streamed nodes keep `children` last ([stream.md](stream.md)).

## Exports

| Export | Role |
| --- | --- |
| `SPEC_MOTION_PRESETS` | `['fade', 'rise', 'scale', 'slide-start', 'slide-end']` (`$defs.motionPreset`) |
| `SPEC_MOTION_DURATIONS` | `['fast', 'base', 'slow']` (`$defs.motionDuration`) |
| `SPEC_MOTION_STAGGERS` | `['none', 'fast', 'base']` (`$defs.motionStagger`) |
| `SPEC_MOTION_LEVELS` | `['full', 'subtle', 'none']` (`$defs.motionLevel`) |
| `SPEC_NODE_MOTION_FIELDS` | The fields of a node `motion` |
| `checkNodeMotion(value)` | `{ ok: true, motion }` (a frozen copy) or `{ ok: false, path, message }`, the first refusal |
| `checkEnvelopeMotion(value)` | The same for the envelope `motion` |
| `type BlueprintNodeMotion`, `BlueprintEnvelopeMotion`, `BlueprintMotionPreset`, `BlueprintMotionDuration`, `BlueprintMotionStagger`, `BlueprintMotionLevel` | The generated types |

The module has no runtime imports. `tests/spec.test.ts` and
`tests/motion.test.ts` keep the constants equal to the schema.

## Who checks what

- **`validateBlueprint`** refuses any value outside the vocabulary with a
  `schema` diagnostic (closed enums, `additionalProperties: false`).
- **`@texuli/catalog`** runs `checkNodeMotion` in its renderer: a refused
  motion is an `invalid-motion` error and the node paints without motion;
  the envelope `motion` is checked by `parseEnvelope` (`invalid-motion`).
- **`@texuli/player`** plays only the checked copy, through
  `@texuli/core/motion` (see the player reference).
- **The Kotlin twin** decodes it with the generated closed decoders (a
  refusal is `schema`, the same codes as TypeScript in the invalid fixture
  parity test) and maps it to Compose transitions.

Refusal messages never echo a long value, and the check is linear and stops
at the first unknown key.

## Migration

`0.5.0 → 0.6.0` (`src/migrations/0.5.0-0.6.0.ts`) is additive: every
0.5.0 envelope is a valid 0.6.0 envelope, so the step only stamps `spec`.
