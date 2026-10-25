/**
 * The Texuli skill page's data, parsed from the skill pack itself
 * (`skills/texuli/`): the router and sub-skill frontmatter, the hosts
 * `setup.sh` installs into, and `SHA256SUMS`. Pure functions; `sources.ts`
 * feeds them the files at build time.
 */

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
