# KMPStarter migration validation

KMPStarter is the first of the KMP test-bench apps. It is a separate
developer project, not part of this repository, and this lane did not
change it. This document records how its one screen maps onto the native
Compose widget surface as it exists today. The check that holds it is
`conformance/src/jvmTest/kotlin/com/texuli/conformance/KmpStarterMigrationTest.kt`
with the blueprint `conformance/fixtures/kmp-starter.json`.

## The starter screen

`App.kt` paints one `MaterialTheme` with a centered `Column`. Its
`Button("Click me!")` flips a remembered `showContent` flag, and
`AnimatedVisibility(showContent)` reveals the Compose Multiplatform logo
(`Image`) and `Text("Compose: $greeting")`, where the greeting is
`"Hello, <platform>!"`. The app pins Kotlin 2.3.20 and Compose
Multiplatform 1.10.3, the same pins as `native/`.

## Mapping

| Starter widget | Blueprint form | Native status today |
| --- | --- | --- |
| `Column` (screen) | `layout-page` with a title | Painted (`IMPLEMENTED`) |
| `Text("Compose: …")` | `blocks-text`, block type `text` | Painted (`IMPLEMENTED`) |
| `Image(compose_multiplatform)` | `blocks-media`, block type `image` with `alt`, `width`, `height` | Painted (`IMPLEMENTED`): the bordered frame shows the alt text as image semantics (`Role.Image`), with caption and credit; no image bytes are decoded (see Media in `../README.md`) |
| `Button` + `showContent` + `AnimatedVisibility` | None: `button` has an empty `emit` list, so a blueprint cannot contain it | Stays app code |

The fixture loads with `loadBlueprint` on the native target (no
diagnostics), plans to `layout-page` → `blocks-text`, `blocks-media`, and
`NativeRegistry` reports the statuses above. The greeting is fixed fictional
text (`Hello, Desktop!`) because a blueprint is data, not code.

## Gaps

- **Image pixels.** The media widgets classify and validate sources and
  expose non-empty `alt` as image semantics, but common code decodes no
  image bytes: an image paints its alt-text frame. Decoding data-URI images
  and a host-supplied loader for https and relative sources are planned,
  not built.
- **Interaction.** The toggle (a button, remembered state, conditional
  visibility) has no blueprint form. Blueprint `when` conditions read host
  inputs, but a blueprint cannot emit a control that changes them, and the
  native target has no state or control bindings. In a migrated app the toggle
  stays Compose code around `BlueprintView`.
- **Tables and charts.** The starter screen has neither, so this check does
  not exercise them. Their native painters (table data blocks and the compact
  charts) are covered by `TableGridTest` and `ChartWidgetsTest`.

When a gap closes, `KmpStarterMigrationTest` fails until the expected status
and this table are updated together.

## Running it

From the repository (or lane) root, with JDK 21 and the isolated caches
described in the [native README](../README.md#building):

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
  GRADLE_USER_HOME="$PWD/tmp/gradle-home" \
  KONAN_DATA_DIR="$PWD/tmp/gradle-home/konan" \
  ./native/gradlew -p native :conformance:jvmTest --offline
```
