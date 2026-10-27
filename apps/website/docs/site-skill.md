# The Texuli skill page

**App:** `@texuli/website` (`apps/website`) · **Path:** `/skill/` · **Tests:** `apps/website/tests/site-build-guards.test.ts` (skill page data), `scripts/tests/skill.test.ts` (the pack)

## What it shows

- **What the skill is:** the router (`skills/texuli/SKILL.md`), its name, version and allowed tools, and how many files it ships.
- **What it may do:** no network, nothing installs itself, consent first. The full contract is `TRUST.md`.
- **Install, per host:** for every host `setup.sh` supports (Claude Code, Cursor, OpenAI Codex, Gemini CLI, GitHub Copilot, OpenCode, Windsurf), the destination folder and three commands: verify, a pinned dry run, and the pinned install. It also covers pinning a release from its archive and `SHA256SUMS`.
- **Sub-skills:** every `<folder>/SKILL.md`, with its name, description, version and reference files.
- **Checksums:** the version, the SHA-256 of `SHA256SUMS` itself, and every file with its hash (in a disclosure).

## Built from the pack

- **Source files:** `src/components/skill/sources.ts` inlines `skills/texuli/**` at build time (`import.meta.glob(..., { query: '?raw' })`), and the page reads only that. Nothing is fetched when the page is served.
- **Parsers:** `src/components/skill/skill.ts` holds the pure parsers. They read frontmatter, the `HOSTS` variable and `host_dir` case in `setup.sh`, the display names in `router/hosts.md`, and `SHA256SUMS`.
- **Navigation:** the `Skill` link is in `src/components/foundation/site.ts`.

The unit tests hold the page to the pack:
- the parsers read frontmatter, the host map and `SHA256SUMS` (`site-build-guards.test.ts`);
- the hosts equal what `setup.sh --list-hosts` prints, and every sub-skill folder is found with its references (`site-build-guards.test.ts`);
- the version matches `setup.sh --version`, `setup.sh --verify --expect-version` passes, and every listed hash equals the file it names (`scripts/tests/skill.test.ts`).

## Validate

```bash
pnpm vitest run apps/website/tests/site-build-guards.test.ts scripts/tests/skill.test.ts
pnpm build
TEXULI_E2E_PORT=<your port> pnpm exec playwright test tests/e2e/a11y-site.spec.ts tests/e2e/site-responsive.spec.ts
```

In the browser (no spec of its own since the 2026-10-27 trim): axe and the
polish check in light and dark in the page sweep (`a11y-site.spec.ts`), and no
horizontal scrolling at 360 and 768 px with the disclosures open
(`site-responsive.spec.ts`).

## Limits

- **No release links:** the page shows the commands for a Texuli checkout and a downloaded release archive. It links to no release, because none is published yet.
- **Discovery:** whether a host discovers the installed folder is that host's behavior.
