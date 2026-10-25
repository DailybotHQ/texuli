# KMPPTTDynamics migration validation

KMPPTTDynamics is the fifth KMP test-bench app and the flagship portable-tier
validation target in the roadmap. Its source project is a separate developer
repository at `~/AndroidStudioProjects/KMPPTTDynamics`. This lane read only
the common Compose app and room-tab UI files there; it did not modify that
project or open secret/configuration files.

Five fictional, static room snapshots are checked by
`KmpPttDynamicsMigrationTest`:

| Feature surface | Fixture | Native status today |
| --- | --- | --- |
| Room chat messages | `conformance/fixtures/kmp-pttdynamics-chat.json` | `layout-page`, `layout-card`, and `blocks-text`: `IMPLEMENTED` |
| Poll question and sample counts | `conformance/fixtures/kmp-pttdynamics-polls.json` | `layout-page`, `layout-card`, and `blocks-text`: `IMPLEMENTED` |
| Raised-hand queue | `conformance/fixtures/kmp-pttdynamics-hands.json` | `layout-page`, `layout-card`, and `blocks-text`: `IMPLEMENTED` |
| Raffle entry snapshot | `conformance/fixtures/kmp-pttdynamics-raffles.json` | `layout-page`, `layout-card`, and `blocks-text`: `IMPLEMENTED` |
| Trivia question and choices | `conformance/fixtures/kmp-pttdynamics-trivia.json` | `layout-page`, `layout-card`, and `blocks-text`: `IMPLEMENTED` |

The fixtures use only invented names, counts, prompts, and messages. They are
static display examples, not live state or a migration of the KMP app.

## Gaps and tier honesty

The current catalog marks all components `unknown`; the three fixture widgets
are not yet audited as `portable-core`. For that reason the fixtures declare
the existing `web` profile. This validates that the same plain-data shape
loads into native render plans and that the current renderer paints those
three ids; it does **not** claim portable-tier conformance. A future catalog
audit must classify and test those ids before these fixtures can claim the
portable profile.

Room navigation, live/realtime chat, poll voting, push-to-talk and raised-hand
state, raffle entry/draw actions, trivia answer/leaderboard transitions, and
their feedback remain app code. Form controls (`button`, `input`, `checkbox`,
`radio`, `radio-group`, and `switch`) have no native painter and are not
emitted into these blueprints. The native catalog currently has no audio
painter; microphone/audio playback behavior remains outside the fixture and
native renderer. Avatar/image bytes and backend behavior are likewise not
represented.

No Compose UI-test suite is attempted here: this lane relies on the native JVM
projection/conformance tests because the prior Desktop UI-test attempt stalled
during macOS AWT/AppKit initialization before assertions.

## Validation

Run `KmpPttDynamicsMigrationTest` as part of the isolated native `check` gate.
It loads all five fixtures, pins the native status of every rendered widget,
confirms that the current capability tier is still unknown, and holds the
interactive-control/audio gaps. Any renderer or catalog change that moves
these statuses requires a deliberate update to this mapping and the fixtures.
