# The Texuli skill page

**App:** `@texuli/website` (`apps/website`) · **Path:** `/skill/` · **E2E:** `tests/e2e/site-skill.spec.ts`

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

The spec holds the page to the pack:
- the hosts equal what `setup.sh --list-hosts` prints;
- the version matches `setup.sh --version`, and `setup.sh --verify --expect-version` passes;
- every listed hash equals the file it names, and every pack file is listed;
- every sub-skill folder is found.

## Validate

```bash
pnpm build
TEXULI_E2E_PORT=<your port> pnpm exec playwright test tests/e2e/site-skill.spec.ts
```

The browser checks cover:
- the content of every host, sub-skill and checksum;
- the keyboard-opened checksum list;
- no horizontal scrolling;
- no foreign requests;
- axe in light and dark, on desktop Chromium, WebKit and the Pixel 7.

## Limits

- **No release links:** the page shows the commands for a Texuli checkout and a downloaded release archive. It links to no release, because none is published yet.
- **Discovery:** whether a host discovers the installed folder is that host's behavior.
