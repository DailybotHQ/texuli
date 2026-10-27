// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '../src/components/seo/json-ld.ts';

describe('serializeJsonLd (S-7)', () => {
  it('cannot close the script element or open a comment', () => {
    const data = { name: '</script><script>alert(1)</script>', note: '<!-- x -->' };
    const out = serializeJsonLd(data);
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out.toLowerCase()).not.toContain('</script');
    expect(out).toContain('\\u003c/script\\u003e');
  });

  it('escapes &, U+2028 and U+2029', () => {
    const out = serializeJsonLd({ a: 'Tom & Jerry', b: 'x\u2028y\u2029z' });
    expect(out).not.toMatch(/[&\u2028\u2029]/);
    expect(out).toContain('\\u0026');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
  });

  it('round-trips to the same data through JSON.parse', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'A </script> & <b> title \u2028 here',
      list: [1, true, null, { url: 'https://example.com/?a=1&b=2' }],
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('leaves plain data byte-identical to JSON.stringify', () => {
    const data = { '@type': 'Organization', name: 'Texuli', url: 'https://texuli.com' };
    expect(serializeJsonLd(data)).toBe(JSON.stringify(data));
  });
});
