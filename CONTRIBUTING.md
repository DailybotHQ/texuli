# Contributing to Texuli

Thanks for helping. This is the human counterpart to
[AGENTS.md](AGENTS.md), which holds the canonical rules for people and AI
agents alike (`CLAUDE.md` is a symlink to it). When the two disagree,
AGENTS.md wins.

## Before you start

- Read [AGENTS.md](AGENTS.md) (the mandatory rules), then the guide for
  your area: [STANDARDS](docs/STANDARDS.md) for code,
  [ARCHITECTURE](docs/ARCHITECTURE.md) for the down-only layers, and the
  package's own `README.md`.
- First session: [AI_AGENT_ONBOARDING](docs/AI_AGENT_ONBOARDING.md).
  Working beside other contributors in one checkout:
  [AI_AGENT_COLLAB](docs/AI_AGENT_COLLAB.md).
- Install once with `pnpm install` (Node 24 and pnpm). Owner-held files
  (`package.json`, `pnpm-lock.yaml`, `biome.json`, `tsconfig.base.json`, …)
  change only with the owner.

## Making a change

1. Keep it scoped. A behavior change ships with a test that would have
   failed before it.
2. Follow the matching procedure: a texel
   ([add-texel](.agents/skills/add-texel/SKILL.md)), a website page
   ([add-website-page](.agents/skills/add-website-page/SKILL.md)), a
   primitive, styled component or catalog entry
   ([skills/texuli/contribute](skills/texuli/contribute/SKILL.md)).
3. Run the gates for the surface you touched
   ([TESTING_GUIDE](docs/TESTING_GUIDE.md) maps sources to tests). The fast
   full gate:

   ```bash
   pnpm check
   ```

4. Docs describe what works today and mark everything planned as planned.

## Commits and pull requests

- Conventional Commits: `type(scope): summary`, with the scopes listed in
  [AGENTS.md](AGENTS.md#mandatory-rules). Stage exact paths.
- English only, fictional data only (`example.com`), no secrets.
- Open a pull request against `main`; CI must pass
  ([CI](docs/CI.md)).

## The agent skill

`skills/texuli/` is released on its own `skill-vX.Y.Z` tags by a workflow
([RELEASE](docs/RELEASE.md#skill-release)):

- Commits that touch `skills/texuli/` decide the next skill version
  (`feat` → minor, `fix` and others → patch, breaking → major, a minor
  before 1.0.0). Add `[skip release]` to a commit message to merge without a
  skill release.
- Never hand-edit a `version:` field or a version section of
  `skills/texuli/CHANGELOG.md`. Notes for the next release go in its
  `## [Unreleased]` block.
- After editing the pack, regenerate its checksums and the dogfood mirror,
  then validate:

  ```bash
  pnpm exec tsx scripts/check-skill.ts --write-sums
  pnpm exec tsx scripts/check-skill.ts --refresh-mirror
  pnpm check:skill
  ```

## Security

Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md),
never in a public issue.

## License

By contributing you agree that your contribution is licensed under the
[MIT license](LICENSE).
