---
name: texuli-upgrade
description: Check whether a newer Texuli skill release exists and, only after the developer explicitly accepts, download that exact skill-vX.Y.Z release, verify it against the release SHA256SUMS and replace the installed copy with setup.sh --replace (the old copy is kept as a backup). Use when the developer asks to upgrade, update or check the Texuli skill. Not for installing Texuli packages.
version: "0.4.2"
documentation_url: https://texuli.com/guides/
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
metadata: {"openclaw":{"emoji":"▣","homepage":"https://texuli.com/guides/","requires":{"anyBins":["bash","git"]}}}
---

# Texuli skill — upgrade

Keep an installed Texuli skill current, in three strictly ordered phases:
**check** (read-only), **consent** (nothing downloads without an explicit
yes), **upgrade** (one pinned release, verified before it is installed).
This sub-skill upgrades the skill pack only. Texuli packages are a separate
decision ([`../components/SKILL.md`](../components/SKILL.md)).

## Trust boundary

- Phase 1 makes one read-only network call (the list of skill tags) and
  writes nothing. Say so before running it; if the developer declines, stop
  with the installed version as the answer.
- Phase 3 starts only after the developer accepts one exact version. It
  downloads two files of that release, verifies them, and replaces the
  installed folder through `setup.sh`, which keeps the previous copy.
- Never install a moving ref (`main`, `latest`), never use the
  `owner/repo@ref` shorthand of the skills CLI (it can install the default
  branch instead of the ref), and never pipe a download into a shell.
- In a Texuli repository checkout, `.agents/skills/texuli/` is a mirror the
  repository maintains (`pnpm exec tsx scripts/check-skill.ts --refresh-mirror`).
  Do not upgrade it with this sub-skill.

The full contract is [`../TRUST.md`](../TRUST.md).

## Phase 1 — Check (read-only)

1. **Installed version.** Find the folder this file was read from (for
   example `~/.claude/skills/texuli/`) and read the quoted `version:` of its
   `SKILL.md`, or print it:

   ```bash
   ~/.claude/skills/texuli/setup.sh --version
   ```

2. **Latest release.** With the developer's go-ahead for one read-only
   network call, list the skill tags:

   ```bash
   git ls-remote --tags --refs https://github.com/DailybotHQ/texuli.git 'skill-v*'
   ```

   Keep the stable `refs/tags/skill-vX.Y.Z` tags, sort them as versions and
   take the highest. Ignore pre-release tags (`skill-vX.Y.Z-next.N`) unless
   the developer asks for that channel. Tags named `vX.Y.Z` are npm package
   releases, not skill releases.
3. **Report and stop.** State the installed version, the latest release, and
   where the changes are listed (`CHANGELOG.md` in the pack and the GitHub
   Release of that tag). When they are equal, say the skill is current and
   end here. When no `skill-v` tag exists yet, say no skill release is
   published and end here.
4. **Offline or unreachable.** If the call fails, say so in one line, give
   the installed version, and end cleanly: no retry loop, no partial state.

## Phase 2 — Consent

Ask one question that names:

- the exact version (`skill-v<version>`) and the host folder it replaces;
- what is written: only that folder, after the old copy moves to
  `~/.texuli/skill-backups/<host>-<UTC stamp>/texuli`;
- what is not touched: the workspace, Texuli packages, other skills, agent
  settings;
- that local edits inside the installed folder are replaced (they stay in
  the backup).

Only an explicit yes for that version starts Phase 3. A decline, a different
version or silence ends the sub-skill with the Phase 1 report standing.

## Phase 3 — Upgrade (accepted)

1. **Download the two release files** into an empty folder:

   ```bash
   mkdir -p texuli-skill-<version>
   cd texuli-skill-<version>
   curl -fsSLO https://github.com/DailybotHQ/texuli/releases/download/skill-v<version>/texuli-skill-<version>.tar.gz
   curl -fsSLO https://github.com/DailybotHQ/texuli/releases/download/skill-v<version>/SHA256SUMS
   ```

2. **Verify before installing.** Check the archive, unpack it, then check
   every file and the pinned version. On Linux, `sha256sum -c` replaces
   `shasum -a 256 -c`.

   ```bash
   grep ' texuli-skill-<version>.tar.gz$' SHA256SUMS | shasum -a 256 -c -
   tar -xzf texuli-skill-<version>.tar.gz
   shasum -a 256 -c SHA256SUMS
   ./texuli/setup.sh --verify --dir ./texuli --expect-version <version>
   ```

   Any failure stops the upgrade: report the failing line and install
   nothing.
3. **Show the plan, then replace.** The dry run prints the destination, the
   installed version and the backup path:

   ```bash
   ./texuli/setup.sh --host <host> --expect-version <version> --replace --dry-run
   ./texuli/setup.sh --host <host> --expect-version <version> --replace
   ```

   A copy installed with the skills CLI upgrades through the same pinned
   form instead, then gets the same version check:

   ```bash
   npx --yes skills add https://github.com/DailybotHQ/texuli/tree/skill-v<version>/skills/texuli --skill texuli -y
   ```

4. **Close the loop.** Verify the installed copy, then tell the developer to
   reload the host:

   ```bash
   ~/.claude/skills/texuli/setup.sh --verify --expect-version <version>
   ```

   Report: old version → new version, the host folder, the backup path, and
   the verification result.

## Roll back

Move the backup back into the host's skills folder and verify it with
`--verify --dir <that folder> --expect-version <old-version>`
([`../setup/pinned-install.md`](../setup/pinned-install.md)).

## Guarantees

- **Read-only until accepted.** Phase 1 writes nothing.
- **One pinned version.** The download, both checks and the install name
  the same `<version>`; `--expect-version` refuses anything else.
- **No silent loss.** `setup.sh --replace` keeps the previous copy.
- **Offline-safe.** An unreachable network ends with a report, never a
  partial install.

## Texuli packages 0.13 → 0.14: what to check

This sub-skill never upgrades packages; moving an app from `^0.13.0` to
`^0.14.0` is the developer's install ([`../components/SKILL.md`](../components/SKILL.md)).
`0.14.0` breaks no public API; it is a minor because the blueprint spec
moves to `0.12.0` and the design-system compiler to version `3`. Before the
move, check the app for:

- **Stored compiled design systems:** `DESIGN_SYSTEM_COMPILER_VERSION` is
  `3`, so the compiled form and its hash change once for every document.
  Recompile cached `design-system.compiled.json` files and update any
  snapshot or cache key that holds a hash. `formatVersion` stays `1`, and
  every `0.11.0` document stays valid. `sidebarPrimary` is now derived
  under a `color.roles.<mode>.primary` pin too, so a sidebar accent can
  change color; a `sidebarPrimary` role pin is kept and reported.
- **An invisible active sidebar item:** the new code `aa-non-text` (3:1,
  WCAG 1.4.11) makes `texuli ds check`, `ds.validate` and `--render` fail
  when `sidebarPrimary` vanishes on `sidebar`, usually a
  `color.roles.<mode>.sidebarPrimary` pin. Drop the pin (the compiler then
  derives a visible fill) or pin a fill at 3:1. `primary` on `background`
  below 3:1 is only a warning.
- **Timelines with `getGroup`:** `TimelineView` now opens every group with
  a header row (rows without a group fall under one `Ungrouped` header),
  where `getGroup` only ordered rows before. Row counts, row indexes and
  visual snapshots move; drop `getGroup` to keep flat rows.
- **`TabsContext.contentId()`** now returns `string | undefined`: a tab
  with no rendered panel has no panel id, and its trigger omits
  `aria-controls` (pass `panelId` when the tab switches a region the host
  renders). Code that reads the context and needs a string must handle
  `undefined`.
- **A disabled `Tooltip`** keeps the tooltip closed but no longer disables
  its trigger: a `Button` inside it still focuses and activates. Set
  `disabled` on the control itself where it should be disabled.
- **Dialog and sheet scrims** take their color from `--tx-scrim`, with the
  same opacity tokens, not from `--tx-foreground`, so dark themes get a
  dark overlay again. Visual snapshots of open dialogs, sheets, drawers and
  responsive modals move. A design-system document has no scrim color
  slot; set `--tx-scrim` in host CSS on the theme scope.
- **Blueprints:** every `0.11.0` envelope migrates to `0.12.0` by stamping
  `spec` (`migrateBlueprint`); the new `data-timeline` props, the
  `collapse` event, the `code-field` and `avatar-group-grid` ids, the
  `media-image` `srcDark` and `darkMode` and a layer's `darkOpacity` are
  refused by `0.13.x` readers.

The full notes are in `docs/RELEASE.md` of the Texuli repository
("0.14.0").

## Texuli packages 0.12 → 0.13: what to check

This sub-skill never upgrades packages; moving an app from `^0.12.0` to
`^0.13.0` is the developer's install ([`../components/SKILL.md`](../components/SKILL.md)).
`0.13.0` breaks no public API; it is a minor because the blueprint spec
moves to `0.11.0` and the design-system compiler to version `2`. Before the
move, check the app for:

- **Stored compiled design systems:** `DESIGN_SYSTEM_COMPILER_VERSION` is
  `2`, so the compiled form and its hash change for every document.
  Recompile cached `design-system.compiled.json` files and update any
  snapshot or cache key that holds a hash. The document's `formatVersion`
  stays `1`, and every `0.10.0` document stays valid.
- **The sidebar fill:** `sidebarPrimary` is now derived when copying the
  primary pin would equal the sidebar fill or fail contrast, so a sidebar
  accent can change color.
- **Soft fills:** a soft fill whose `*SoftForeground` is pinned is held
  to that ink only, not to the page foreground, so its compiled fill can
  differ from `0.12.x`; when the page foreground misses the target on it,
  alert bodies and calendar event text follow `--tx-<role>-soft-body`.
- **Blueprints and documents:** every `0.10.0` envelope migrates to
  `0.11.0` by stamping `spec` (`migrateBlueprint`); the new
  design-system fields (`elevation.levels`, `extensions`, a categorical
  palette of 1 to 8 colors) are refused by `0.12.x` readers.
- **Chart titles:** flow, geo and part-whole charts inside a section now
  title themselves one rank below it (through `@texuli/charts/heading`)
  instead of a fixed h3; heading-level snapshots may move.
- **Labels (optional):** `LabelsProvider` or `setTexuliLabels` from
  `texuli/i18n` replaces per-component `labels` props in `texuli`,
  primitives, blocks and pages; a prop still wins. `@texuli/data`,
  `@texuli/chat`, `@texuli/media` and `@texuli/editor` still need their
  `labels` props.

The full notes are in `docs/RELEASE.md` of the Texuli repository
("0.13.0").

## Texuli packages 0.11 → 0.12: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.11.0` to
`^0.12.0` is the developer's install ([`../components/SKILL.md`](../components/SKILL.md)).
The blueprint spec stays `0.10.0`. Only the `@texuli/pages` core entries
change (Protoyard G136: they validate without `@texuli/deck/model`); the
default entries behave as before. Before the move, check the app for:

- **`PageEditorCore`, `CollabEditorCore` and `new PagesEditor(...)`
  (breaking):** they take `validateDeck` (a `DeckPayloadValidator`) with
  no default, so a transaction that leaves an inline deck in the document
  is refused, and `PageEditorCore`'s slash menu has no inline deck item.
  Pass `validateDeck={checkDeckPayload}` (or `validateDeck:
  checkDeckPayload`), with `checkDeckPayload` from
  `@texuli/document/schema`.
- **`createDocumentPlayerHostCore` (breaking):** takes `validateDeck`
  with no default, and `checkDocumentDraft` refuses inline decks. Use
  `createDocumentPlayerHostCore({ validateDeck: checkDeckPayload })`, and
  `createDocumentDraftCheck(checkDeckPayload)` (new) for the draft check.
- **Unchanged:** `PageEditor`, `CollabEditor` and
  `createDocumentPlayerHost` keep `checkDeckPayload` as their default.

The full notes are in `docs/RELEASE.md` of the Texuli repository
("0.12.0").

## Texuli packages 0.10 → 0.11: breaking changes

This sub-skill never upgrades packages; moving an app from `^0.10.0` to
`^0.11.0` is the developer's install ([`../components/SKILL.md`](../components/SKILL.md)).
The blueprint spec stays `0.10.0`. Before the move, check the app for:

- **Core entries without the theme library (breaking):** the slides and
  pages core entries no longer load the theme library by default; a host
  that relied on it passes the loaders (the default entries behave as
  before). `@texuli/slides`: `DeckStageCore` (`stage-core`) and
  `DeckPrintViewCore` (`export-core`) take
  `loadTheme={loadDeckLibraryTheme}`, and `DeckStageCore` also
  `loadLibraryBase={loadDeckLibraryBase}` (both from `stage-core`).
  `@texuli/pages`: `PageReaderCore` (`reader-core`) takes
  `loadLibraryBase={loadPagesLibraryBase}`, and `host-core` is
  `createDocumentPlayerHostCore({ loadLibraryBase: loadPagesLibraryBase })`
  (exported by both entries).
- **Single-mode design systems:** `applyDesignSystem`,
  `designSystemStyle` and `designSystemAppearance` never throw for a mode
  that was not compiled; they paint the first compiled mode and write it as
  `data-tx-mode` (`pickDesignSystemMode`). `emitCss` puts a single mode on
  the base selector.
- **Player and pages cores never reject:** an error while applying a
  design system becomes a refusal (`design-system-refused` at
  `$.designSystem`) that drops the previous system and reaches
  `onDesignSystem`.
- **`DesignSystemProvider`:** never throws from its effect; a failed apply
  drops the previous system and calls `onapplyerror`.

New APIs in `0.11.0` are marked "new in `0.11.0`" in
[`../router/packages.md`](../router/packages.md); the full notes are in
`docs/RELEASE.md` of the Texuli repository ("0.11.0").

## Earlier releases

The breaking changes of `0.10.0`, `0.9.0`, `0.8.0`, `0.7.0`, `0.6.0` and
`0.5.0` (for an app still on `^0.9.0` or older) are in
[`references/packages.md`](references/packages.md); read them in order,
oldest first, then the sections above.
