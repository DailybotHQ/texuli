# Security policy

Texuli is an open-source (MIT) Svelte 5 component library by Dailybot, Inc.,
with an agent skill pack (`skills/texuli/`). The threat model (URL policy, no
HTML sinks, untrusted agent output, CSP, supply chain, edge functions) is in
[docs/SECURITY.md](docs/SECURITY.md).

## Reporting a vulnerability

Report it privately, never in a public issue, pull request or discussion:

- **Email:** security@dailybot.com
- GitHub's private vulnerability reporting is **not enabled** for this
  repository yet (checked 2026-10-27), so email is the channel.

Include:

- what you found and the impact you observed;
- steps to reproduce (a minimal proof of concept is ideal);
- the affected version: the npm package and version, or the skill's
  `version:` in `skills/texuli/SKILL.md` (or the `skill-vX.Y.Z` tag);
- whether you want credit, and under what name.

We aim to acknowledge a report within 3 business days and to ship a fix or a
mitigation for a confirmed issue within 30 days, sooner for critical ones.
Fixes ship as a new version; published versions are never overwritten.

## Supported versions

Texuli is pre-1.0. Only the newest published version of each npm package and
the newest skill release receive fixes ([docs/RELEASE.md](docs/RELEASE.md)).
There are no backports.

## In scope

- The packages under `packages/` and what they publish to npm.
- The skill pack under `skills/texuli/`: its `setup.sh`, its guidance, and
  any network call, file write or persistent change it causes.
- The release workflows under `.github/workflows/` and the assets they
  publish (npm tarballs, the skill archive and its `SHA256SUMS`).
- The website at texuli.com and the Pages Functions in `functions/`.

## Out of scope

- Third-party agent hosts and installers (Claude Code, Cursor, the skills
  CLI, OpenClaw): report those upstream.
- Copies of the skill that were edited after installation; verify yours
  with `setup.sh --verify` first.
- Demo data and simulated auth in examples: they are not security controls.

## Integrity of what we publish

- npm packages are published by CI with npm provenance.
- Skill releases are **checksummed, not signed**: verify the archive and
  every file against the release's `SHA256SUMS` before installing
  ([skills/texuli/TRUST.md](skills/texuli/TRUST.md#provenance),
  [docs/SKILL_INSTALLATION.md](docs/SKILL_INSTALLATION.md#release-archive)).
