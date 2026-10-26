/**
 * Skill-pack surface (T-25): copies `skills/texuli/` into the build as
 * `/skill-pack/` and generates `/.well-known/agent-skills/index.json` from
 * the copied files, so the served pack and its digests can never drift from
 * the repository's pack (the aeo scan's "generate the index" pattern).
 * The index lists every `SKILL.md` in the pack — the router and each
 * sub-skill — with the SHA-256 digest of the served file.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
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

/** Every `SKILL.md` under the pack, as pack-relative paths. */
function skillFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'SKILL.md') found.push(full.slice(PACK.length + 1));
    }
  };
  walk(PACK);
  return found.sort();
}

export function skillPackIntegration(): AstroIntegration {
  return {
    name: 'texuli-skill-pack',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const served = join(fileURLToPath(dir), 'skill-pack');
        cpSync(PACK, served, { recursive: true });
        const skills = skillFiles().map((relative) => {
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
