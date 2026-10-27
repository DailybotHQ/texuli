# Changelog

All notable changes to the Texuli skill pack (`skills/texuli/`) are
documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the pack
follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html); before
1.0.0 a breaking change bumps the minor.

Skill releases are tagged `skill-vX.Y.Z`, separately from the npm packages
(tagged `vX.Y.Z`). The skill release workflow writes the version sections
below: do not hand-edit them or the `version:` fields of any `SKILL.md`.
The one hand-written part is the `## [Unreleased]` block: the next release
folds its body into its own section, under the list of commits that touched
the pack, and leaves an empty `## [Unreleased]` block on top.

## [Unreleased]

### Content

- Drag and drop: `@texuli/drag` (the framework-free engine) and
  `@texuli/primitives/sortable`, with the shared accessibility and i18n
  contract; build-ui recipes for sortable lists and a workflow editor.
- `@texuli/workflows`: editor, viewer, inspector, model, layout and the spec
  adapter, marked in development and not on npm.
- Blueprints stage G: spec 0.3.0 interaction as data (envelope `state` and
  `flow`, `$state` and `$data` bindings, the closed actions, `on`, `reorder`,
  `workflow-graph`, migrations and the state surface rules), with a
  validated example in `blueprints/references/interaction.md`.
- The package index lists `@texuli/drag`, `@texuli/workflows`, the new spec
  and catalog subpaths and the 158-id catalog, and says what is unreleased.
- Evals: five `interactive` scenarios (sortable lists, a workflow editor,
  stateful JSON with `reorder`, an editable `workflow-graph`, the lego
  composition).

### Publishing

- The pack is released on its own tag namespace, `skill-vX.Y.Z`, with a
  `texuli-skill-<version>.tar.gz` archive and a release `SHA256SUMS` that
  covers the archive and every file of the pack.
- `metadata` is single-line JSON in every `SKILL.md`; names stay within 64
  characters, descriptions within 1024, and every `SKILL.md` and entry bundle
  within a byte budget (`scripts/check-skill.ts`).
- New `upgrade` sub-skill: a read-only check of the latest skill tag, then,
  after explicit consent, a pinned and verified `setup.sh --replace`.
- `TRUST.md` states the provenance model: releases are checksummed, not
  signed, and only the release's own `SHA256SUMS` is independent of the
  files it describes.
