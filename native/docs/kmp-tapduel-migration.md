# KMPTapDuelGame migration validation

KMPTapDuelGame is the sixth and last KMP test-bench app. It is a separate
developer project, not part of this repository, and this lane did not change
it. This document records how its one game screen maps onto the native
Compose surface today. The check that holds it is
`conformance/src/jvmTest/kotlin/com/texuli/conformance/KmpTapDuelMigrationTest.kt`,
with two fictional, static blueprints:
- `conformance/fixtures/kmp-tapduel.json`: a finished match as a scoreboard;
- `conformance/fixtures/kmp-tapduel-arena.json`: the two tap zones as the catalog would name them.

## The app's screen

`TapDuelScreen.kt` is one screen:
- a header with the title ("Tap Duel"), the subtitle and a **Reset** text button while a match runs;
- the arena: two full-bleed player zones (side by side at 600 dp and wider, stacked below that). Each zone shows its label, its tap count and "taps". A pointer-down handler counts a tap, and the zones expose `Role.Button` with a description;
- a divider between the zones, animated over 80 ms, whose position comes from the tap difference;
- dashed goal markers drawn on a `Canvas`;
- three overlays: **Ready** (prompt and **Start**), a 3-2-1-GO countdown, and **Winner** (badge, "Player 1 wins!", the two final counts, **Reset** and **Play again**).

The game states are Ready, CountingDown, Playing and Finished. The app has
no haptics or sound. It pins Kotlin 2.3.20 and Compose Multiplatform 1.10.3,
the same as `native/`.

## Mapping

| App widget | Blueprint form | Native today |
| --- | --- | --- |
| Header (title, subtitle) | `layout-page` with `title` and `description` | Painted (`IMPLEMENTED`) |
| Tap counts (snapshot) | `blocks-data`, type `stat`, one item per player (`"34 taps"`) | Painted |
| Divider position (snapshot) | `charts-progress-ring`, Player 1's territory as `value` of `max` 100 | Painted |
| Winner overlay text | `blocks-text`, type `callout` | Painted |
| Player tap zones | `button` in a `layout-grid` | Loads as a `tier-denied` placeholder: `button` has an empty `emit` list |
| Start, Reset, Play again | `button` | Same: `tier-denied`; stays app code |
| Animated divider, goal markers (`Canvas`) | None (`media-composition-canvas` exists in the catalog but has no native painter) | Stays app code |
| Countdown, game states, tap handling | None: a blueprint is a static snapshot | Stays app code |

Under the **portable** profile the scoreboard is refused outright: each of its
four ids (`layout-page`, `blocks-data`, `charts-progress-ring`, `blocks-text`)
gets `unsupported-profile`, because no catalog id is portable core yet.

## Gaps

- **The game is not a blueprint.** Tap targets, the countdown, the animated
  divider and the overlays are live, interactive state. Blueprints carry
  static display content, and buttons are never emittable, so the whole game
  loop stays Compose code. Only a snapshot (scores, territory, the result)
  migrates.
- **No canvas painter.** The goal markers would need a native
  `media-composition-canvas` painter. Not built.
- **Portable core is empty.** The scoreboard paints natively under the web
  profile, but none of its ids has passed the audit for the portable profile.
- **Images, tables and lists** do not appear on this screen, so this check
  does not exercise them.

When a status changes, `KmpTapDuelMigrationTest` fails until the expected
outcome and this table are updated together.

## Running it

From the lane root, with JDK 21 and caches isolated under the lane's own
`tmp/` (see the [native README](../README.md#building)):

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
  GRADLE_USER_HOME="$PWD/tmp/gradle-home" \
  KONAN_DATA_DIR="$PWD/tmp/gradle-home/konan" \
  ./native/gradlew -p native :conformance:jvmTest --offline
```
