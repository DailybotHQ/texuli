# KMPAIVoiceChat migration validation

KMPAIVoiceChat is the fourth KMP test-bench app. It is a separate developer
project, not part of this repository, and this lane did not change it. Only
its UI and state files were read; its configuration and secrets files were
not opened. This document records how its two screens map onto the native
Compose widget surface as it exists today. The check that holds it is
`conformance/src/jvmTest/kotlin/com/texuli/conformance/KmpVoiceChatMigrationTest.kt`
with three blueprints in `conformance/fixtures/`:
- `kmp-voicechat-chat.json`
- `kmp-voicechat-realtime.json`
- `kmp-voicechat-thread.json`

All their text is fictional.

## The app

`App.kt` switches between two screens with a remembered `AppScreen` flag:
- **Chat** (`ChatScreen`): a `Scaffold` with a centered top app bar (title,
  plus an icon button that opens the realtime screen). Under it:
  - a small demo-warning line and an error surface;
  - an empty-state text, or the transcript (a `LazyColumn` of `ChatBubble`s,
    user turns right-aligned, assistant turns left-aligned);
  - a spinner with "transcribing" text while a voice message is converted.

  The bottom bar is a composer (outlined text field, send button and
  microphone button), or, while recording, a recording bar: cancel, a red
  dot, an elapsed-time counter, a label and stop.
- **Realtime** (`RealtimeVoiceScreen`): a top app bar with a close button, an
  animated "voice orb" you tap to start or stop a session, a status label
  (idle, connecting, listening, speaking, error), an action hint, two
  transcript cards ("you said" and the assistant's reply) and an error
  message. Audio is captured and played by platform PCM recorders and players.

## Mapping

| App widget | Blueprint form | Native status today |
| --- | --- | --- |
| Screen `Column` / `Scaffold` body, top-bar title | `layout-page` with a title | Painted (`IMPLEMENTED`) |
| Demo warning, empty state, status label, action hint | `blocks-text`, block type `text` | Painted (`IMPLEMENTED`) |
| Error surface | `blocks-text`, block type `callout`, tone `danger` | Painted (`IMPLEMENTED`) |
| Transcript cards (realtime) | `layout-card` (the label as its title) holding a `blocks-text` | Painted (`IMPLEMENTED`) |
| Transcript bubbles (chat), natural form | `chat-thread` with `chat-message` children: an `author` per turn, the app's "assistant" turn as role `agent` | Validates and plans; paints a `not-on-this-target` placeholder (`PLACEHOLDER`, no native chat painter) |
| Transcript bubbles (chat), portable form | One `blocks-text` per turn, the speaker in bold ("**You:** …") | Painted (`IMPLEMENTED`), but bubble alignment, color and shape are lost |
| "Transcribing" text | `blocks-text` | Painted (`IMPLEMENTED`) |
| Spinner (`CircularProgressIndicator`) | None: `charts-progress-ring` needs a value and is not indeterminate | Stays app code |
| Composer: text field and send | None: host chrome on every target (the player refuses a composer at every tier; a blueprint never supplies one) | Stays app code: the native app provides it, as the web host does |
| Microphone button | None: `button` and `icon-button` have empty `emit` lists | Stays app code |
| Recording bar: cancel, dot, timer, stop | None (same controls, plus live timing) | Stays app code |
| Voice orb (animated, tappable) | None: no animated or tappable control id | Stays app code |
| Audio capture and playback | None: no audio id in the vocabulary, and media blocks cover `image`, `figure`, `video` and `gallery` only | Stays platform code |
| Screen switch (`AppScreen`) | None on native: flows (G09) are a web player feature, not in the spec | Stays app code |

The two portable fixtures load with `loadBlueprint` on the native target
with no diagnostics, and every id in their plans is `IMPLEMENTED`.

The thread fixture validates on the native target and under the shared
TypeScript validator (`validateBlueprint` in `@texuli/spec`;
`native/conformance/web/structure.ts` checks it). The app's message model
has no author and calls the reply role "assistant", so a transcript copied
as is gets refused on both targets with exactly these diagnostics, and a
migration must map them:

| Code | Path | Id |
| --- | --- | --- |
| `missing-required` | `$.tree.children[1].children[0].props.author` | `chat-message` |
| `enum-value` | `$.tree.children[1].children[1].props.role` | `chat-message` |
| `missing-required` | `$.tree.children[1].children[1].props.author` | `chat-message` |

## Gaps

- **No native chat painter.** `chat-thread` and `chat-message` are
  catalog manifests (`packages/catalog/src/manifests/chat/`)
  in the `@texuli/spec` 0.3.0 vocabulary as `web-only`. The thread form
  validates natively but paints a `not-on-this-target` placeholder, so on
  native a voice-chat transcript still paints only as plain text turns,
  without roles, alignment or bubble styling.
- **No audio surface.** Recording, streaming and playing audio have no
  blueprint form and no native painter, and there is no audio block type. A
  migrated app keeps all audio in platform code around `BlueprintView`, and
  a blueprint can show only the text around it (status, transcripts).
- **No indeterminate progress.** A busy spinner has no id. The only progress
  widget, `charts-progress-ring`, shows a value.
- **Interaction.** As in KMPStarter, the microphone, cancel, stop, orb and
  screen-switch controls cannot be emitted, and the native target has no
  state or control bindings. The text field and send pair is the composer,
  host chrome on every target: the web host or the native app provides it,
  and it is not part of the blueprint. All of them stay Compose code.
- **Live updates.** The transcript grows as messages arrive. The web player
  re-validates a replaced blueprint with state kept (R20), but the native
  target has no live-update path yet. A host would rebuild the plan per
  update.

When a gap closes, `KmpVoiceChatMigrationTest` fails until the expected
statuses, the pinned diagnostics and this table are updated together.

## Running it

From the repository (or lane) root, with JDK 21 and the isolated caches
described in the [native README](../README.md#building):

```bash
JAVA_HOME=$(/usr/libexec/java_home -v 21) \
  GRADLE_USER_HOME="$PWD/tmp/gradle-home" \
  KONAN_DATA_DIR="$PWD/tmp/gradle-home/konan" \
  ./native/gradlew -p native :conformance:jvmTest --offline
```
