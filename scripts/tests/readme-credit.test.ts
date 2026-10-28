// @vitest-environment node
/**
 * PLAN_007 T-dailybot-credit: every README a reader lands on (the root, each
 * package, each app and the native twin) carries a subtle "Powered by
 * Dailybot" credit, a dailybot.com link tagged utm_source=dailybotopensource.
 * Only READMEs that exist are checked, so a package without a README yet is
 * not a failure here.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Markdown links to dailybot.com that carry the open-source utm_source. */
const CREDIT =
  /\]\(https:\/\/www\.dailybot\.com\/?\?(?:[^)\s]*&)?utm_source=dailybotopensource(?:&[^)\s]*)?\)/;

function readmes(): string[] {
  const found = [join(ROOT, 'README.md'), join(ROOT, 'native/README.md')];
  for (const group of ['packages', 'apps']) {
    for (const entry of readdirSync(join(ROOT, group), { withFileTypes: true })) {
      if (entry.isDirectory()) found.push(join(ROOT, group, entry.name, 'README.md'));
    }
  }
  return found.filter((path) => existsSync(path));
}

describe('README Dailybot credit', () => {
  it('links every existing README to dailybot.com with utm_source=dailybotopensource', () => {
    const files = readmes();
    // The root, native, both apps and the packages that have READMEs today.
    expect(files.length).toBeGreaterThanOrEqual(20);
    const missing = files
      .filter((path) => !CREDIT.test(readFileSync(path, 'utf8')))
      .map((path) => relative(ROOT, path));
    expect(missing).toEqual([]);
  });

  it('matches only a tagged dailybot.com link', () => {
    const tagged =
      '[Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli)';
    expect(CREDIT.test(tagged)).toBe(true);
    expect(CREDIT.test('[Dailybot](https://www.dailybot.com)')).toBe(false);
    expect(
      CREDIT.test(
        '[Dailybot](https://evil.example/?u=www.dailybot.com&utm_source=dailybotopensource)'
      )
    ).toBe(false);
  });
});
