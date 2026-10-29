# Core motion: Web Animations with an owned spring solver

**Package:** `@texuli/core`
**Subpaths:** `@texuli/core/motion` (everything below) and
`@texuli/core/motion/spring` (the solver alone)
**Source:** `packages/core/src/motion/`
**Tests:** `packages/core/tests/motion.test.ts`,
`packages/core/tests/motion-layout.test.ts`,
`packages/core/tests/motion-spring.test.ts`
**Decision:** [ADR-013](../../../docs/DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)

## Contract

- **Framework-free.** Texels take elements explicitly; nothing touches
  `window` or `document` at import time, and nothing runs on the server.
- **Not in the root barrel.** `@texuli/core` does not re-export motion, so a
  component that does not animate pays nothing for it.
- **The browser interpolates.** Every texel plays through the Web Animations
  API (`element.animate`). No `requestAnimationFrame` loop writes styles.
- **No lasting inline style.** Animations use `fill: "none"` (`"backwards"`
  only while a delay holds the first frame). The final state belongs in
  classes, attributes or props; motion presence writes `data-state`.
- **Reduced motion is instant by construction.** Under
  `prefers-reduced-motion: reduce` (or a host override), at level `none`,
  without the Web Animations API, on a detached element, on the server, or
  with a zero duration, every texel commits the end state at once: no frames
  run, `onFinish` fires synchronously and `finished` resolves `"instant"`. The
  only exception is opt-in: `reducedMotionPolicy: "fade"` keeps an
  opacity-only `REDUCED_FADE_MS` (150 ms) fade, the deck stage's slide fade.
- **No animation on hydration.** Motion presence does not play its enter
  animation for a node that is present on first attach unless `appear` is set.
- **Hostile input is clamped.** Durations and delays are at most
  `MAX_MOTION_MS` (1,000 ms); NaN and negative values are 0. Spring
  parameters, velocities and sample counts have fixed ranges, the settle
  search evaluates at most 1,001 points, FLIP deltas are held to ±100,000 px,
  and the list and timeline sizes have caps (past them the change commits at
  once with the reason `"limit"`).
- **Promises never reject.** Every `finished` resolves once with a
  `MotionOutcome`: `"finished"`, `"instant"`, `"cancelled"` or
  `"interrupted"`.

## Motion levels and reduced motion

| Export | Role |
| --- | --- |
| `MOTION_LEVELS` | `["full", "subtle", "none"]`, the deck's vocabulary |
| `type MotionLevel` | One of the levels |
| `isMotionLevel(value)` | Type guard |
| `lowerMotionLevel(a, b)` | The lower of two levels (`none` < `subtle` < `full`) |
| `resolveMotionLevel(input)` | Host, then blueprint or deck (`document`), then `component`, then `full`; `viewer` and `reducedMotion` only lower it (reduced motion gives `none`) |
| `type MotionLevelInput` | `{ host?, document?, component?, viewer?, reducedMotion? }` |
| `motionDuration(ms, level)` | Clamp to [0, `MAX_MOTION_MS`] and scale: `subtle` × `SUBTLE_DURATION_SCALE` (0.6), `none` → 0 |
| `SUBTLE_DURATION_SCALE` | 0.6 (the deck's value) |
| `MAX_MOTION_MS` | 1,000 |
| `REDUCED_FADE_MS` | 150 |
| `type ReducedMotionPolicy` | `"instant"` (default) or `"fade"` |
| `createReducedMotionSource(options)` | A live `prefers-reduced-motion` view: `get`, `subscribe`, `setOverride(boolean \| null)`, `dispose`; follows `change` events (and the legacy `addListener`) |
| `type ReducedMotionSource` | The source's shape |
| `type ReducedMotionSourceOptions` | `{ window?, override?, ssrDefault? }` |

At `subtle`, movement and scale are dropped (`transform`, `translate`,
`scale`, `rotate`, `transformOrigin`, `offsetDistance`): an animation that
only moves commits at once, one that also fades keeps the fade.

## Animate

| Export | Role |
| --- | --- |
| `animate(element, keyframes, options)` | Play one animation; returns a `MotionRun` |
| `type AnimateOptions` | `MotionTiming` plus `onFinish(outcome)` |
| `type MotionTiming` | `duration`, `delay`, `easing`, `spring`, `level`, `reducedMotion`, `reducedMotionPolicy` |
| `type MotionRun` | `finished`, `animations`, `instantReason`, `cancel()`, `finish()` |
| `type MotionOutcome` | `"finished"`, `"instant"`, `"cancelled"`, `"interrupted"` |
| `type InstantReason` | `"server"`, `"detached"`, `"level-none"`, `"reduced-motion"`, `"no-properties"`, `"zero-duration"`, `"no-waapi"`, `"error"`, `"limit"` |
| `type MotionKeyframes` | Keyframe arrays or property-indexed keyframes |
| `type ReducedMotionInput` | `boolean`, a `ReducedMotionSource`, or omitted (read the element's window) |
| `DEFAULT_MOTION_DURATION` | 200 (the `base` token) |
| `DEFAULT_MOTION_EASING` | `cubic-bezier(0.4, 0, 0.2, 1)` (the `standard` token) |
| `resolveMotion(element, keyframes, timing)` | The clamped plan, or `{ instant: true, reason }`, without starting anything |
| `type ResolvedMotion` | That plan |
| `startAnimation(element, plan, extra?)` | Start a resolved plan (`null` if the browser refuses it) |
| `createRun(animations, onFinish?, reason?)` | Settle animations as one `MotionRun` (for texels built on this one) |
| `withoutTravel(keyframes)` | Keyframes without movement or scale, or `null` |

With `spring`, the duration is the spring's settle time and the easing its
`linear()` curve (or `cubic-bezier(0.2, 0, 0, 1)` where `linear()` is not
supported).

```ts
import { animate } from '@texuli/core/motion';

const run = animate(card, [{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
await run.finished; // "finished", or "instant" under reduced motion
```

## Presence

| Export | Role |
| --- | --- |
| `createMotionPresence(options)` | Enter and exit with interruptible reversal |
| `type MotionPresence` | `getSnapshot`, `setPresent(present)` → `Promise<MotionOutcome>`, `setNode`, `finished`, `dispose` |
| `type MotionPresenceOptions` | `present`, `appear`, `forceMount`, `enter`, `exit`, `exitTiming`, the timing, and `onSnapshot`, `onEnter`, `onEnterComplete`, `onExitComplete` |

It speaks the `@texuli/core/presence` vocabulary (`PresenceSnapshot`,
`data-state="open" | "closed"`) but drives it from its own animations: Web
Animations fire no `transitionend` or `animationend`, and an unrelated CSS
transition on the node must not end the exit early. The exit keyframes
default to the enter keyframes reversed. Toggling while an animation runs
calls `Animation.reverse()`, so it turns around from where it is; the earlier
transition resolves `"interrupted"`. If the node goes away mid-exit the exit
completes; `dispose()` cancels and resolves `"cancelled"`.

```ts
import { createMotionPresence } from '@texuli/core/motion';

const presence = createMotionPresence({
  enter: [{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }],
  onExitComplete: (snapshot) => {
    if (!snapshot.mounted) unmount();
  },
});
presence.setPresent(true); // mount the node, then:
presence.setNode(panel);   // the enter animation plays
```

## FLIP layout animation

| Export | Role |
| --- | --- |
| `createFlip(options)` | `measure(items)`, then change the DOM, then `play(items)` → `MotionRun`; `cancel()` |
| `type FlipController` | That controller |
| `type FlipItems` | `Iterable<[key, element]>` (a `Map` works) |
| `type FlipOptions` | The timing, `scale` (default `true`), `enter`, `enterDistance` (default 8 px, at most 64), `maxItems` (default 500), `onFinish` |
| `type FlipEnter` | `false`, `"fade"`, `"inline-start"`, `"inline-end"`, `"block-start"`, `"block-end"`, or keyframes |
| `flipTransform(first, last, scale?)` | The inverted transform between two boxes, or `null` when nothing moved |

`measure` and `play` read every box before they cancel or start any
animation, so a list lays out once per phase. Measuring during a play reads
the in-flight positions and interrupts the old run, so a second reorder
continues from where the items are on screen. Deltas are physical pixels, so
reorders are right in either direction; logical insert sides follow the
element's `direction` (`inline-start` comes from the right in right-to-left).
Removed items are not animated here: keep them with motion presence until
their exit ends. FLIP replaces the element's own `transform` while it runs.

## Shared elements

| Export | Role |
| --- | --- |
| `createSharedElements(options)` | `capture(key, element)`, `play(key, element)` → `MotionRun`, `has`, `release`, `clear`, `size` |
| `type SharedElements` | That registry |
| `type SharedElementsOptions` | The timing, `maxEntries` (default 256, oldest dropped), `onFinish` |
| `startScopedViewTransition(scope, update, options)` | Run `update` in an element-scoped View Transition when `scope.startViewTransition` exists; otherwise apply it at once (`"instant"`) |
| `type ScopedViewTransitionOptions` | `{ level?, reducedMotion? }` |

`play` moves and scales the new element from the captured box. When the old
element is still on the page the two cross-fade, the old one traveling onto
the new box. Document-wide View Transitions are not used: they would capture
the whole page.

## Sequences and timelines

| Export | Role |
| --- | --- |
| `timeline(entries, options)` | Paused until `play()`; `play`, `pause`, `seek(ms)`, `reverse`, `cancel`, `finish`, `duration`, `finished` |
| `sequence(entries, options)` | The same, playing at once |
| `parallel(...steps)` | A group whose steps run together |
| `stagger(count, each, options)` | Offsets for `at`, from `"start"`, `"end"`, `"center"` or an index; the spread is held to `MAX_STAGGER_SPAN` |
| `type Timeline` | The controller |
| `type TimelineEntry` | A `TimelineStep` or a `ParallelGroup` |
| `type TimelineStep` | `{ target, keyframes, duration?, easing?, at? }` |
| `type ParallelGroup` | `{ parallel: TimelineStep[] }` |
| `type TimelineOptions` | The timing, `autoplay`, `onFinish` |
| `type StaggerOptions` | `{ from? }` |
| `MAX_TIMELINE_STEPS` | 500 |
| `MAX_STAGGER_SPAN` | 1,000 ms |

Every step's animation gets the same total length (`delay` + `duration` +
`endDelay`), so `seek`, `pause` and `reverse` keep the steps aligned on one
clock. At `subtle`, offsets shrink with the durations.

```ts
import { parallel, sequence, stagger } from '@texuli/core/motion';

const offsets = stagger(cards.length, 40);
sequence([
  { target: header, keyframes: [{ opacity: 0 }, { opacity: 1 }], duration: 150 },
  parallel(...cards.map((target, i) => ({ target, keyframes: rise, at: offsets[i] }))),
]);
```

## Spring solver

Also published alone as `@texuli/core/motion/spring` (pure, no DOM).

| Export | Role |
| --- | --- |
| `type SpringParams` | `{ stiffness, damping, mass }` |
| `type SpringSolveOptions` | `{ velocity?, restDelta?, restSpeed? }` |
| `type SpringState` | `{ position, velocity }` |
| `type SpringSettle` | `{ durationMs, settled }` |
| `type SpringSamples` | The settle plus evenly spaced `points` |
| `DEFAULT_SPRING` | `{ stiffness: 170, damping: 26, mass: 1 }` |
| `MAX_SPRING_MS` | 1,000 |
| `DEFAULT_SPRING_SAMPLES` | 40 |
| `MAX_SPRING_SAMPLES` | 120 |
| `normalizeSpring(params)` | Clamp: stiffness [1, 10000], damping [0, 1000], mass [0.01, 1000]; NaN takes the default |
| `dampingRatio(params)` | ζ = c / (2√(k·m)) |
| `springState(params, ms, options)` | Position and velocity at a time (closed form for under, critical and over damping) |
| `springSettle(params, options)` | When it comes to rest (at most `MAX_SPRING_MS`; `settled: false` if it was still moving) |
| `springSamples(params, options)` | Evenly spaced positions, first 0 and last pinned to 1 |
| `springEasing(params, options)` | A CSS `linear()` easing and its duration |
| `springKeyframes(params, build, options)` | Keyframes for any property via `build(progress)` |
| `retargetVelocity(velocity, oldSpan, newSpan)` | Carry velocity into a retargeted spring |

Progress runs from 0 to 1 and may overshoot. Velocity is in progress units
per second. The spring tokens in `@texuli/tokens/motion` are precomputed with
`springEasing` (32 samples), and a tokens test recomputes them.

## Size

`pnpm size --filter core` (2026-10-28): `@texuli/core/motion` measures
6,594 B gzip (budget 6,858 B) and `@texuli/core/motion/spring` 1,299 B
(budget 1,351 B). The core root barrel does not change.

## Not covered yet

- Styled components use these texels through `texuli/motion` (the motion prop contract and `MotionProvider`, see `packages/texuli/docs/ui-motion.md`); the player plays blueprint node motion and the slides stage plays deck transitions through them. Collapsible, NavigationMenu, Select, Combobox and CommandPalette are not wired yet (planned).
- The spec's closed motion vocabulary for agents is planned (T-motion-spec).
- Real-browser checks run through the adopting components' behavior suites;
  the unit tests here use a controllable Web Animations stand-in.
