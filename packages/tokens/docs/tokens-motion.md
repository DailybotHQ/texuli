# Motion tokens

**Package:** `@texuli/tokens`
**Source:** `packages/tokens/src/motion/`
**Import:** `@texuli/tokens/motion` or the root barrel
**Tests:** `packages/tokens/tests/motion.test.ts`
**Decision:** [ADR-013](../../../docs/DECISIONS.md#adr-013-motion-runtime-web-animations-with-an-owned-spring-solver)

Five durations, five easings and three springs, as data and as `--tx-motion-*`
custom properties. The runtime that plays them is `@texuli/core/motion`
([core-motion.md](../../core/docs/core-motion.md)). The change to the theme
contract is additive: the existing `--tx-motion-fast`, `--tx-motion-base`,
`--tx-motion-slow` and `--tx-motion-easing` keep their values.

## Durations

| Step | Default | Custom property | Source |
| --- | --- | --- | --- |
| `instant` | 0 ms | `--tx-motion-instant` | always 0: a state change named as a step |
| `fast` | 150 ms | `--tx-motion-fast` | the theme (`style.motion.durations.fast`) |
| `base` | 200 ms | `--tx-motion-base` | the theme |
| `slow` | 300 ms | `--tx-motion-slow` | the theme |
| `slower` | 500 ms | `--tx-motion-slower` | `slowerDuration(slow)`: 5/3 of the theme's `slow`, at most 1,000 ms, never below `slow` |

`themeVariables` and `compileThemeCss` emit `--tx-motion-slower` with the
theme's other durations, so a theme with the `snappy` or `expressive` motion
preset gets a matching `slower` step. `--tx-motion-instant` is constant and
lives in `base.css`.

## Easings

| Name | Value | Custom property |
| --- | --- | --- |
| `standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | `--tx-motion-ease-standard` |
| `emphasized` | `cubic-bezier(0.2, 0, 0, 1)` | `--tx-motion-ease-emphasized` |
| `enter` | `cubic-bezier(0, 0, 0.2, 1)` | `--tx-motion-ease-enter` |
| `exit` | `cubic-bezier(0.4, 0, 1, 1)` | `--tx-motion-ease-exit` |
| `linear` | `linear` | `--tx-motion-ease-linear` |

`standard` is the theme contract's default easing (`--tx-motion-easing`).

## Springs

| Name | Stiffness | Damping | Mass | Damping ratio | Duration | Custom properties |
| --- | --- | --- | --- | --- | --- | --- |
| `gentle` | 120 | 20 | 1 | 0.91 | 648 ms | `--tx-motion-spring-gentle`, `--tx-motion-spring-gentle-duration` |
| `snappy` | 400 | 30 | 1 | 0.75 | 453 ms | `--tx-motion-spring-snappy`, `--tx-motion-spring-snappy-duration` |
| `bouncy` | 380 | 18 | 1 | 0.46 | 844 ms | `--tx-motion-spring-bouncy`, `--tx-motion-spring-bouncy-duration` |

Each spring's easing is a precomputed CSS `linear()` curve (32 evenly spaced
samples from the `@texuli/core/motion` solver), and the test recomputes the
strings with the solver so they cannot drift. Browsers without `linear()`
treat a property that uses it as invalid at computed-value time and fall back
to the initial easing (`ease`); `@texuli/core/motion` falls back to
`cubic-bezier(0.2, 0, 0, 1)` for springs instead.

```css
.card {
  transition: transform var(--tx-motion-spring-snappy-duration) var(--tx-motion-spring-snappy);
}
```

## Where the properties come from

- **`@texuli/tokens/base.css`** declares the theme-independent tokens on
  `:root`: `--tx-motion-instant`, a default `--tx-motion-slower`, the easings
  and the springs.
- **Themes** (`themeVariables`, `compileThemeCss`, `applyTheme`) set the
  duration steps that follow the theme: `fast`, `base`, `slow` and `slower`.
- **Reduced motion:** both reduced-motion rules in `base.css`
  (`@media (prefers-reduced-motion: reduce)` and `[data-tx-motion="reduce"]`)
  set every duration to `0ms` and every easing and spring to `linear`, and
  `themeVariables({ reducedMotion: true })` does the same for the theme's
  steps. `motionVariables({ reducedMotion: true })` returns the same values.

## API

| Export | Role |
| --- | --- |
| `MOTION_DURATION_STEPS` | `["instant", "fast", "base", "slow", "slower"]` |
| `MOTION_DURATIONS` | The default milliseconds per step |
| `type MotionDurationStep` | One step |
| `MOTION_EASING_NAMES` | `["standard", "emphasized", "enter", "exit", "linear"]` |
| `MOTION_EASINGS` | The easing values |
| `type MotionEasingName` | One easing name |
| `MOTION_SPRING_NAMES` | `["gentle", "snappy", "bouncy"]` |
| `MOTION_SPRINGS` | Each spring's `stiffness`, `damping`, `mass`, `durationMs` and `easing` |
| `type MotionSpringName` | One spring name |
| `type MotionSpringToken` | One spring's data |
| `MOTION_SPRING_SAMPLES` | 32 |
| `motionDurationVar(step)` | `--tx-motion-<step>` |
| `motionEasingVar(name)` | `--tx-motion-ease-<name>` |
| `motionSpringVars(name)` | `{ easing, duration }` property names |
| `slowerDuration(slow)` | The `slower` step for a theme's `slow` |
| `motionVariables(input)` | Every motion property for the given theme durations, or reduced |
| `type MotionVariablesInput` | `{ durations?, reducedMotion? }` |
| `MOTION_VARIABLE_NAMES` | Every motion property name |

The spring data (stiffness, damping, mass) is what the native Compose twin
will map to its spring specs (PLAN_010 T-motion-spec, planned).
