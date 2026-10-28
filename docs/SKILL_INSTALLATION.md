# Installing the Texuli skill

The Texuli skill (`skills/texuli/`) is a pack of Markdown guidance that
teaches coding agents to build with Texuli. Installing it copies that pack
into an agent host's skills folder. It installs no npm package and no CLI.
The same commands are on [texuli.com/skill/](https://texuli.com/skill/),
built from the same source (`apps/website/src/components/skill/skill.ts`).

What each route has actually been tested to do is in
[SKILL_COMPATIBILITY](SKILL_COMPATIBILITY.md). How releases are cut is in
[RELEASE](RELEASE.md#skill-release).

## Releases and pinning

Skill releases have their own tags, `skill-vX.Y.Z`, apart from the npm
packages (`vX.Y.Z`). Each GitHub Release of the skill carries
`texuli-skill-<version>.tar.gz` (the pack only) and a `SHA256SUMS` over that
archive and every file of the pack. Releases are checksummed, not signed
([TRUST.md](../skills/texuli/TRUST.md#provenance)).

The commands below write `<version>` where a release version goes. Until the
repository has a `skill-v` tag, no skill release is published: use
[route 3](#3-clone-and-setupsh) from a checkout of `main` instead
(`git clone` without `--branch`), and verify the pack's own `SHA256SUMS`.

| Route | Needs | Pinned by |
| --- | --- | --- |
| [1. skills CLI](#1-skills-cli-pinned-to-a-release) | Node.js and `npx` | the release's tree URL |
| [2. OpenClaw](#2-openclaw) | OpenClaw | its registry, or a verified copy |
| [3. Clone and setup.sh](#3-clone-and-setupsh) | `bash` and `git` | the tag, then `--expect-version` |
| [Release archive](#release-archive) | `bash`, `tar`, `shasum` | the release `SHA256SUMS` |

## 1. skills CLI, pinned to a release

The [skills CLI](https://skills.sh) installs into the agents it detects.
Pin the release with its **tree URL**, which names the tag and the pack's
folder:

```bash
npx skills add https://github.com/DailybotHQ/texuli/tree/skill-v<version>/skills/texuli --skill texuli
npx skills add https://github.com/DailybotHQ/texuli/tree/skill-v<version>/skills/texuli --skill texuli -g
```

The first installs into the current project (recorded in its
`skills-lock.json`), the second (`-g`) into your user folders. Add `-y` in a
non-interactive session.

**The `@ref` caveat.** Do not pin with the `owner/repo@ref` shorthand
(`DailybotHQ/texuli@skill-v<version>`). The skills CLI has been
observed to ignore the ref of that form and install the default branch
(reported by the DeepWorkPlan skill, verified with skills 1.7.1). The tree
URL installs the tag. Check the result rather than the CLI's exit code: the
installed `texuli/SKILL.md` must carry `version: "<version>"`.

## 2. OpenClaw

```bash
openclaw skills install texuli
```

This works only once a Texuli entry is listed in OpenClaw's registry; no
entry has been verified yet. Until then, copy a verified `texuli/` folder
(from the [release archive](#release-archive)) into OpenClaw's skills
folder:

```bash
mkdir -p ~/.openclaw/skills
cp -R texuli ~/.openclaw/skills/texuli
```

The router declares its OpenClaw metadata as single-line JSON in its
frontmatter (`metadata: {"openclaw":{…}}`): it needs `bash` and `git`, no
API key and no install step.

## 3. Clone and setup.sh

`setup.sh` verifies the pack, prints its plan, and copies the pack into one
host's folder. It refuses any version other than the one you pin and never
overwrites an unrelated folder:

```bash
git clone --branch skill-v<version> --depth 1 https://github.com/DailybotHQ/texuli.git
cd texuli
./skills/texuli/setup.sh --verify --expect-version <version>
./skills/texuli/setup.sh --host claude --expect-version <version> --dry-run
./skills/texuli/setup.sh --host claude --expect-version <version>
```

The hosts are `claude`, `cursor`, `codex`, `gemini`, `copilot`, `opencode`
and `windsurf`; `./skills/texuli/setup.sh --list-hosts` prints each folder.
`--link` symlinks the checkout instead of copying it (for contributors).

## Release archive

The strongest check: verify the archive and every file against the
release's own `SHA256SUMS` before anything reads them. The steps are in
[`skills/texuli/setup/pinned-install.md`](../skills/texuli/setup/pinned-install.md):

```bash
grep ' texuli-skill-<version>.tar.gz$' SHA256SUMS | shasum -a 256 -c -
tar -xzf texuli-skill-<version>.tar.gz
shasum -a 256 -c SHA256SUMS
./texuli/setup.sh --verify --dir ./texuli --expect-version <version>
```

## Update

Each route updates to a newer release in its own way. Pick the release
first (the skill's [`upgrade` sub-skill](../skills/texuli/upgrade/SKILL.md)
lists the tags and asks before downloading anything):

```bash
npx skills add https://github.com/DailybotHQ/texuli/tree/skill-v<version>/skills/texuli --skill texuli
./skills/texuli/setup.sh --host claude --expect-version <version> --replace --dry-run
./skills/texuli/setup.sh --host claude --expect-version <version> --replace
openclaw skills update texuli
```

With the skills CLI, re-run `add` with the new tree URL rather than its
`update` command, which follows the default branch. `setup.sh --replace`
keeps the previous copy under `~/.texuli/skill-backups/<host>-<UTC stamp>/`.

## Uninstall

```bash
npx skills remove texuli
npx skills remove texuli -g
rm -rf ~/.claude/skills/texuli
openclaw skills remove texuli
```

Use the line that matches how you installed: project or global skills CLI,
a `setup.sh` copy (replace `.claude/skills` with the host's folder from
`--list-hosts`), or OpenClaw. `setup.sh` backups under
`~/.texuli/skill-backups/` are yours to delete.
