// @vitest-environment node
import { expect, it } from 'vitest';
import { texuliEdgeOps } from '../src/ops/edge.ts';
import { texuliOps } from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

function payload(outcome: { ok: true; output: unknown }): Record<string, unknown> {
  return outcome.output as Record<string, unknown>;
}

it('searches, reads, converts and lists untrusted emoji without throwing', async () => {
  await scenario('search finds rocket by keyword', async () => {
    const outcome = await texuliOps.invoke('emoji.search', { query: 'launch', limit: 3 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const items = payload(outcome).items as { id: string; shortcode: string; score: number }[];
    expect(items[0]?.id).toBe('1f680');
    expect(items[0]?.shortcode).toBe(':rocket:');
  });

  await scenario('get returns a closed id-based record', async () => {
    const byId = await texuliOps.invoke('emoji.get', { id: '1f680' });
    const byShortcode = await texuliOps.invoke('emoji.get', { id: ':rocket:' });
    expect(byId.ok && byShortcode.ok).toBe(true);
    if (!byId.ok || !byShortcode.ok) return;
    expect(payload(byId).emoji).toMatchObject({
      id: '1f680',
      shortcode: ':rocket:',
      category: 'travel-places',
    });
    expect(payload(byShortcode).emoji).toMatchObject({ id: '1f680' });
    expect(
      Object.keys(payload(byId).emoji as Record<string, unknown>).some((key) =>
        ['keywords', 'aliases', 'artResolver'].includes(key)
      )
    ).toBe(false);
  });

  await scenario('unknown ids are not-found; extra props are refused', async () => {
    const missing = await texuliOps.invoke('emoji.get', { id: 'not-an-emoji' });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('not-found');
    const hostile = await texuliOps.invoke('emoji.get', {
      id: '1f680',
      artResolver: 'https://evil.example/x.svg',
    });
    expect(hostile.ok).toBe(false);
    if (hostile.ok) return;
    expect(hostile.error.code).toBe('invalid-input');
  });

  await scenario('canonical convert and legacy dialect with strict conflicts', async () => {
    const rocket = await texuliOps.invoke('emoji.convert', {
      source: 'Ship it :rocket:!',
      to: 'unicode',
    });
    expect(rocket.ok).toBe(true);
    if (!rocket.ok) return;
    expect(payload(rocket).value).toBe('Ship it 🚀!');
    const party = await texuliOps.invoke('emoji.convert', {
      source: ':tada:',
      to: 'unicode',
      dialect: 'legacy',
    });
    expect(party.ok && payload(party).value).toBe('🎉');
    const conflict = await texuliOps.invoke('emoji.convert', {
      source: ':pa:',
      to: 'unicode',
      dialect: 'legacy',
      mode: 'strict',
    });
    expect(conflict.ok).toBe(true);
    if (!conflict.ok) return;
    expect(payload(conflict).value).toBe(':pa:');
    expect(
      (payload(conflict).diagnostics as { code: string }[]).some(
        (item) => item.code === 'conflict-alias'
      )
    ).toBe(true);
    const permissive = await texuliOps.invoke('emoji.convert', {
      source: ':pa:',
      to: 'unicode',
      dialect: 'legacy',
      mode: 'permissive',
    });
    expect(permissive.ok && String(payload(permissive).value)).not.toBe(':pa:');
  });

  await scenario('categories and variants stay closed and capped', async () => {
    const categories = await texuliOps.invoke('emoji.categories', {});
    expect(categories.ok).toBe(true);
    if (!categories.ok) return;
    const list = payload(categories).categories as { id: string; count: number }[];
    expect(list.map((item) => item.id)).toEqual([
      'smileys-emotion',
      'people-body',
      'animals-nature',
      'food-drink',
      'travel-places',
      'activities',
      'objects',
      'symbols',
      'flags',
    ]);
    expect(list.every((item) => item.count > 0)).toBe(true);
    const variants = await texuliOps.invoke('emoji.variants', { id: '1f44d' });
    expect(variants.ok).toBe(true);
    if (!variants.ok) return;
    expect((payload(variants).base as { id: string }).id).toBe('1f44d');
    expect((payload(variants).variants as { id: string }[]).length).toBeGreaterThan(0);
  });

  await scenario(
    'the edge convert refuses the legacy dialect with a local-MCP diagnostic',
    async () => {
      expect(texuliEdgeOps.get('emoji.convert')?.runtime).toBe('edge');
      const outcome = await texuliEdgeOps.invoke('emoji.convert', {
        source: ':tada:',
        to: 'unicode',
        dialect: 'legacy',
      });
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) return;
      const output = payload(outcome);
      expect(output.value).toBe(':tada:');
      expect(
        (output.diagnostics as { code: string; message: string }[]).some(
          (item) => item.code === 'legacy-local-only' && item.message.includes('npx -y @texuli/mcp')
        )
      ).toBe(true);
    }
  );

  await scenario('markup and URLs in convert source stay plain text', async () => {
    const outcome = await texuliOps.invoke('emoji.convert', {
      source: '<script>alert(1)</script> :rocket: javascript:alert(1)',
      to: 'unicode',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(String(payload(outcome).value)).toContain('<script>alert(1)</script>');
    expect(String(payload(outcome).value)).toContain('javascript:alert(1)');
    expect(String(payload(outcome).value)).toContain('🚀');
  });
});
