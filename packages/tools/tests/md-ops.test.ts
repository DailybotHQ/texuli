// @vitest-environment node
import { expect, it } from 'vitest';
import { texuliOps } from '../src/ops/index.ts';
import { scenario } from './scenario.ts';

it('converts untrusted Markdown, HTML and chat dialects and refuses hostile URLs', async () => {
  await scenario('slack to discord keeps emphasis as Discord italic', async () => {
    const outcome = await texuliOps.invoke('md.convert', {
      source: '*hello*',
      from: 'slack',
      to: 'discord',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.output.value).toContain('hello');
    expect(Array.isArray(outcome.output.diagnostics)).toBe(true);
  });

  await scenario('javascript links are refused in HTML output', async () => {
    const outcome = await texuliOps.invoke('md.render', {
      source: 'Go [here](javascript:alert(1)).',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const html = String(outcome.output.html);
    expect(html.toLowerCase()).not.toContain('javascript:');
    expect(html).not.toContain('<script');
    expect(
      (outcome.output.diagnostics as { code: string }[]).some((item) => item.code === 'url-refused')
    ).toBe(true);
  });

  await scenario('HTML script tags do not survive conversion', async () => {
    const outcome = await texuliOps.invoke('md.convert', {
      source: '<p>Hi</p><script>alert(1)</script>',
      from: 'html',
      to: 'plain-text',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(String(outcome.output.value)).not.toContain('alert(1)');
  });

  await scenario('CommonMark text output is planned', async () => {
    const outcome = await texuliOps.invoke('md.convert', {
      source: '**hi**',
      from: 'commonmark',
      to: 'commonmark',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.output.value).toBe('');
    expect(
      (outcome.output.diagnostics as { code: string; message: string }[]).some(
        (item) => item.code === 'unsupported-construct' && /planned/i.test(item.message)
      )
    ).toBe(true);
  });

  await scenario('trust cannot be raised: no developer argument', async () => {
    const outcome = await texuliOps.invoke('md.render', {
      source: 'x',
      trust: 'developer',
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error.code).toBe('invalid-input');
  });
});
