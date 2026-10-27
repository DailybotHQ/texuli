// @vitest-environment node
/**
 * The analytics Trusted Types allowance (PLAN_006 T-100 S-1): the page
 * policy names the `texuli-analytics` policy only on pages that mount the
 * Umami loader tag, so a default (analytics-off) build keeps the single
 * `svelte-trusted-html` allowance byte for byte.
 */
import { describe, expect, it } from 'vitest';
import { ANALYTICS_TRUSTED_TYPES_POLICY, pagePolicy } from '../src/components/security/csp.ts';

const MOUNT =
  '<script src="/umami-loader.js" data-umami-loader data-script-src="/api/umami/script.js" data-website-id="fixture-id" data-host-url="/api/umami" defer></script>';

function directive(policy: string, name: string): string | undefined {
  return policy
    .split('; ')
    .find((entry) => entry.startsWith(`${name} `))
    ?.slice(name.length + 1);
}

describe('pagePolicy trusted-types', () => {
  it('allows only svelte-trusted-html on a page without the analytics mount', () => {
    const html = '<!doctype html><html><head></head><body><p>Hi</p></body></html>';
    expect(directive(pagePolicy(html), 'trusted-types')).toBe('svelte-trusted-html');
  });

  it('adds exactly the texuli-analytics policy on a page that mounts the loader', () => {
    const html = `<!doctype html><html><head>${MOUNT}</head><body></body></html>`;
    const policy = pagePolicy(html);
    expect(ANALYTICS_TRUSTED_TYPES_POLICY).toBe('texuli-analytics');
    expect(directive(policy, 'trusted-types')).toBe('svelte-trusted-html texuli-analytics');
    expect(directive(policy, 'require-trusted-types-for')).toBe("'script'");
    // Nothing else broadens: script-src stays 'self' (the loader is external).
    expect(directive(policy, 'script-src')).toBe("'self'");
    expect(policy).not.toContain("'allow-duplicates'");
  });

  it('ignores the marker when it only appears as escaped text (a code sample)', () => {
    const html =
      '<!doctype html><html><body><pre>&lt;script data-umami-loader&gt;</pre></body></html>';
    expect(directive(pagePolicy(html), 'trusted-types')).toBe('svelte-trusted-html');
  });
});
