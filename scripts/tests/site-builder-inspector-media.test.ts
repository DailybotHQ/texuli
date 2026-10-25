import { describe, expect, it } from 'vitest';
import {
  AVATAR_IDS,
  BLUEPRINT_TIER,
  blockSourceKindOf,
  checkMediaBlock,
  dataUriOf,
  describeSource,
  editableMediaBlock,
  editGallery,
  GALLERY_ITEM_FIELDS,
  isAltProp,
  isTrustPinned,
  MAX_GALLERY_ITEMS,
  MEDIA_FIELDS,
  MEDIA_PRESETS,
  MEDIA_TYPES,
  type MediaBlockValue,
  type MediaField,
  policyFor,
  readAlt,
  readBlockSource,
  readUrl,
  setRecordField,
  sourceKindsFor,
  switchMediaType,
  URL_PROP_IDS,
  type UrlRole,
  urlRoleOf,
  validateMediaBlock,
} from '../../apps/website/src/components/builder/inspector/media/model.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';

const image = BUILDER_MANIFESTS.find((manifest) => manifest.id === 'media-image');
const propOf = (name: string) => {
  const prop = image?.props.find((candidate) => candidate.name === name);
  if (!prop) throw new Error(`media-image.${name} missing`);
  return prop;
};

/** Sources an agent or a careless author might write; fictional hosts only. */
const SOURCES = [
  'https://images.example.com/cat.png',
  'https://user:pass@images.example.com/cat.png',
  'https:images.example.com/cat.png',
  'http://images.example.com/cat.png',
  'images/cat.png',
  './images/cat.png',
  'C:/images/cat.png',
  '//images.example.com/cat.png',
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  'vbscript:msgbox',
  'data:image/png;base64,iVBORw0KGgo=',
  'data:text/html;base64,PGI+',
  'blob:https://app.example.com/2f6c',
  'mailto:team@example.com',
  '#details',
  'ftp://files.example.com/cat.png',
  'https://images.example.com/a b.png',
  'https://images.example.com/\u200bcat.png',
  'images/\u202ecat.png',
  ' https://images.example.com/cat.png ',
  'https://images.example.com/a.png 480w, https://images.example.com/b.png 960w',
  'https://images.example.com/a.png 480w, https://images.example.com/b.png 2x',
  'https://images.example.com/a.png 1x, http://images.example.com/b.png 2x',
  '',
  'x'.repeat(5000),
];

describe('media-image URL props', () => {
  it('maps exactly the props the image component passes through the URL policy', () => {
    const roles = image?.props.flatMap((prop) => {
      const role = urlRoleOf('media-image', prop.name);
      return role ? [`${prop.name}:${role}`] : [];
    });
    expect(roles).toEqual(['src:image-src', 'srcset:image-srcset', 'href:href']);
    expect(urlRoleOf('media-image', 'alt')).toBeUndefined();
    expect(urlRoleOf('charts-pie', 'src')).toBeUndefined();
    expect(isAltProp('media-image', 'alt')).toBe(true);
  });

  it('reads every id with URL props at the untrusted tier, because the player pins its trust', () => {
    expect(BLUEPRINT_TIER).toBe('untrusted');
    for (const id of URL_PROP_IDS) expect(isTrustPinned(id), id).toBe(true);
  });

  it('paints exactly what the core URL policy keeps at the untrusted tier', () => {
    let checked = 0;
    for (const [name, role] of [
      ['src', 'image-src'],
      ['srcset', 'image-srcset'],
      ['href', 'href'],
    ] as [string, UrlRole][]) {
      for (const source of SOURCES) {
        const reading = readUrl(propOf(name), role, source);
        const kept = policyFor(role, source, 'untrusted');
        expect(reading.state, `${name} ${JSON.stringify(source)}`).toBe(
          kept === undefined ? 'blocked' : 'painted'
        );
        if (reading.state === 'painted') expect(reading.url).toBe(kept);
        if (reading.state === 'blocked') {
          expect(reading.developer).toBe(policyFor(role, source, 'developer') !== undefined);
          expect(reading.reason.length).toBeGreaterThan(10);
        }
        checked += 1;
      }
    }
    expect(checked).toBe(SOURCES.length * 3);
  });

  it('explains a developer-only source as a tier difference, and a script URL as blocked everywhere', () => {
    const http = readUrl(propOf('src'), 'image-src', 'http://images.example.com/cat.png');
    expect(http).toMatchObject({ state: 'blocked', kind: 'http', developer: true });
    if (http.state === 'blocked') expect(http.reason).toContain('developer tier');
    const script = readUrl(propOf('href'), 'href', 'javascript:alert(1)');
    expect(script).toMatchObject({ state: 'blocked', kind: 'script', developer: false });
    if (script.state === 'blocked')
      expect(script.reason).toBe('Script URLs are blocked at every tier.');
  });

  it("refuses a non-string or markup value with the renderer's own message", () => {
    for (const value of [42, null, ['a.png'], { src: 'a.png' }, '<img src=x onerror=alert(1)>']) {
      const reading = readUrl(propOf('src'), 'image-src', value);
      expect(reading.state, JSON.stringify(value)).toBe('refused');
    }
    expect(readUrl(propOf('src'), 'image-src', undefined)).toEqual({
      state: 'unset',
      required: true,
    });
    expect(readUrl(propOf('href'), 'href', undefined)).toEqual({ state: 'unset', required: false });
  });

  it("reads alt the way the player's media policy will paint it", () => {
    const alt = propOf('alt');
    expect(readAlt(alt, 'A cat on a mat')).toEqual({ state: 'set' });
    expect(readAlt(alt, '')).toEqual({ state: 'replaced' });
    expect(readAlt(alt, '   ')).toEqual({ state: 'replaced' });
    expect(readAlt(alt, '<b>cat</b>').state).toBe('refused');
    expect(readAlt(alt, 3).state).toBe('refused');
    expect(readAlt(alt, undefined)).toEqual({ state: 'unset' });
  });
});

describe('blocks-media sources', () => {
  it('reads every source with the block parser: avatar, embedded data, relative, never remote', () => {
    expect(readBlockSource('avatar:av-007', 'image')).toMatchObject({ ok: true, kind: 'avatar' });
    expect(readBlockSource('avatar:av-176', 'image').ok).toBe(false);
    expect(readBlockSource('avatar:av-007', 'video').ok).toBe(false);
    expect(readBlockSource(MEDIA_PRESETS.image.src, 'image')).toMatchObject({
      ok: true,
      kind: 'data',
    });
    expect(readBlockSource('images/cat.png', 'image')).toMatchObject({
      ok: true,
      kind: 'relative',
    });
    expect(readBlockSource('media/tour.mp4', 'video')).toMatchObject({
      ok: true,
      kind: 'relative',
    });
    for (const remote of [
      'https://images.example.com/cat.png',
      'images/cat.svg',
      '../cat.png',
      'javascript:alert(1)',
      'data:image/svg+xml;base64,PHN2Zz4=',
      '',
      7,
    ]) {
      expect(readBlockSource(remote, 'image').ok, String(remote)).toBe(false);
    }
    expect(AVATAR_IDS).toHaveLength(175);
    for (const id of AVATAR_IDS) expect(readBlockSource(`avatar:${id}`, 'image').ok).toBe(true);
    expect(sourceKindsFor('video')).toEqual(['data', 'relative']);
    expect(blockSourceKindOf('avatar:av-001')).toBe('avatar');
    expect(blockSourceKindOf('data:image/png;base64,AAAA')).toBe('data');
    expect(blockSourceKindOf(undefined)).toBe('relative');
  });

  it('turns file bytes into a data URI the parser accepts, within its size cap', () => {
    const bytes = Uint8Array.from(atob(MEDIA_PRESETS.image.src.split(',')[1] ?? ''), (char) =>
      char.charCodeAt(0)
    );
    const uri = dataUriOf(bytes, 'image/png');
    expect(uri).toBe(MEDIA_PRESETS.image.src);
    expect(readBlockSource(uri, 'image').ok).toBe(true);
    const tooBig = dataUriOf(new Uint8Array(200 * 1024), 'image/png');
    const reading = readBlockSource(tooBig, 'image');
    expect(reading.ok).toBe(false);
    if (!reading.ok) expect(reading.message).toContain('at most 192 KB');
    expect(describeSource(tooBig)).toBe('image/png, about 200 KB');
    expect(describeSource('images/cat.png')).toBe('images/cat.png');
  });
});

describe('blocks-media blocks', () => {
  it('starts every type from a preset the parser accepts', () => {
    for (const type of MEDIA_TYPES) {
      expect(validateMediaBlock(MEDIA_PRESETS[type]), type).toEqual([]);
    }
  });

  it("keys the parser's first problem to the field it names", () => {
    const missingAlt = { ...MEDIA_PRESETS.image, alt: undefined };
    expect(validateMediaBlock(missingAlt)).toEqual([
      { field: 'alt', message: 'Describe the image in alt, or mark it decorative: true' },
    ]);
    const remote = { ...MEDIA_PRESETS.image, src: 'https://images.example.com/cat.png' };
    expect(validateMediaBlock(remote)[0]?.field).toBe('src');
    const gallery = editGallery(MEDIA_PRESETS.gallery, {
      action: 'set',
      index: 1,
      item: { src: 'cat.svg', alt: 'x', width: 1, height: 1 },
    });
    expect(validateMediaBlock(gallery)[0]?.field).toBe('items.1.src');
    const video = { ...MEDIA_PRESETS.video, autoplay: true };
    expect(validateMediaBlock(video)[0]?.field).toBe('muted');
    expect(validateMediaBlock('not a block')[0]?.field).toBeDefined();
  });

  it('lists exactly the fields the parser keeps: a block with every field set round-trips', () => {
    const valid = (field: MediaField): unknown => {
      switch (field.kind) {
        case 'source':
          return field.media === 'image' ? 'images/cat.png' : 'media/tour.mp4';
        case 'plain':
          return 'Fictional text';
        case 'dimension':
          return 320;
        case 'boolean':
          return field.name !== 'decorative';
        case 'fit':
          return 'cover';
        case 'columns':
          return 3;
        case 'items':
          return [Object.fromEntries(GALLERY_ITEM_FIELDS.map((item) => [item.name, valid(item)]))];
      }
    };
    for (const type of MEDIA_TYPES) {
      const full: Record<string, unknown> = { type };
      for (const field of MEDIA_FIELDS[type]) full[field.name] = valid(field);
      const result = checkMediaBlock(full);
      expect(result.ok, `${type}: ${JSON.stringify(result.ok ? '' : result.issues)}`).toBe(true);
      if (result.ok) expect(result.block).toEqual(full);
    }
  });

  it('switches type keeping the image, and drops empty optional fields', () => {
    const figure = switchMediaType(MEDIA_PRESETS.image, 'figure');
    expect(figure.type).toBe('figure');
    expect(figure.src).toBe(MEDIA_PRESETS.image.src);
    expect(validateMediaBlock(figure)).toEqual([]);
    const gallery = switchMediaType({ ...MEDIA_PRESETS.image, alt: 'Kept' }, 'gallery');
    expect((gallery.items as Record<string, unknown>[])[0]?.alt).toBe('Kept');
    expect(switchMediaType(MEDIA_PRESETS.image, 'video')).toEqual(MEDIA_PRESETS.video);
    const caption = MEDIA_FIELDS.image.find((field) => field.name === 'caption');
    if (!caption) throw new Error('caption field missing');
    expect(setRecordField({ caption: 'x' }, caption, '')).toEqual({});
    expect(editableMediaBlock({ type: 'heading' }).type).toBe('image');
  });

  it('keeps a gallery within 1 to 12 items', () => {
    let block: MediaBlockValue = MEDIA_PRESETS.gallery;
    for (let index = 0; index < 20; index += 1) block = editGallery(block, { action: 'add' });
    expect((block.items as unknown[]).length).toBe(MAX_GALLERY_ITEMS);
    expect(validateMediaBlock(block)).toEqual([]);
    let one: MediaBlockValue = MEDIA_PRESETS.gallery;
    one = editGallery(one, { action: 'remove', index: 0 });
    one = editGallery(one, { action: 'remove', index: 0 });
    expect((one.items as unknown[]).length).toBe(1);
    const moved = editGallery(MEDIA_PRESETS.gallery, { action: 'move', index: 0, step: 1 });
    expect((moved.items as { alt: string }[]).map((item) => item.alt)).toEqual([
      'A second placeholder',
      'A placeholder image',
    ]);
  });
});
