/**
 * The Texuli skill page's data, parsed from the skill pack itself
 * (`skills/texuli/`): the router and sub-skill frontmatter, the hosts
 * `setup.sh` installs into, and `SHA256SUMS`. Pure functions; `sources.ts`
 * feeds them the files at build time.
 */

import { REPOSITORY_URL } from '../foundation/site.ts';

/** The `SKILL.md` frontmatter fields the page shows. */
export interface SkillMeta {
  name: string;
  description: string;
  version: string;
  allowedTools: string[];
}

export interface SkillHost {
  /** The `setup.sh --host` value. */
  id: string;
  /** Display name, e.g. "Claude Code". */
  label: string;
  /** The user-level folder, e.g. `~/.claude/skills/texuli/`. */
  folder: string;
}

export interface Checksum {
  hash: string;
  path: string;
}

/** A sub-skill of the pack: its folder, frontmatter and reference files. */
export interface SubSkill extends SkillMeta {
  folder: string;
  references: string[];
}

const unquote = (value: string) => value.trim().replace(/^(['"])(.*)\1$/, '$2');

/** The top-level scalar fields of a `---` YAML frontmatter block. */
export function parseFrontmatter(markdown: string): SkillMeta {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown)?.[1] ?? '';
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = /^([\w-]+):\s*(.*)$/.exec(line);
    if (match?.[1] && match[2] !== undefined) fields[match[1]] = unquote(match[2]);
  }
  return {
    name: fields.name ?? '',
    description: fields.description ?? '',
    version: fields.version ?? '',
    allowedTools: (fields['allowed-tools'] ?? '')
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean),
  };
}

/** `HOSTS` and the `host_dir` case of `setup.sh`: host id → folder under home. */
export function parseSetupHosts(script: string): Array<{ id: string; dir: string }> {
  const ids = (/^HOSTS="([^"]*)"/m.exec(script)?.[1] ?? '').split(/\s+/).filter(Boolean);
  const body = /host_dir\(\)\s*\{([\s\S]*?)\n\}/.exec(script)?.[1] ?? '';
  const dirs = new Map(
    [...body.matchAll(/^\s*([\w-]+)\)\s*echo\s+"([^"]+)"/gm)].map((m) => [m[1], m[2]])
  );
  return ids.map((id) => ({ id, dir: dirs.get(id) ?? '' }));
}

/** The host table of `router/hosts.md`: host id → display name. */
export function parseHostLabels(markdown: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const match of markdown.matchAll(/^\|\s*([^|`]+?)\s*\|\s*`([\w-]+)`\s*\|/gm)) {
    labels.set(match[2] as string, (match[1] as string).trim());
  }
  return labels;
}

/** Hosts in `setup.sh` order, named from `router/hosts.md`. */
export function skillHosts(script: string, hostsMarkdown: string, packName: string): SkillHost[] {
  const labels = parseHostLabels(hostsMarkdown);
  return parseSetupHosts(script).map(({ id, dir }) => ({
    id,
    label: labels.get(id) ?? id,
    folder: `~/${dir}/${packName}/`,
  }));
}

/** `SHA256SUMS` lines (`<hash>  <path>`), in file order. */
export function parseChecksums(text: string): Checksum[] {
  return text
    .split(/\r?\n/)
    .map((line) => /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ hash: match[1] as string, path: match[2] as string }));
}

/** The commands a developer runs for one host, from a Texuli checkout. */
export function hostCommands(host: string, version: string): string[] {
  return [
    './skills/texuli/setup.sh --verify',
    `./skills/texuli/setup.sh --host ${host} --expect-version ${version} --dry-run`,
    `./skills/texuli/setup.sh --host ${host} --expect-version ${version}`,
  ];
}

/** Sub-skills: every `<folder>/SKILL.md` in the pack, with its reference files. */
export function subSkills(
  files: ReadonlyMap<string, string>,
  checksums: readonly Checksum[]
): SubSkill[] {
  return [...files.keys()]
    .filter((path) => /^[\w-]+\/SKILL\.md$/.test(path))
    .sort()
    .map((path) => {
      const folder = path.split('/')[0] as string;
      return {
        folder,
        ...parseFrontmatter(files.get(path) ?? ''),
        references: checksums
          .map((sum) => sum.path)
          .filter((file) => file.startsWith(`${folder}/references/`))
          .map((file) => file.slice(`${folder}/references/`.length)),
      };
    });
}

/** The repository that hosts the pack, and the tag namespace of its releases. */
export const SKILL_REPOSITORY = REPOSITORY_URL;
export const SKILL_TAG_PREFIX = 'skill-v';

/**
 * The newest released version in the pack's Keep-a-Changelog file, or `''`.
 * Only the skill release workflow writes a version section, in the commit it
 * tags, so a section is the build-time proof that a release exists.
 */
export function latestRelease(changelog: string): string {
  return /^## \[(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]/m.exec(changelog)?.[1] ?? '';
}

/** One way to install, update or remove the skill, with its exact commands. */
export interface InstallRoute {
  id: 'skills-cli' | 'openclaw' | 'checkout' | 'update' | 'uninstall';
  title: string;
  commands: string[];
}

/**
 * The install, update and uninstall commands for one released version (or
 * the `<version>` placeholder). docs/SKILL_INSTALLATION.md shows the same
 * commands; scripts/tests/skill-release.test.ts keeps them in step.
 */
export function installRoutes(version: string): InstallRoute[] {
  const tag = `${SKILL_TAG_PREFIX}${version}`;
  const tree = `${SKILL_REPOSITORY}/tree/${tag}/skills/texuli`;
  return [
    {
      id: 'skills-cli',
      title: 'skills CLI, pinned to a release',
      commands: [
        `npx skills add ${tree} --skill texuli`,
        `npx skills add ${tree} --skill texuli -g`,
      ],
    },
    {
      id: 'openclaw',
      title: 'OpenClaw',
      commands: [
        'openclaw skills install texuli',
        'mkdir -p ~/.openclaw/skills',
        'cp -R texuli ~/.openclaw/skills/texuli',
      ],
    },
    {
      id: 'checkout',
      title: 'Clone and setup.sh',
      commands: [
        `git clone --branch ${tag} --depth 1 ${SKILL_REPOSITORY}.git`,
        'cd texuli',
        `./skills/texuli/setup.sh --verify --expect-version ${version}`,
        `./skills/texuli/setup.sh --host claude --expect-version ${version} --dry-run`,
        `./skills/texuli/setup.sh --host claude --expect-version ${version}`,
      ],
    },
    {
      id: 'update',
      title: 'Update to a newer release',
      commands: [
        `npx skills add ${tree} --skill texuli`,
        `./skills/texuli/setup.sh --host claude --expect-version ${version} --replace --dry-run`,
        `./skills/texuli/setup.sh --host claude --expect-version ${version} --replace`,
        'openclaw skills update texuli',
      ],
    },
    {
      id: 'uninstall',
      title: 'Uninstall',
      commands: [
        'npx skills remove texuli',
        'npx skills remove texuli -g',
        'rm -rf ~/.claude/skills/texuli',
        'openclaw skills remove texuli',
      ],
    },
  ];
}
