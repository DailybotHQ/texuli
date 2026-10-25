import { safeHref } from '@texuli/core/url-policy';
import { hasUnsafeText } from '../core/safety.ts';
import type { BlockBase, FieldIssue, ParseResult } from '../core/schema/primitives.ts';
import { fail, ok, parseBlockBase, parsePlainText } from '../core/schema/primitives.ts';

export const EMBED_BLOCK_TYPES = ['embed-app', 'link-preview'] as const;
export const EMBED_APP_MAX_BYTES = 2_400;
const EMBED_APP_MAX_DEPTH = 12;
const EMBED_APP_MAX_NODES = 2_000;

export type EmbedAppBlock = BlockBase & {
  type: 'embed-app';
  title: string;
  startLabel?: string;
  height?: 'sm' | 'md' | 'lg';
  app: Record<string, unknown>;
};

export type LinkPreviewBlock = BlockBase & {
  type: 'link-preview';
  href: string;
  title: string;
  description?: string;
  site?: string;
};

export type EmbedBlock = EmbedAppBlock | LinkPreviewBlock;

export type EmbedParseResult = ParseResult<EmbedBlock>;
export type EmbedBlockCheck = { ok: true; block: EmbedBlock } | { ok: false; issues: FieldIssue[] };

function plainRecord(
  value: unknown,
  path: (string | number)[]
): ParseResult<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, 'Expected a plain object');
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, 'Object data must be plain JSON');
  }
  return ok(value as Record<string, unknown>);
}

function cloneJson(
  value: unknown,
  path: (string | number)[],
  depth: number,
  ancestors: WeakSet<object>,
  budget: { nodes: number }
): ParseResult<unknown> {
  budget.nodes += 1;
  if (budget.nodes > EMBED_APP_MAX_NODES) return fail(path, 'Embedded app has too many values');
  if (depth > EMBED_APP_MAX_DEPTH) return fail(path, 'Embedded app data is nested too deeply');
  if (value === null || typeof value === 'boolean') return ok(value);
  if (typeof value === 'string') {
    return hasUnsafeText(value, true, true)
      ? fail(path, 'Embedded app text contains unsafe characters')
      : ok(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? ok(value) : fail(path, 'Embedded app numbers must be finite');
  }
  if (typeof value !== 'object') return fail(path, 'Embedded app must contain only JSON values');
  if (ancestors.has(value)) return fail(path, 'Embedded app data must not contain cycles');
  ancestors.add(value);

  if (Array.isArray(value)) {
    const output: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor)) {
        ancestors.delete(value);
        return fail([...path, index], 'Embedded app arrays must contain plain values');
      }
      const child = cloneJson(descriptor.value, [...path, index], depth + 1, ancestors, budget);
      if (!child.success) {
        ancestors.delete(value);
        return child;
      }
      output.push(child.data);
    }
    const extraKeys = Reflect.ownKeys(value).filter((key) => {
      if (key === 'length') return false;
      if (typeof key !== 'string' || !/^\d+$/.test(key)) return true;
      const index = Number(key);
      return String(index) !== key || index >= value.length;
    });
    ancestors.delete(value);
    return extraKeys.length === 0
      ? ok(output)
      : fail(path, 'Embedded app arrays cannot have extra properties');
  }

  const record = plainRecord(value, path);
  if (!record.success) {
    ancestors.delete(value);
    return record;
  }
  const output: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(record.data)) {
    if (
      typeof key !== 'string' ||
      key === '__proto__' ||
      key === 'constructor' ||
      key === 'prototype'
    ) {
      ancestors.delete(value);
      return fail([...path, String(key)], 'Embedded app object has an unsafe key');
    }
    const descriptor = Object.getOwnPropertyDescriptor(record.data, key);
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      ancestors.delete(value);
      return fail([...path, key], 'Embedded app objects must contain plain data properties');
    }
    const child = cloneJson(descriptor.value, [...path, key], depth + 1, ancestors, budget);
    if (!child.success) {
      ancestors.delete(value);
      return child;
    }
    output[key] = child.data;
  }
  ancestors.delete(value);
  return ok(output);
}

function parseEmbedApp(
  record: Record<string, unknown>,
  base: BlockBase
): ParseResult<EmbedAppBlock> {
  const title = parsePlainText(record.title, ['title'], 80);
  if (!title.success) return title;
  let startLabel: string | undefined;
  if (record.startLabel !== undefined) {
    const result = parsePlainText(record.startLabel, ['startLabel'], 40);
    if (!result.success) return result;
    startLabel = result.data;
  }
  if (
    record.height !== undefined &&
    record.height !== 'sm' &&
    record.height !== 'md' &&
    record.height !== 'lg'
  ) {
    return fail(['height'], 'height must be sm, md or lg');
  }
  const app = cloneJson(record.app, ['app'], 1, new WeakSet(), { nodes: 0 });
  if (!app.success) return app;
  const appRecord = plainRecord(app.data, ['app']);
  if (!appRecord.success) return appRecord;
  if (appRecord.data.kind !== undefined && appRecord.data.kind !== 'app') {
    return fail(['app', 'kind'], 'Only app blueprints can be embedded');
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(appRecord.data);
  } catch {
    return fail(['app'], 'Embedded app could not be serialized as JSON');
  }
  if (new TextEncoder().encode(serialized).byteLength > EMBED_APP_MAX_BYTES) {
    return fail(['app'], `Embedded app JSON must be at most ${EMBED_APP_MAX_BYTES} bytes`);
  }
  if (containsNestedEmbed(appRecord.data)) {
    return fail(['app'], 'An embedded app cannot contain another embed-app block');
  }
  return ok({
    ...base,
    type: 'embed-app',
    title: title.data,
    ...(startLabel === undefined ? {} : { startLabel }),
    ...(record.height === undefined ? {} : { height: record.height }),
    app: appRecord.data,
  });
}

function containsNestedEmbed(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsNestedEmbed);
  if (value === null || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return record.type === 'embed-app' || Object.values(record).some(containsNestedEmbed);
}

function parseLinkPreview(
  record: Record<string, unknown>,
  base: BlockBase
): ParseResult<LinkPreviewBlock> {
  if (
    typeof record.href !== 'string' ||
    record.href.length > 2_048 ||
    hasUnsafeText(record.href, false, false)
  ) {
    return fail(['href'], 'href must be a URL of at most 2048 characters');
  }
  const href = safeHref(record.href, 'untrusted');
  if (!href) return fail(['href'], 'link previews require a safe HTTPS URL');
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return fail(['href'], 'link previews require an absolute HTTPS URL');
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') {
    return fail(['href'], 'link previews require HTTPS without embedded credentials');
  }
  const title = parsePlainText(record.title, ['title'], 120);
  if (!title.success) return title;
  let description: string | undefined;
  if (record.description !== undefined) {
    const parsed = parsePlainText(record.description, ['description'], 240);
    if (!parsed.success) return parsed;
    description = parsed.data;
  }
  let site: string | undefined;
  if (record.site !== undefined) {
    const parsed = parsePlainText(record.site, ['site'], 80);
    if (!parsed.success) return parsed;
    site = parsed.data;
  }
  return ok({
    ...base,
    type: 'link-preview',
    href,
    title: title.data,
    ...(description === undefined ? {} : { description }),
    ...(site === undefined ? {} : { site }),
  });
}

/** Validate a link preview or app frame block before exposing it to a renderer. */
export function safeParseEmbedBlock(value: unknown): EmbedParseResult {
  const object = plainRecord(value, []);
  if (!object.success) return object;
  const record = object.data;
  if (record.type !== 'embed-app' && record.type !== 'link-preview') {
    return fail(['type'], 'Expected embed-app or link-preview');
  }
  const base = parseBlockBase(record, []);
  if (!base.success) return base;
  return record.type === 'embed-app'
    ? parseEmbedApp(record, base.data)
    : parseLinkPreview(record, base.data);
}

/** Renderer-facing validation result, with untrusted values kept inert on failure. */
export function checkEmbedBlock(value: unknown): EmbedBlockCheck {
  const result = safeParseEmbedBlock(value);
  return result.success ? { ok: true, block: result.data } : { ok: false, issues: result.issues };
}
