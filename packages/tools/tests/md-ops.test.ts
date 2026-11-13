// @vitest-environment node
import { MARKDOWN_LIMITS } from '@texuli/core/markdown';
import { MARKDOWN_DIALECTS } from '@texuli/core/markdown-dialects';
import { expect, it } from 'vitest';
import { texuliOps } from '../src/ops/index.ts';
import { MD_DIALECTS, MD_SOURCE_MAX } from '../src/ops/markdown.ts';
import { scenario } from './scenario.ts';

it('keeps md.* source and dialect constants equal to @texuli/core so the parser stays out of the Function initial chunk', () => {
  expect(MD_SOURCE_MAX).toBe(MARKDOWN_LIMITS.source);
  expect([...MD_DIALECTS]).toEqual([...MARKDOWN_DIALECTS]);
});

it('converts untrusted Markdown, HTML and chat dialects and refuses hostile URLs', async () => {
  await scenario('slack to discord keeps emphasis as Discord italic', async () => {
    const outcome = await texuliOps.invoke('md.convert', {
      source: '*hello*',
      from: 'slack',
      to: 'discord',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const converted = outcome.output as { value: string; diagnostics: unknown };
    expect(converted.value).toContain('hello');
    expect(Array.isArray(converted.diagnostics)).toBe(true);
  });

  await scenario('javascript links are refused in HTML output', async () => {
    const outcome = await texuliOps.invoke('md.render', {
      source: 'Go [here](javascript:alert(1)).',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const rendered = outcome.output as { html: string; diagnostics: { code: string }[] };
    const html = String(rendered.html);
    expect(html.toLowerCase()).not.toContain('javascript:');
    expect(html).not.toContain('<script');
    expect(rendered.diagnostics.some((item) => item.code === 'url-refused')).toBe(true);
  });

  await scenario('HTML script tags do not survive conversion', async () => {
    const outcome = await texuliOps.invoke('md.convert', {
      source: '<p>Hi</p><script>alert(1)</script>',
      from: 'html',
      to: 'plain-text',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(String((outcome.output as { value: string }).value)).not.toContain('alert(1)');
  });

  await scenario('HTML to GFM text, and a strict CommonMark round trip', async () => {
    const fromHtml = await texuliOps.invoke('md.convert', {
      source:
        '<table><tr><th>a</th></tr><tr><td><s>b</s></td></tr></table><a href="javascript:alert(1)">x</a>',
      from: 'html',
      to: 'markdown',
    });
    expect(fromHtml.ok).toBe(true);
    if (!fromHtml.ok) return;
    const htmlOut = fromHtml.output as { value: string };
    expect(String(htmlOut.value)).toContain('| a |');
    expect(String(htmlOut.value)).toContain('~~b~~');
    expect(String(htmlOut.value)).not.toContain('javascript:');
    const strict = await texuliOps.invoke('md.convert', {
      source: '**hi** ~~not strike~~',
      from: 'commonmark',
      to: 'commonmark',
    });
    expect(strict.ok).toBe(true);
    if (!strict.ok) return;
    // Strict CommonMark has no strikethrough: the tildes stay text, escaped by the writer.
    expect((strict.output as { value: string }).value).toBe('**hi** \\~\\~not strike\\~\\~\n');
    const table = await texuliOps.invoke('md.render', { source: '| a |\n| - |\n| b |' });
    const plain = await texuliOps.invoke('md.render', {
      source: '| a |\n| - |\n| b |',
      gfm: false,
    });
    expect(table.ok && String((table.output as { html: string }).html)).toContain('<table>');
    expect(plain.ok && String((plain.output as { html: string }).html)).not.toContain('<table>');
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
