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
