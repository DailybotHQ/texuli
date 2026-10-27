/**
 * The skill pack's files, inlined by Vite when the site builds. Nothing is
 * read or fetched when the page is served.
 */
import { createHash } from 'node:crypto';
import {
  type Checksum,
  latestRelease,
  parseChecksums,
  parseFrontmatter,
  type SkillHost,
  type SkillMeta,
  type SubSkill,
  skillHosts,
  subSkills,
} from './skill.ts';

const RAW = import.meta.glob<string>('../../../../../skills/texuli/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Pack-relative path → contents. */
const FILES = new Map(
  Object.entries(RAW).map(([path, text]) => [path.replace(/^.*\/skills\/texuli\//, ''), text])
);

const file = (path: string) => FILES.get(path) ?? '';

export const PACK_NAME = 'texuli';
export const ROUTER: SkillMeta = parseFrontmatter(file('SKILL.md'));
export const CHECKSUMS: Checksum[] = parseChecksums(file('SHA256SUMS'));
export const HOSTS: SkillHost[] = skillHosts(file('setup.sh'), file('router/hosts.md'), PACK_NAME);
export const SUB_SKILLS: SubSkill[] = subSkills(FILES, CHECKSUMS);
/** The newest `skill-vX.Y.Z` release recorded in the pack's CHANGELOG.md, or `''`. */
export const RELEASED: string = latestRelease(file('CHANGELOG.md'));

/** SHA-256 of `SHA256SUMS` itself, to compare with a release's copy at a glance. */
export const SUMS_SHA256 = createHash('sha256').update(file('SHA256SUMS')).digest('hex');
