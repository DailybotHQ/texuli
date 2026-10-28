# KMPAIChat migration validation

KMPAIChat is the third KMP test-bench app. It is a separate developer
project, not part of this repository, and this lane did not change it. This
document records how its chat screen maps onto the native Compose surface
today. The check that holds it is
`conformance/src/jvmTest/kotlin/com/texuli/conformance/KmpAiChatMigrationTest.kt`,
with two fictional, static blueprints: `conformance/fixtures/kmp-aichat-thread.json`
(the intended chat form, which validates on both targets) and
`conformance/fixtures/kmp-aichat.json` (the form the native target paints
today).

## The app's screen

`ChatScreen.kt` is a `Scaffold`:
- a top app bar with the app title;
- a demo warning line;
- an error banner when a request fails;
- an empty-state text, or a `LazyColumn` of `ChatBubble`s (user messages end-aligned on the primary color, assistant messages start-aligned) with a progress indicator while a reply loads, scrolled to the newest item;
- a bottom composer: a multi-line `OutlinedTextField` and a **Send** button.

The app pins Kotlin 2.3.20 and Compose Multiplatform 1.10.3, the same as
`native/`. Messages come from a remote chat service at runtime; the
fixtures use fictional static text instead.

## Mapping

| App widget | Intended blueprint form | Native today |
| --- | --- | --- |
| `Scaffold` + title bar | `layout-page` with a title | Painted (`IMPLEMENTED`) |
| Demo warning | `blocks-text`, type `text` | Painted |
| Message list | `chat-thread` (label) | Validates and plans; paints a `not-on-this-target` placeholder (`PLACEHOLDER`, no native chat painter) |
| `ChatBubble` | `chat-message` (required `author` and `role`: `user`, `agent` or `system`; optional `at`, `text`) | Validates and plans; inside the thread's placeholder (`PLACEHOLDER`) |
| Error banner | `blocks-text`, type `callout` (fallback) | Painted |
| Message list, fallback | `layout-card` with one `blocks-text` per message, the role written as a prefix ("You: …", "Assistant: …") | Painted |
| Composer (text field + Send) | None: host chrome on every target (the player refuses a composer at every tier; a blueprint never supplies one). `input`, `textarea`, `button` and `form` keep an empty `emit` list | Stays app code: the native app provides it, as the web host does |
| Loading indicator, auto-scroll, empty state | None | Stays app code |

`chat-thread` and `chat-message` are catalog ids
(`packages/catalog/src/manifests/chat/`), projected into `@texuli/spec`
0.3.0 as `web-only` and emittable at both tiers. The intended form therefore
validates under `loadBlueprint` and under the TypeScript `validateBlueprint`
(`native/conformance/web/structure.ts` checks the same fixture), and plans
with every chat prop kept (`label`; `author`, `role`, `at`, `text`). The
native target has no chat painter, so the thread paints one visible
`not-on-this-target` placeholder. Until a painter lands, the native screen
uses the fallback, which keeps the words and the order but loses the chat
semantics: no author or time, the role only as text, and no bubble
alignment.

## Gaps

- **No native chat painter.** The chat ids are in the spec (0.3.0) and the
  intended form validates on both targets; painting it natively needs a chat
  painter (a labelled list of messages, each named by author and time, with
  links checked by the untrusted URL policy). Planned, not built.
- **The composer and live behavior** (sending, loading, auto-scroll, errors
  as they happen) stay app code on native. The composer (text field and
  send) is host chrome on every target: the web host or the native app
  provides it, and it is not part of the blueprint.
- **Images, tables and charts** do not appear on this screen, so this check
  does not exercise them.

When a gap closes, `KmpAiChatMigrationTest` fails until the expected outcome
and this table are updated together.

## Running it

From the lane root, with JDK 21 and caches isolated under the lane's own
`tmp/` (see the [native README](../README.md#building)):

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
  GRADLE_USER_HOME="$PWD/tmp/gradle-home" \
  KONAN_DATA_DIR="$PWD/tmp/gradle-home/konan" \
  ./native/gradlew -p native :conformance:jvmTest --offline
```
