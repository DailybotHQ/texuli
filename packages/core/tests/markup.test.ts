// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { el as slidesEl, serializeXml as slidesSerializeXml } from '../../slides/src/export/xml.ts';
import {
  el,
  escapeMarkupAttribute,
  escapeMarkupText,
  imageUrl,
  isMarkupUrl,
  linkUrl,
  type MarkupElement,
  type MarkupUrl,
  sanitizeMarkupChars,
  serializeHtml,
  serializeXml,
  text,
} from '../src/markup/index.ts';

const HOSTILE_TEXT = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  "' onmouseover='alert(1)",
  ']]><!--',
  '&lt;already&gt; &amp;',
  '</p><p>',
  '\u0000\u0001\u0008\u000b\u001f￾￿',
  '\ud800 lone \udc00',
];

describe('core/markup: escaping by construction', () => {
  it('escapes every hostile text and attribute value, in XML and HTML', () => {
    for (const value of HOSTILE_TEXT) {
      const node = el('p', { title: value, 'data-x': value }, value, text(value));
      for (const out of [serializeXml(node, { declaration: false }), serializeHtml(node)]) {
        // One element: the hostile value opened no tag and closed no attribute.
        // One element whose attribute values never close early: the value opened no tag.
        expect(out, value).toMatch(/^<p title="[^"'<>]*" data-x="[^"'<>]*">[^<>]*<\/p>$/);
        // biome-ignore lint/suspicious/noControlCharactersInRegex: checking the controls is the point.
        expect(out).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/);
        expect(out).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
      }
    }
    expect(escapeMarkupText('a<b>&c')).toBe('a&lt;b&gt;&amp;c');
    expect(escapeMarkupAttribute(`"'\t\n\r`)).toBe('&quot;&apos;&#9;&#10;&#13;');
    expect(sanitizeMarkupChars('ok 😀 \u0007')).toBe('ok 😀 ');
  });

  it('refuses bad element and attribute names when building and when serializing', () => {
    for (const name of ['', 'p onload', 'p>', '1p', 'a:b:c', 'x"', 'p/']) {
      expect(() => el(name), name).toThrow(TypeError);
      expect(() => el('p', { [name]: 'v' }), name).toThrow(TypeError);
    }
    // A hand-built node cannot smuggle markup through its name.
    const forged = {
      kind: 'element',
      name: 'p><script>alert(1)</script',
      attributes: [],
      children: [],
    } as unknown as MarkupElement;
    expect(() => serializeXml(el('root', {}, forged))).toThrow(TypeError);
    expect(() => serializeHtml(el('div', {}, forged))).toThrow(TypeError);
    const forgedAttribute = {
      kind: 'element',
      name: 'p',
      attributes: [['x="1" onclick', 'y']],
      children: [],
    } as unknown as MarkupElement;
    expect(() => serializeXml(forgedAttribute)).toThrow(TypeError);
    expect(() => el('p', { n: Number.NaN })).toThrow(TypeError);
  });

  it('applies the XML allowlist to elements and attributes', () => {
    const allow = (name: string) => name.startsWith('w:');
    expect(serializeXml(el('w:p', { 'w:val': 1 }), { allow, declaration: false })).toBe(
      '<w:p w:val="1"/>'
    );
    expect(() => serializeXml(el('w:p', {}, el('x:evil')), { allow })).toThrow(/not allowed/);
    expect(() => serializeXml(el('w:p', { evil: '1' }), { allow })).toThrow(/not allowed/);
  });

  it('writes only allowlisted HTML: no scripts, styles, frames, handlers or srcdoc', () => {
    for (const name of [
      'script',
      'style',
      'iframe',
      'object',
      'embed',
      'svg',
      'template',
      'form',
      'base',
      'link',
    ]) {
      expect(() => serializeHtml(el(name)), name).toThrow(/not allowed/);
    }
    for (const name of ['onclick', 'onload', 'srcdoc', 'http-equiv']) {
      expect(() => serializeHtml(el('div', { [name]: 'x' })), name).toThrow(/not allowed/);
    }
    expect(() => serializeHtml(el('br', {}, 'child'))).toThrow(/no children/);
    expect(
      serializeHtml(el('p', { hidden: true, translate: false, class: 'a' }, el('br'), 'x'), {
        doctype: true,
      })
    ).toBe('<!doctype html><p hidden class="a"><br>x</p>');
  });
});

describe('core/markup: URLs through the policy', () => {
  it('accepts URL attributes only from linkUrl and imageUrl, with an explicit tier', () => {
    const safe = linkUrl('https://example.com/a?b=1&c="2"', 'untrusted');
    expect(safe).not.toBeNull();
    expect(serializeHtml(el('a', { href: safe }, 'x'))).toBe(
      '<a href="https://example.com/a?b=1&amp;c=&quot;2&quot;">x</a>'
    );
    for (const hostile of [
      'javascript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>',
      '//evil.example',
      '/\\evil.example',
      'vbscript:x',
    ]) {
      expect(linkUrl(hostile, 'untrusted'), hostile).toBeNull();
      expect(linkUrl(hostile, 'developer'), hostile).toBeNull();
    }
    // The untrusted tier is stricter than the developer tier.
    expect(linkUrl('/docs/button', 'untrusted')).toBeNull();
    expect(linkUrl('/docs/button', 'developer')?.value).toBe('/docs/button');
    expect(imageUrl('data:image/svg+xml,<svg onload=alert(1)>', 'developer')).toBeNull();
    expect(imageUrl('https://example.com/a.png', 'untrusted')?.value).toBe(
      'https://example.com/a.png'
    );
    // A plain string or a forged URL object never reaches a URL attribute.
    expect(() => serializeHtml(el('a', { href: 'https://example.com' }))).toThrow(/linkUrl/);
    const forged = { kind: 'url', value: 'javascript:alert(1)' } as MarkupUrl;
    expect(isMarkupUrl(forged)).toBe(false);
    expect(() => el('a', { href: forged })).toThrow(/unchecked URL/);
    const forgedNode = {
      kind: 'element',
      name: 'a',
      attributes: [['href', forged]],
      children: [],
    } as unknown as MarkupElement;
    expect(() => serializeHtml(forgedNode)).toThrow(/linkUrl/);
    expect(() => serializeXml(forgedNode)).toThrow(/Unchecked URL/);
    expect(serializeXml(el('Relationship', { Target: safe }), { declaration: false })).toContain(
      'Target="https://example.com/a?b=1&amp;c=&quot;2&quot;"'
    );
  });
});

describe('core/markup: bounded work on hostile input', () => {
  it('serializes a very deep tree without recursion', () => {
    let node = el('d', {}, 'leaf');
    for (let depth = 0; depth < 50_000; depth += 1) node = el('d', {}, node);
    const out = serializeXml(node, { declaration: false });
    expect(out.length).toBe(50_001 * 7 + 4);
    let nested: unknown[] = ['deep'];
    for (let depth = 0; depth < 50_000; depth += 1) nested = [nested];
    expect(serializeHtml(el('p', {}, nested as never))).toBe('<p>deep</p>');
  });

  it('escapes a megabyte of markup characters in linear time', { retry: 2 }, () => {
    // This thread's CPU time (ms), not wall-clock: time spent waiting for a
    // core while parallel lanes run is not the escaper's cost. A single
    // wall-clock N-to-10N ratio flaked under load (392 ms against 210 ms).
    const cpu = () => {
      const { user, system } = process.threadCpuUsage();
      return (user + system) / 1000;
    };
    const time = (value: string) => {
      const start = cpu();
      serializeXml(el('p', { a: value }, value));
      return cpu() - start;
    };
    // Four doublings up to a megabyte, interleaved fastest-of-five so a spike
    // hits every size alike; the growth exponent (least-squares slope of log
    // time over log size) is about 1 when linear and 2 when quadratic.
    const sizes = [25_000, 50_000, 100_000, 200_000];
    const sources = sizes.map((count) => '<&>"\''.repeat(count));
    const best = sizes.map(() => Number.POSITIVE_INFINITY);
    for (let k = 0; k < 5; k += 1) {
      for (const [i, source] of sources.entries())
        best[i] = Math.min(best[i] as number, time(source));
    }
    const xs = sizes.map(Math.log);
    const ys = best.map((ms) => Math.log(Math.max(ms, 0.05)));
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0;
    let sxx = 0;
    for (const [i, x] of xs.entries()) {
      sxy += (x - mx) * ((ys[i] as number) - my);
      sxx += (x - mx) ** 2;
    }
    const slope = sxy / sxx;
    const detail = `${best.map((ms) => ms.toFixed(1)).join(' -> ')} ms CPU, slope ${slope.toFixed(2)}`;
    expect(best[best.length - 1] as number, detail).toBeLessThan(2_000);
    expect(slope, detail).toBeLessThan(1.5);
  });
});

describe('core/markup: identical output to the slides XML writer', () => {
  it('serializes the same trees byte for byte until slides moves onto core', () => {
    const build = (make: typeof el) =>
      make(
        'p:sld',
        { 'xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main', dirty: false },
        make('a:t', { lang: 'en-US', sz: 1800, b: true, skip: undefined }, 'Tom & "Jerry" <3'),
        make('a:br'),
        null,
        false,
        '\u0007tail\t\n'
      );
    expect(serializeXml(build(el))).toBe(
      slidesSerializeXml(build(slidesEl as unknown as typeof el) as never)
    );
  });
});
