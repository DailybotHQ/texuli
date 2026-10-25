# Pinned install, verify and upgrade

Install **one exact version** of the Texuli skill and prove the files are the
released ones before any host reads them. Every command below runs offline:
the download is a manual step you do once, and nothing here fetches anything.

The skill's version is the quoted `version:` in [`../SKILL.md`](../SKILL.md)
(`./skills/texuli/setup.sh --version` prints it). `--expect-version` makes
`setup.sh` refuse, with exit 1 and nothing changed, when the pack is any
other version.

## 1. Get the release files (manual, once)

From the Texuli GitHub Release for the version you pin (for example
`v0.1.0`), download two assets into an empty folder:

- the skill archive, `texuli-skill-<version>.tar.gz`;
- that release's `SHA256SUMS` for the skill.

Do not take `SHA256SUMS` from anywhere but the same release.

## 2. Verify before installing

Unpack, then check every file against the release's checksums and the
pinned version:

```bash
tar -xzf texuli-skill-<version>.tar.gz
./texuli/setup.sh --verify --dir ./texuli --sums ./SHA256SUMS --expect-version <version>
```

`--verify` fails on any changed, missing or unlisted file, and on a version
that is not the one you pinned. In a Texuli checkout, verify the pack
itself:

```bash
./skills/texuli/setup.sh --verify --expect-version <version>
```

## 3. Install the pinned version

Show the plan first, then install into one host (the destinations are in
[`../router/hosts.md`](../router/hosts.md)):

```bash
./skills/texuli/setup.sh --host claude --expect-version <version> --dry-run
./skills/texuli/setup.sh --host claude --expect-version <version>
```

Use `--home <dir>` to install under another home. An existing different
Texuli version is refused unless you also pass `--replace`; an unrelated
folder at the destination is always refused.

## 4. Upgrade to a new pin

Repeat steps 1 and 2 for the new version, then replace explicitly. The
previous copy is kept as a backup:

```bash
./skills/texuli/setup.sh --host claude --expect-version <new-version> --replace --dry-run
./skills/texuli/setup.sh --host claude --expect-version <new-version> --replace
```

Backups go to `~/.texuli/skill-backups/<host>-<UTC stamp>/texuli`. To roll
back, move a backup into the host's skills folder, then verify it with
`--verify --dir <that folder> --expect-version <old-version>`.

## Check the checksums yourself

`SHA256SUMS` lists one `sha256  path` line per file of the pack. Without
`setup.sh`, the same check is:

```bash
cd texuli && shasum -a 256 -c ../SHA256SUMS
```

On Linux, `sha256sum -c` does the same. Maintainers regenerate the pack's
own `SHA256SUMS` after an intentional edit with
`pnpm exec tsx scripts/check-skill.ts --write-sums`, and `pnpm check:skill`
validates the result.
