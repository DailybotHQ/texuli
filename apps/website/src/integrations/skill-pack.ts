/**
 * Skill-pack surface (T-25): copies `skills/texuli/` into the build as
 * `/skill-pack/` and generates `/.well-known/agent-skills/index.json` from
 * the copied files, so the served pack and its digests can never drift from
 * the repository's pack (the aeo scan's "generate the index" pattern).
 * The index lists every `SKILL.md` in the pack — the router and each
 * sub-skill — with the SHA-256 digest of the served file.
 *
 * Only an allowlist is published (S-8): exactly the files named in the
 * pack's `SHA256SUMS`, plus `SHA256SUMS` itself. Untracked, ignored or
 * scratch files under `skills/texuli/` never reach the site. An entry that
 * leaves the pack, or a listed file that is missing, fails the build.
 */

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const PACK = join(REPO, 'skills/texuli');
const SITE = 'https://texuli.com';

/** Minimal frontmatter reader: the first `key: value` scalars of a SKILL.md. */
function frontmatterOf(markdown: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  if (!match) return {};
  const scalars: Record<string, string> = {};
  for (const line of (match[1] ?? '').split('\n')) {
    const pair = /^([a-z-]+):\s*"?(.+?)"?\s*$/.exec(line);
    if (pair && pair[1] && pair[2]) scalars[pair[1]] = pair[2];
  }
  return scalars;
}

/**
 * The pack-relative paths `SHA256SUMS` lists (`<hex digest>  <path>`, with an
 * optional `*` binary marker). Throws on a malformed line or on a path that
 * is absolute or climbs out of the pack.
 */
export function listedPackFiles(pack: string): string[] {
  const files: string[] = [];
  for (const line of readFileSync(join(pack, 'SHA256SUMS'), 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    const relative = /^[0-9a-f]{64} [ *](.+)$/.exec(line)?.[1];
    if (!relative) throw new Error(`skill pack: malformed SHA256SUMS line: ${line}`);
    const clean = normalize(relative);
    if (isAbsolute(relative) || clean === '..' || clean.startsWith(`..${sep}`)) {
      throw new Error(`skill pack: SHA256SUMS entry outside the pack: ${relative}`);
    }
    files.push(clean.split(sep).join('/'));
  }
  return files;
}

/**
 * Copy the allowlisted pack files into `served`. Returns the pack-relative
 * paths published, `SHA256SUMS` included.
 */
export function publishSkillPack(pack: string, served: string): string[] {
  const published = [...listedPackFiles(pack), 'SHA256SUMS'];
  for (const relative of published) {
    const source = join(pack, relative);
    if (!statSync(source, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`skill pack: SHA256SUMS lists a missing file: ${relative}`);
    }
    const target = join(served, relative);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  return published;
}

export function skillPackIntegration(): AstroIntegration {
  return {
    name: 'texuli-skill-pack',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const served = join(fileURLToPath(dir), 'skill-pack');
        const skills = publishSkillPack(PACK, served)
          .filter((relative) => relative === 'SKILL.md' || relative.endsWith('/SKILL.md'))
          .sort()
          .map((relative) => {
            const content = readFileSync(join(served, relative));
            const meta = frontmatterOf(content.toString('utf8'));
            return {
              name: meta.name ?? relative.replace(/\/SKILL\.md$/, '').replaceAll('/', '-'),
              type: 'skill-md',
              description: meta.description ?? '',
              ...(meta.version ? { version: meta.version } : {}),
              url: `${SITE}/skill-pack/${relative}`,
              digest: `sha256:${createHash('sha256').update(content).digest('hex')}`,
            };
          });
        const wellKnown = join(fileURLToPath(dir), '.well-known/agent-skills');
        mkdirSync(wellKnown, { recursive: true });
        writeFileSync(
          join(wellKnown, 'index.json'),
          `${JSON.stringify({ $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json', skills }, null, 2)}\n`
        );
        logger.info(`Skill pack served at /skill-pack/ (${skills.length} SKILL.md indexed).`);
      },
    },
  };
}
