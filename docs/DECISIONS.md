# Decisions

Architecture decisions for Texuli: the options, the choice, why, and how to
reverse it. Newest last.

## ADR-001: Keep `@internationalized/date` for calendar and date math

- **Date:** 2026-10-23 · **Decided by:** the project owner.
- **Context:** Texuli builds its components, primitives and charts from scratch
  and has no third-party runtime dependency except this one. The date
  primitives (Calendar, DateField, TimeField, DatePicker, DateRangePicker) need
  calendar-correct date math.
- **Options:** (1) write our own Gregorian-only math on `Intl`; (2) keep
  `@internationalized/date`; (3) wait for the platform's Temporal API.
- **Choice:** keep `@internationalized/date` (Apache-2.0, maintained alongside
  a widely used accessibility-focused component stack, one tiny helper
  dependency). It is domain infrastructure, like `Intl`, not a component
  library.
- **Why:** it covers what is expensive and risky to rebuild: non-Gregorian
  calendars (Japanese eras, Buddhist, Hebrew, Islamic variants, Persian,
  Ethiopic, Indian), calendar-correct arithmetic (month-end overflow, leap
  years, era changes) and time zones with daylight-saving gaps and overlaps.
  Rewriting it would add risk to a sensitive area for little gain.
- **Reverse when:** Temporal is broadly available in the browsers Texuli
  supports. Then the date primitives move to the platform API and Texuli has no
  third-party runtime dependency. Only `@texuli/primitives` imports it, so the
  change stays inside that package.

## ADR-002: Use browser-native MediaRecorder for WebM export (D13)

- **Date:** 2026-10-25 · **Ratification:** lead-ratified as a
  constraint-forced routine choice under the no-new-dependency rule; the
  developer may override this decision.
- **Context:** `@texuli/media/export` needs a local WebM path for composed
  animations. The export must not upload frames or introduce an encoder
  dependency without explicit developer supply-chain approval.
- **Options:** (1) use browser-native `MediaRecorder` with `canvas.captureStream`
  and an explicit frame clock; (2) bundle a JavaScript or native encoder —
  rejected because adding an encoder dependency requires a separate developer
  supply-chain GO, which is not granted; (3) defer WebM export.
- **Choice:** use browser-native `MediaRecorder` only. Draw validated animation
  samples into an owned canvas, capture at the requested fixed frame rate using
  a monotonic, cancellable frame clock, record the VP8 WebM profile at a fixed
  4 Mbps video bitrate and 1-second chunk interval, and report progress as
  frames are submitted. Canceling stops the recorder and every stream track
  and clears pending frame deadlines.
  No worker is used and no worker network access is introduced.
  Frame timing and settings are deterministic within the selected browser
  profile; encoded bytes are not promised to be bit-identical across browser
  engines or hardware.
- **Why:** this stays inside the browser's built-in media capability, keeps
  rendering local, adds no supply-chain surface, and makes pacing, resource
  release and progress observable through an injectable recorder/canvas
  boundary.
- **Reverse when:** the developer grants supply-chain approval or supported
  browser coverage makes native recording insufficient. Swap the encoder
  boundary while preserving the frame-sampling, progress, cancellation and
  output contracts; an encoder dependency requires explicit developer GO.
