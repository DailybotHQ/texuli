// @vitest-environment node
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { publishSkillPack } from '../src/integrations/skill-pack.ts';

const PACK = fileURLToPath(new URL('../../../skills/texuli', import.meta.url));

function listed(pack: string): string[] {
  return readFileSync(join(pack, 'SHA256SUMS'), 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.replace(/^[0-9a-f]{64}\s+\*?/, ''));
}

function filesUnder(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full, base) : [full.slice(base.length + 1)];
  });
}

const temps: string[] = [];
function temp(): string {
  const dir = mkdtempSync(join(tmpdir(), 'texuli-skill-pack-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('publishSkillPack (S-8)', () => {
  it('publishes exactly the SHA256SUMS files, never an untracked extra', () => {
    const pack = join(temp(), 'texuli');
    cpSync(PACK, pack, { recursive: true });
    writeFileSync(join(pack, 'secret-notes.md'), 'not for publication\n');
    mkdirSync(join(pack, '.cache'), { recursive: true });
    writeFileSync(join(pack, '.cache', 'scratch.json'), '{}\n');
    writeFileSync(join(pack, 'router', 'draft.md'), 'draft\n');

    const served = join(temp(), 'skill-pack');
    const published = publishSkillPack(pack, served);

    const expected = [...listed(pack), 'SHA256SUMS'].sort();
    expect(filesUnder(served).sort()).toEqual(expected);
    expect(published.sort()).toEqual(expected);
    expect(existsSync(join(served, 'secret-notes.md'))).toBe(false);
    expect(existsSync(join(served, '.cache'))).toBe(false);
    expect(existsSync(join(served, 'router', 'draft.md'))).toBe(false);
    for (const relative of listed(pack)) {
      expect(readFileSync(join(served, relative))).toEqual(readFileSync(join(pack, relative)));
    }
  });

  it('serves files whose digests match the published SHA256SUMS', () => {
    const served = join(temp(), 'skill-pack');
    publishSkillPack(PACK, served);
    for (const line of readFileSync(join(served, 'SHA256SUMS'), 'utf8').split('\n')) {
      const match = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line);
      if (!match?.[1] || !match[2]) continue;
      const digest = createHash('sha256')
        .update(readFileSync(join(served, match[2])))
        .digest('hex');
      expect(digest, match[2]).toBe(match[1]);
    }
  });

  it('refuses a SHA256SUMS entry that escapes the pack', () => {
    const root = temp();
    const pack = join(root, 'texuli');
    mkdirSync(pack, { recursive: true });
    writeFileSync(join(root, 'outside.txt'), 'outside\n');
    writeFileSync(join(pack, 'SHA256SUMS'), `${'0'.repeat(64)}  ../outside.txt\n`);
    const served = join(temp(), 'skill-pack');
    expect(() => publishSkillPack(pack, served)).toThrow(/outside the pack/);
    expect(existsSync(join(dirname(served), 'outside.txt'))).toBe(false);
  });

  it('fails the build when a listed file is missing', () => {
    const pack = join(temp(), 'texuli');
    mkdirSync(pack, { recursive: true });
    writeFileSync(join(pack, 'SHA256SUMS'), `${'0'.repeat(64)}  SKILL.md\n`);
    expect(() => publishSkillPack(pack, join(temp(), 'skill-pack'))).toThrow(/SKILL\.md/);
  });
});
