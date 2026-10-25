import { classifyMediaSource } from '../safety.ts';
import type {
  FigureBlock,
  GalleryBlock,
  GalleryItem,
  ImageBlock,
  ImageFit,
  VideoBlock,
} from './blocks.ts';
import { plainObject } from './parse-family.ts';
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  ok,
  type ParseResult,
  parsePlainText,
} from './primitives.ts';

function parseMediaDimension(value: unknown, path: (string | number)[]): ParseResult<number> {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > BLOCK_CONTENT_LIMITS.mediaDimension
  ) {
    return fail(
      path,
      `dimension must be an integer from 1 to ${BLOCK_CONTENT_LIMITS.mediaDimension}`
    );
  }
  return ok(value);
}

function parseImageSource(value: unknown, path: (string | number)[]): ParseResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(path, 'src must be a non-empty string');
  }
  const result = classifyMediaSource(value, 'image');
  if (!result.ok) return fail(path, result.message);
  return ok(value);
}

function parseVideoSource(value: unknown, path: (string | number)[]): ParseResult<string> {
  if (typeof value !== 'string' || value.length === 0) {
    return fail(path, 'src must be a non-empty string');
  }
  const result = classifyMediaSource(value, 'video');
  if (!result.ok) return fail(path, result.message);
  return ok(value);
}

function parseFit(value: unknown, path: (string | number)[]): ParseResult<ImageFit | undefined> {
  if (value === undefined) return ok(undefined);
  if (value !== 'contain' && value !== 'cover') {
    return fail(path, 'fit must be "contain" or "cover"');
  }
  return ok(value);
}

function parseOptionalBoolean(
  value: unknown,
  path: (string | number)[]
): ParseResult<boolean | undefined> {
  if (value === undefined) return ok(undefined);
  if (typeof value !== 'boolean') return fail(path, 'must be a boolean');
  return ok(value);
}

function parseAltRules(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<{ alt?: string; decorative?: boolean }> {
  const decorative = parseOptionalBoolean(record.decorative, [...path, 'decorative']);
  if (!decorative.success) return decorative;

  let alt: string | undefined;
  if (record.alt !== undefined) {
    const parsed = parsePlainText(record.alt, [...path, 'alt'], 280);
    if (!parsed.success) return parsed;
    alt = parsed.data;
  }

  if (decorative.data === true && alt !== undefined) {
    return fail([...path, 'alt'], 'A decorative image has no alt text; drop alt or decorative');
  }
  if (decorative.data !== true && alt === undefined) {
    return fail([...path, 'alt'], 'Describe the image in alt, or mark it decorative: true');
  }

  return ok({
    ...(alt !== undefined ? { alt } : {}),
    ...(decorative.data !== undefined ? { decorative: decorative.data } : {}),
  });
}

function parseImageLikeFields(
  record: Record<string, unknown>,
  path: (string | number)[]
): ParseResult<{
  src: string;
  alt?: string;
  decorative?: boolean;
  width: number;
  height: number;
  credit?: string;
  fit?: ImageFit;
}> {
  const src = parseImageSource(record.src, [...path, 'src']);
  if (!src.success) return src;
  const width = parseMediaDimension(record.width, [...path, 'width']);
  if (!width.success) return width;
  const height = parseMediaDimension(record.height, [...path, 'height']);
  if (!height.success) return height;
  const altRules = parseAltRules(record, path);
  if (!altRules.success) return altRules;
  const fit = parseFit(record.fit, [...path, 'fit']);
  if (!fit.success) return fit;

  let credit: string | undefined;
  if (record.credit !== undefined) {
    const parsed = parsePlainText(record.credit, [...path, 'credit'], 120);
    if (!parsed.success) return parsed;
    credit = parsed.data;
  }

  return ok({
    src: src.data,
    width: width.data,
    height: height.data,
    ...altRules.data,
    ...(fit.data !== undefined ? { fit: fit.data } : {}),
    ...(credit !== undefined ? { credit } : {}),
  });
}

function parseImage(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<ImageBlock> {
  const fields = parseImageLikeFields(record, path);
  if (!fields.success) return fields;
  let caption: string | undefined;
  if (record.caption !== undefined) {
    const parsed = parsePlainText(record.caption, [...path, 'caption'], 280);
    if (!parsed.success) return parsed;
    caption = parsed.data;
  }
  return ok({
    ...base,
    type: 'image',
    ...fields.data,
    ...(caption !== undefined ? { caption } : {}),
  });
}

function parseFigure(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<FigureBlock> {
  const fields = parseImageLikeFields(record, path);
  if (!fields.success) return fields;
  const caption = parsePlainText(record.caption, [...path, 'caption'], 280);
  if (!caption.success) return caption;
  return ok({
    ...base,
    type: 'figure',
    ...fields.data,
    caption: caption.data,
  });
}

function parseVideo(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<VideoBlock> {
  const src = parseVideoSource(record.src, [...path, 'src']);
  if (!src.success) return src;
  const label = parsePlainText(record.label, [...path, 'label'], 160);
  if (!label.success) return label;
  const width = parseMediaDimension(record.width, [...path, 'width']);
  if (!width.success) return width;
  const height = parseMediaDimension(record.height, [...path, 'height']);
  if (!height.success) return height;

  let poster: string | undefined;
  if (record.poster !== undefined) {
    const parsed = parseImageSource(record.poster, [...path, 'poster']);
    if (!parsed.success) return parsed;
    poster = parsed.data;
  }

  let caption: string | undefined;
  if (record.caption !== undefined) {
    const parsed = parsePlainText(record.caption, [...path, 'caption'], 280);
    if (!parsed.success) return parsed;
    caption = parsed.data;
  }

  const autoplay = parseOptionalBoolean(record.autoplay, [...path, 'autoplay']);
  if (!autoplay.success) return autoplay;
  const loop = parseOptionalBoolean(record.loop, [...path, 'loop']);
  if (!loop.success) return loop;
  const muted = parseOptionalBoolean(record.muted, [...path, 'muted']);
  if (!muted.success) return muted;
  const controls = parseOptionalBoolean(record.controls, [...path, 'controls']);
  if (!controls.success) return controls;

  if (autoplay.data === true && muted.data !== true) {
    return fail([...path, 'muted'], 'An autoplaying video must be muted: true');
  }

  return ok({
    ...base,
    type: 'video',
    src: src.data,
    label: label.data,
    width: width.data,
    height: height.data,
    ...(poster !== undefined ? { poster } : {}),
    ...(caption !== undefined ? { caption } : {}),
    ...(autoplay.data !== undefined ? { autoplay: autoplay.data } : {}),
    ...(loop.data !== undefined ? { loop: loop.data } : {}),
    ...(muted.data !== undefined ? { muted: muted.data } : {}),
    ...(controls.data !== undefined ? { controls: controls.data } : {}),
  });
}

function parseGalleryItem(value: unknown, path: (string | number)[]): ParseResult<GalleryItem> {
  const object = plainObject(value, path);
  if (!object.success) return object;
  const fields = parseImageLikeFields(object.data, path);
  if (!fields.success) return fields;
  let caption: string | undefined;
  if (object.data.caption !== undefined) {
    const parsed = parsePlainText(object.data.caption, [...path, 'caption'], 280);
    if (!parsed.success) return parsed;
    caption = parsed.data;
  }
  // Gallery items do not carry credit (block-level only on figure/image).
  const { credit: _credit, ...item } = fields.data;
  return ok({
    ...item,
    ...(caption !== undefined ? { caption } : {}),
  });
}

function parseGallery(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<GalleryBlock> {
  if (!Array.isArray(record.items) || record.items.length === 0) {
    return fail([...path, 'items'], 'gallery needs at least one item');
  }
  if (record.items.length > BLOCK_CONTENT_LIMITS.galleryItems) {
    return fail(
      [...path, 'items'],
      `gallery may contain at most ${BLOCK_CONTENT_LIMITS.galleryItems} items`
    );
  }

  const items: GalleryItem[] = [];
  for (let i = 0; i < record.items.length; i += 1) {
    const item = parseGalleryItem(record.items[i], [...path, 'items', i]);
    if (!item.success) return item;
    items.push(item.data);
  }

  let title: string | undefined;
  if (record.title !== undefined) {
    const parsed = parsePlainText(record.title, [...path, 'title'], 120);
    if (!parsed.success) return parsed;
    title = parsed.data;
  }

  let columns: 2 | 3 | 4 | undefined;
  if (record.columns !== undefined) {
    if (record.columns !== 2 && record.columns !== 3 && record.columns !== 4) {
      return fail([...path, 'columns'], 'columns must be 2, 3 or 4');
    }
    columns = record.columns;
  }

  return ok({
    ...base,
    type: 'gallery',
    items,
    ...(title !== undefined ? { title } : {}),
    ...(columns !== undefined ? { columns } : {}),
  });
}

/** Media family: image, figure, video and gallery. */
export function parseMediaFamilyBlock(
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<ImageBlock | FigureBlock | VideoBlock | GalleryBlock> | null {
  switch (type) {
    case 'image':
      return parseImage(record, path, base);
    case 'figure':
      return parseFigure(record, path, base);
    case 'video':
      return parseVideo(record, path, base);
    case 'gallery':
      return parseGallery(record, path, base);
    default:
      return null;
  }
}
