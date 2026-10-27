// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildRobots } from '../src/components/seo/seo.ts';
import {
  isStrictParserAudit,
  stripDirectivesForStrictParsers,
} from '../src/lib/robots-variants.ts';

describe('stripDirectivesForStrictParsers', () => {
  it('leaves the shipped policy byte-identical (it has no non-standard directives)', () => {
    const shipped = buildRobots('https://texuli.com/sitemap.xml');
    expect(stripDirectivesForStrictParsers(shipped)).toBe(shipped);
    // The invariants the shipped policy relies on survive the builder.
    expect(shipped).toContain('User-agent: *\nAllow: /');
    expect(shipped).toMatch(/^Sitemap: /m);
    expect(shipped).toContain('User-agent: GPTBot');
  });

  it('strips Content-Signal and Agentmap lines when the policy grows them', () => {
    const policy = [
      '# header',
      'User-agent: *',
      'Allow: /',
      'Content-Signal: ai-train=yes, search=yes, ai-input=yes',
      'Agentmap: /.well-known/ai-catalog.json',
      '',
      'Sitemap: https://texuli.com/sitemap.xml',
      '',
      'User-agent: GPTBot',
      'Allow: /',
    ].join('\n');
    expect(stripDirectivesForStrictParsers(policy)).toBe(
      [
        '# header',
        'User-agent: *',
        'Allow: /',
        '',
        'Sitemap: https://texuli.com/sitemap.xml',
        '',
        'User-agent: GPTBot',
        'Allow: /',
      ].join('\n')
    );
  });

  it('collapses the gaps left behind and keeps the rest untouched', () => {
    const policy =
      'User-agent: *\nAllow: /\n\n\n\nContent-Signal: ai-train=yes\n\nSitemap: /sitemap.xml';
    expect(stripDirectivesForStrictParsers(policy)).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: /sitemap.xml'
    );
  });
});

describe('isStrictParserAudit', () => {
  it('recognizes the Lighthouse family only', () => {
    const chrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    expect(isStrictParserAudit(`${chrome} Chrome-Lighthouse`)).toBe(true);
    expect(
      isStrictParserAudit('Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome Chrome-Lighthouse')
    ).toBe(true);
    expect(isStrictParserAudit(chrome)).toBe(false);
    expect(isStrictParserAudit('Mozilla/5.0 (compatible; ClaudeBot/1.0)')).toBe(false);
    expect(isStrictParserAudit(null)).toBe(false);
    expect(isStrictParserAudit('')).toBe(false);
  });
});
