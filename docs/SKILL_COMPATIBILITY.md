# Skill compatibility matrix

What is proven about installing the Texuli skill on each route and host, and
what is not. The install commands are in
[SKILL_INSTALLATION](SKILL_INSTALLATION.md).

## Evidence levels

| Level | Means |
| --- | --- |
| **Documented** | The route is described in the docs. No test asserts it. |
| **Install-tested** | An automated test proves the files land where the host reads them, complete and matching `SHA256SUMS`. It proves installation only. |
| **Behavior-tested** | An agent on that host ran the skill and the result was inspected. |

An install test is never evidence that a host discovers or follows the
skill: discovery is the host's behavior. No cell below is behavior-tested
per host. The skill's recorded evals
([`skills/texuli/evals/`](../skills/texuli/evals/SKILL.md)) score trees an
agent produced while following the skill; they do not name a host.

## Installation routes

| Route | Level | Evidence |
| --- | --- | --- |
| `setup.sh --host <host>` from a checkout | **Install-tested** | `scripts/tests/skill.test.ts` installs into every host `--list-hosts` prints under a temp home, verifies each copy against `SHA256SUMS`, and re-runs to prove it is idempotent; it also covers `--dry-run`, `--verify`, `--version` and `--expect-version` refusals. CI runs it on Linux and runs a `setup.sh` smoke under macOS `/bin/bash` 3.2 |
| `setup.sh --verify` against a release `SHA256SUMS` | **Install-tested** | `scripts/tests/skill-release.test.ts` builds `texuli-skill-<version>.tar.gz` and the release `SHA256SUMS` the way the release workflow does, then checks them with `shasum -a 256 -c` and `setup.sh --verify --dir … --expect-version`; the workflow repeats the check on the real archive before publishing |
| skills CLI `add`, pinned by the tree URL of a `skill-vX.Y.Z` tag | **Documented** | The skill release workflow installs each new tag this way into a temp project and asserts the installed version and checksums. It becomes install-tested with the first release run |
| skills CLI `add` with the `owner/repo@ref` shorthand | **Not supported** | The skills CLI can ignore the ref of the shorthand ([SKILL_INSTALLATION](SKILL_INSTALLATION.md#1-skills-cli-pinned-to-a-release)) |
| OpenClaw registry (`openclaw skills install texuli`) | **Documented** | No Texuli registry entry verified, no OpenClaw runtime in the test environments |
| OpenClaw manual copy | **Documented** | Same files as the release archive |
| Release archive download | **Documented** | Depends on a published release; none exists until the first `skill-v` tag |

## setup.sh hosts

| Host | `--host` | Folder | Level |
| --- | --- | --- | --- |
| Claude Code | `claude` | `~/.claude/skills/texuli/` | Install-tested |
| Cursor | `cursor` | `~/.cursor/skills/texuli/` | Install-tested |
| OpenAI Codex | `codex` | `~/.codex/skills/texuli/` | Install-tested |
| Gemini CLI | `gemini` | `~/.gemini/skills/texuli/` | Install-tested |
| GitHub Copilot | `copilot` | `~/.copilot/skills/texuli/` | Install-tested |
| OpenCode | `opencode` | `~/.config/opencode/skills/texuli/` | Install-tested |
| Windsurf | `windsurf` | `~/.codeium/windsurf/skills/texuli/` | Install-tested |
| OpenClaw | — | its registry | Documented (`setup.sh` points to the registry) |

## Platforms

| Platform | Level | Evidence |
| --- | --- | --- |
| Linux, bash 5 | Install-tested | `scripts/tests/skill.test.ts` in the CI `check` job (Ubuntu) |
| macOS, `/bin/bash` 3.2 | Install-tested | The CI `setup-smoke-macos` job: `--help`, `--list-hosts`, `--verify`, a dry run, an install into every host, an idempotent re-run and a `--verify` of each copy. The same script passed locally under `/bin/bash` 3.2.57 on 2026-10-27 |
| Windows | Not tested | `setup.sh` needs a POSIX shell; WSL is untested |

## Guarantees covered by tests

- **Pinned:** `--expect-version` refuses another version with exit 1 and
  writes nothing.
- **Non-clobbering:** an unrelated folder at the destination is refused
  (exit 3); another Texuli version needs `--replace`, which keeps a backup.
- **Idempotent:** installing the same pack twice reports no change.
- **Offline:** `--verify`, `--list-hosts`, `--version` and `--dry-run` need
  no network.
