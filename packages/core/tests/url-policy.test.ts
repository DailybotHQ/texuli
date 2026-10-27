import { describe, expect, it } from 'vitest';
import {
  MAX_DATA_IMAGE_BYTES,
  resolveTrust,
  safeHref,
  safeImageSrc,
  safeImageSrcset,
  safeMediaSrc,
} from '../src/index.ts';

describe('safeHref', () => {
  it('rejects executable and smuggling schemes in every tier', () => {
    for (const trust of ['developer', 'untrusted'] as const) {
      expect(safeHref('javascript:alert(1)', trust)).toBeUndefined();
      expect(safeHref(' JaVaScRiPt:alert(1)', trust)).toBeUndefined();
      expect(safeHref('java\tscript:alert(1)', trust)).toBeUndefined();
      expect(safeHref('vbscript:msgbox(1)', trust)).toBeUndefined();
      expect(safeHref('data:text/html,<b>x</b>', trust)).toBeUndefined();
      expect(safeHref('//evil.example/path', trust)).toBeUndefined();
    }
  });

  it('refuses every slash/backslash authority prefix in every tier (S-10)', () => {
    // Browsers treat `\` like `/` in special URLs, so each of these opens
    // another origin (`/\evil.example` resolves to `https://evil.example/`).
    const hostile = [
      '//evil.example/path',
      '/\\evil.example',
      '\\/evil.example',
      '\\\\evil.example',
      ' /\\evil.example',
      '\t/\\evil.example',
      '\u0000/\\evil.example',
      '\n\\/evil.example',
      '/\t\\evil.example',
      '\\\r\\evil.example',
      '/\u001f/evil.example',
    ];
    for (const trust of ['developer', 'untrusted'] as const) {
      for (const value of hostile) {
        expect(safeHref(value, trust), `${trust} ${JSON.stringify(value)}`).toBeUndefined();
        expect(safeImageSrc(value, trust), `${trust} ${JSON.stringify(value)}`).toBeUndefined();
        expect(safeMediaSrc(value, trust), `${trust} ${JSON.stringify(value)}`).toBeUndefined();
        expect(
          safeImageSrcset(`${value} 1x`, trust),
          `${trust} ${JSON.stringify(value)}`
        ).toBeUndefined();
      }
    }
    // A single leading slash stays a same-origin path.
    expect(safeHref('/docs/button', 'developer')).toBe('/docs/button');
    expect(safeHref('./a//b', 'developer')).toBe('./a//b');
    expect(safeImageSrc('/assets/a.png', 'developer')).toBe('/assets/a.png');
    expect(safeMediaSrc('/media/a.mp4', 'developer')).toBe('/media/a.mp4');
  });

  it('keeps same-document fragments in every tier', () => {
    expect(safeHref('#section-2')).toBe('#section-2');
    expect(safeHref('#section-2', 'developer')).toBe('#section-2');
  });

  it('allows only https and mailto for untrusted content', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('mailto:team@example.com')).toBe('mailto:team@example.com');
    expect(safeHref('http://example.com')).toBeUndefined();
    expect(safeHref('/docs/button')).toBeUndefined();
    expect(safeHref('tel:+15550100')).toBeUndefined();
  });

  it('allows relative paths and other schemes from developers', () => {
    expect(safeHref('/docs/button', 'developer')).toBe('/docs/button');
    expect(safeHref('http://localhost:4321', 'developer')).toBe('http://localhost:4321');
    expect(safeHref('tel:+15550100', 'developer')).toBe('tel:+15550100');
  });

  it('returns undefined for empty or non-string input', () => {
    expect(safeHref('   ')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });
});

describe('safeImageSrc', () => {
  it('allows HTTPS and relative assets for untrusted images', () => {
    expect(safeImageSrc('https://cdn.example.test/image.webp')).toBe(
      'https://cdn.example.test/image.webp'
    );
    expect(safeImageSrc('/assets/image.webp')).toBe('/assets/image.webp');
    expect(safeImageSrc('./assets/image.webp')).toBe('./assets/image.webp');
  });

  it('limits developer sources to image-safe URL forms', () => {
    expect(safeImageSrc('http://localhost/image.png', 'developer')).toBe(
      'http://localhost/image.png'
    );
    expect(safeImageSrc('blob:https://app.example.test/asset-id', 'developer')).toBe(
      'blob:https://app.example.test/asset-id'
    );
    expect(safeImageSrc('mailto:team@example.test', 'developer')).toBeUndefined();
    expect(
      safeImageSrc('https://user:password@example.test/image.png', 'developer')
    ).toBeUndefined();
  });

  it('rejects unsafe schemes, protocol-relative paths and browser-normalized characters', () => {
    for (const value of [
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      '//evil.example/image.png',
      '\\\\evil.example\\image.png',
      'blob:https://app.example.test/id',
      'https://example.test/image.png?name=bad value',
      'https://example.test/" onerror=alert(1)',
    ]) {
      expect(safeImageSrc(value)).toBeUndefined();
    }
  });

  it('allows only bounded base64 raster data images from developers', () => {
    const smallPng = 'data:image/png;base64,iVBORw0KGgo=';
    expect(safeImageSrc(smallPng, 'developer')).toBe(smallPng);
    expect(safeImageSrc(smallPng)).toBeUndefined();
    expect(safeImageSrc('data:image/svg+xml;base64,PHN2Zz4=', 'developer')).toBeUndefined();
    expect(safeImageSrc('data:text/html;base64,PGI+eDwvYj4=', 'developer')).toBeUndefined();

    const atLimitPayload = `${'A'.repeat(4 * Math.ceil(MAX_DATA_IMAGE_BYTES / 3) - 2)}==`;
    expect(safeImageSrc(`data:image/png;base64,${atLimitPayload}`, 'developer')).toBeDefined();
    const overLimitPayload = 'A'.repeat(4 * Math.ceil((MAX_DATA_IMAGE_BYTES + 1) / 3));
    expect(safeImageSrc(`data:image/png;base64,${overLimitPayload}`, 'developer')).toBeUndefined();
  });

  it('fails closed for malformed input and invalid trust values', () => {
    expect(safeImageSrc(undefined)).toBeUndefined();
    expect(safeImageSrc('   ')).toBeUndefined();
    // An unknown trust value is judged as untrusted (resolveTrust), never as developer.
    expect(safeImageSrc('http://example.com/image.png', 'admin' as never)).toBeUndefined();
  });
});

describe('safeMediaSrc', () => {
  const options = { allowedOrigins: ['https://media.example.test'] };

  it('allows only blob URLs and exact allowlisted HTTPS origins for untrusted media', () => {
    expect(safeMediaSrc('blob:https://app.example.test/clip-id')).toBe(
      'blob:https://app.example.test/clip-id'
    );
    expect(safeMediaSrc('https://media.example.test/demo.mp4', 'untrusted', options)).toBe(
      'https://media.example.test/demo.mp4'
    );
    expect(
      safeMediaSrc('https://media.example.test.evil.test/demo.mp4', 'untrusted', options)
    ).toBeUndefined();
    expect(
      safeMediaSrc('https://other.example.test/demo.mp4', 'untrusted', options)
    ).toBeUndefined();
    expect(safeMediaSrc('https://media.example.test/demo.mp4')).toBeUndefined();
  });

  it('rejects insecure, relative, executable and data URLs from untrusted media', () => {
    for (const value of [
      'http://media.example.test/demo.mp4',
      '/demo.mp4',
      '//media.example.test/demo.mp4',
      'javascript:alert(1)',
      'data:video/mp4;base64,AAAA',
      'blob:null/opaque-id',
    ]) {
      expect(safeMediaSrc(value, 'untrusted', options)).toBeUndefined();
    }
  });

  it('permits developer-authored HTTP and relative assets but never data media', () => {
    expect(safeMediaSrc('http://localhost/demo.mp4', 'developer')).toBe(
      'http://localhost/demo.mp4'
    );
    expect(safeMediaSrc('./media/demo.mp4', 'developer')).toBe('./media/demo.mp4');
    expect(safeMediaSrc('data:video/mp4;base64,AAAA', 'developer')).toBeUndefined();
  });

  it('ignores malformed allowlist entries and rejects malformed input', () => {
    expect(
      safeMediaSrc('https://media.example.test/demo.mp4', 'untrusted', {
        allowedOrigins: ['https://media.example.test/path', 'http://media.example.test'],
      })
    ).toBeUndefined();
    expect(safeMediaSrc(23, 'developer')).toBeUndefined();
    expect(
      safeMediaSrc('https://user:password@media.example.test/demo.mp4', 'untrusted', options)
    ).toBeUndefined();
  });
});

describe('safeImageSrcset', () => {
  it('keeps valid density and width candidate sets', () => {
    expect(safeImageSrcset('/small.webp 1x, /large.webp 2x')).toBe(
      '/small.webp 1x, /large.webp 2x'
    );
    expect(safeImageSrcset('/small.webp 320w, /large.webp 640w')).toBe(
      '/small.webp 320w, /large.webp 640w'
    );
    expect(safeImageSrcset('/one.webp, /two.webp 2x')).toBe('/one.webp, /two.webp 2x');
  });

  it('rejects the whole set when any candidate or descriptor is unsafe', () => {
    for (const value of [
      '/safe.webp 1x, javascript:alert(1) 2x',
      '/safe.webp 1x, /other.webp 640w',
      '/safe.webp 0x',
      '/safe.webp -1x',
      '/safe.webp 1.5w',
      '/safe.webp 1x 2x',
      '/safe.webp 1x,,/other.webp 2x',
      '/safe.webp 1x,',
      '/safe.webp 1x, https://example.test/image.webp 1x,',
    ]) {
      expect(safeImageSrcset(value)).toBeUndefined();
    }
    expect(safeImageSrcset(undefined)).toBeUndefined();
    expect(safeImageSrcset(42)).toBeUndefined();
  });
});

describe('untrusted link and image hardening (catalog security review)', () => {
  const ch = (code: number) => String.fromCharCode(code);
  const invisible = [
    0x00ad, 0x200b, 0x200d, 0x200e, 0x202a, 0x202e, 0x2060, 0x2066, 0x2069, 0xfeff,
  ];

  it('refuses credentials before the host in untrusted links (gap 1)', () => {
    expect(safeHref('https://bank.example@evil.example/login', 'untrusted')).toBeUndefined();
    expect(safeHref('https://user:pass@example.com/', 'untrusted')).toBeUndefined();
    // Developer-authored links keep their wider policy.
    expect(safeHref('https://user@example.com/', 'developer')).toBe('https://user@example.com/');
  });

  it('refuses invisible formatting characters anywhere in untrusted links (gap 2)', () => {
    for (const code of invisible) {
      const label = `U+${code.toString(16)}`;
      expect(
        safeHref(`https://ex${ch(code)}ample.com/`, 'untrusted'),
        `host ${label}`
      ).toBeUndefined();
      expect(
        safeHref(`https://example.com/a${ch(code)}b`, 'untrusted'),
        `path ${label}`
      ).toBeUndefined();
      expect(safeHref(`#to${ch(code)}p`, 'untrusted'), `fragment ${label}`).toBeUndefined();
      expect(
        safeHref(`mailto:a${ch(code)}@example.com`, 'untrusted'),
        `mailto ${label}`
      ).toBeUndefined();
    }
  });

  it('requires the authority form for untrusted https links (gap 3)', () => {
    expect(safeHref('https:evil.example', 'untrusted')).toBeUndefined();
    expect(safeHref('https:/evil.example', 'untrusted')).toBeUndefined();
    expect(safeHref('https://', 'untrusted')).toBeUndefined();
    expect(safeHref('HTTPS://Example.com/Docs', 'untrusted')).toBe('HTTPS://Example.com/Docs');
  });

  it('keeps ordinary untrusted links working', () => {
    expect(safeHref('https://example.com/docs?q=1#a', 'untrusted')).toBe(
      'https://example.com/docs?q=1#a'
    );
    expect(safeHref('mailto:hello@example.com', 'untrusted')).toBe('mailto:hello@example.com');
    expect(safeHref('#section-2', 'untrusted')).toBe('#section-2');
  });

  it('refuses scheme look-alikes and invisible characters in untrusted relative images (gap 4)', () => {
    const fullwidth = Array.from('javascript', (c) => ch(c.charCodeAt(0) + 0xfee0)).join('');
    for (const value of [
      `java${ch(0x200b)}script:alert(1)`,
      `${fullwidth}:alert(1)`,
      '&#106;avascript:alert(1)',
      'a:b/c.png',
      `images/te${ch(0x202e)}am.webp`,
    ]) {
      expect(safeImageSrc(value, 'untrusted'), value).toBeUndefined();
    }
    for (const value of ['images/team.webp', './a:b.png', '/assets/hero.avif', 'img/x.png?v=2']) {
      expect(safeImageSrc(value, 'untrusted'), value).toBe(value);
    }
    // The developer tier is unchanged.
    const rlo = `images/te${ch(0x202e)}am.webp`;
    expect(safeImageSrc(rlo, 'developer')).toBe(rlo);
  });
});

describe('resolveTrust: an unknown trust value fails closed to untrusted', () => {
  const odd: unknown[] = [
    'Developer',
    'DEVELOPER',
    ' developer',
    'developer ',
    'admin',
    'trusted',
    '',
    null,
    1,
    true,
    {},
  ];
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==';
  const media = { allowedOrigins: ['https://media.example.test'] };

  /** Inputs only the developer tier accepts. */
  const developerOnly = {
    href: ['/admin/delete-all', 'tel:+15550100', 'https://user@example.com/', 'https:example.com'],
    image: ['http://example.com/a.png', 'blob:https://example.com/0b6f', png],
    media: ['http://example.com/a.mp4', '/media/demo.mp4', 'https://cdn.example.com/a.mp4'],
    srcset: ['http://example.com/a.png 1x', '/a.png 1x, http://example.com/b.png 2x'],
  };
  /** Inputs the untrusted tier accepts. */
  const untrustedOk = {
    href: ['https://example.com/docs', 'mailto:hello@example.com', '#top'],
    image: ['https://example.com/a.png', 'images/team.webp'],
    media: ['https://media.example.test/demo.mp4'],
    srcset: ['images/a.png 1x, https://example.com/b.png 2x'],
  };

  it('maps only the exact string "developer" to developer', () => {
    expect(resolveTrust('developer')).toBe('developer');
    expect(resolveTrust('untrusted')).toBe('untrusted');
    expect(resolveTrust(undefined)).toBe('untrusted');
    for (const value of odd) expect(resolveTrust(value), String(value)).toBe('untrusted');
  });

  it('confirms the developer-only inputs really differ between the tiers', () => {
    for (const value of developerOnly.href) {
      expect(safeHref(value, 'developer'), value).toBe(value);
      expect(safeHref(value, 'untrusted'), value).toBeUndefined();
    }
    for (const value of developerOnly.image)
      expect(safeImageSrc(value, 'developer'), value).toBe(value);
    for (const value of developerOnly.media)
      expect(safeMediaSrc(value, 'developer'), value).toBe(value);
    for (const value of developerOnly.srcset) {
      expect(safeImageSrcset(value, 'developer'), value).toBeDefined();
    }
  });

  it.each(odd.map((value) => [JSON.stringify(value) ?? String(value), value]))(
    'judges every URL policy with trust %s exactly as untrusted',
    (_label, value) => {
      const trust = value as never;
      for (const href of [...developerOnly.href, ...untrustedOk.href]) {
        expect(safeHref(href, trust), href).toBe(safeHref(href, 'untrusted'));
      }
      for (const href of developerOnly.href) expect(safeHref(href, trust), href).toBeUndefined();
      for (const src of [...developerOnly.image, ...untrustedOk.image]) {
        expect(safeImageSrc(src, trust), src).toBe(safeImageSrc(src, 'untrusted'));
      }
      for (const src of untrustedOk.image) expect(safeImageSrc(src, trust), src).toBe(src);
      for (const src of [...developerOnly.media, ...untrustedOk.media]) {
        expect(safeMediaSrc(src, trust, media), src).toBe(safeMediaSrc(src, 'untrusted', media));
      }
      for (const src of developerOnly.media)
        expect(safeMediaSrc(src, trust, media), src).toBeUndefined();
      for (const set of [...developerOnly.srcset, ...untrustedOk.srcset]) {
        expect(safeImageSrcset(set, trust), set).toBe(safeImageSrcset(set, 'untrusted'));
      }
      for (const set of developerOnly.srcset)
        expect(safeImageSrcset(set, trust), set).toBeUndefined();
    }
  );
});
