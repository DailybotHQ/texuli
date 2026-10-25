import type { ExampleEntry, ExampleFilter, ExampleMeta } from './types.ts';

const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ID_MAX = 64;
const TITLE_MAX = 80;
const DESCRIPTION_MAX = 280;
const TAG_PATTERN = /^[a-z][a-zA-Z0-9-]{0,31}$/;
const COMPONENT_PATTERN = /^[a-z][a-z0-9-]*(?:\/[A-Za-z][A-Za-z0-9._-]*)+$/;
const MAX_TAGS = 16;
const MAX_PROPS = 32;

const byId = new Map<string, ExampleEntry>();

function assertString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') {
    throw new TypeError(`Example ${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TypeError(`Example ${field} must not be empty.`);
  }
  if (trimmed.length > max) {
    throw new TypeError(`Example ${field} must be at most ${max} characters.`);
  }
  return trimmed;
}

function assertMeta(input: ExampleMeta): ExampleMeta {
  const id = assertString(input.id, 'id', ID_MAX);
  if (!ID_PATTERN.test(id)) {
    throw new TypeError(
      `Example id "${id}" must be kebab-case (start with a letter, only a-z, 0-9 and hyphens).`
    );
  }

  const title = assertString(input.title, 'title', TITLE_MAX);
  const description = assertString(input.description, 'description', DESCRIPTION_MAX);
  const component = assertString(input.component, 'component', 120);
  if (!COMPONENT_PATTERN.test(component)) {
    throw new TypeError(
      `Example component "${component}" must look like package/Export (for example core/safeHref).`
    );
  }

  if (!Array.isArray(input.tags)) {
    throw new TypeError('Example tags must be an array of strings.');
  }
  if (input.tags.length > MAX_TAGS) {
    throw new TypeError(`Example tags may contain at most ${MAX_TAGS} entries.`);
  }
  const tags = input.tags.map((tag, index) => {
    if (typeof tag !== 'string' || !TAG_PATTERN.test(tag)) {
      throw new TypeError(`Example tags[${index}] must be a short token (letter first).`);
    }
    return tag;
  });
  if (new Set(tags).size !== tags.length) {
    throw new TypeError('Example tags must be unique.');
  }

  let props: readonly string[] | undefined;
  if (input.props !== undefined) {
    if (!Array.isArray(input.props)) {
      throw new TypeError('Example props must be an array of strings when set.');
    }
    if (input.props.length > MAX_PROPS) {
      throw new TypeError(`Example props may contain at most ${MAX_PROPS} entries.`);
    }
    props = input.props.map((name, index) => {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 64) {
        throw new TypeError(`Example props[${index}] must be a non-empty string ≤ 64 characters.`);
      }
      return name.trim();
    });
  }

  return props === undefined
    ? { id, title, description, tags, component }
    : { id, title, description, tags, component, props };
}

/**
 * Registers one example. Call from an entry module that the package barrel
 * imports so registration runs when `@texuli/examples` is loaded.
 *
 * @throws {TypeError} when metadata is invalid or `id` is already registered
 * @throws {TypeError} when `load` is missing
 */
export function defineExample(input: ExampleEntry): ExampleEntry {
  const meta = assertMeta(input);
  if (typeof input.load !== 'function') {
    throw new TypeError(`Example "${meta.id}" needs a load() that returns the Svelte module.`);
  }
  if (byId.has(meta.id)) {
    throw new TypeError(`Example id "${meta.id}" is already registered.`);
  }

  const entry: ExampleEntry = Object.freeze({
    ...meta,
    tags: Object.freeze([...meta.tags]),
    ...(meta.props ? { props: Object.freeze([...meta.props]) } : {}),
    load: input.load,
  });
  byId.set(entry.id, entry);
  return entry;
}

/** Returns one example by id, or `undefined` when nothing is registered under that id. */
export function getExample(id: string): ExampleEntry | undefined {
  if (typeof id !== 'string' || id.length === 0) return undefined;
  return byId.get(id);
}

/**
 * Lists registered examples in stable id order.
 * Optional `tag` / `component` filters narrow the list without mutating the registry.
 */
export function listExamples(filter: ExampleFilter = {}): ExampleEntry[] {
  const tag = filter.tag;
  const component = filter.component;
  const entries = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return entries.filter((entry) => {
    if (tag !== undefined && !entry.tags.includes(tag)) return false;
    if (component !== undefined) {
      if (entry.component !== component && !entry.component.startsWith(`${component}/`)) {
        return false;
      }
    }
    return true;
  });
}

/** Every registered id in stable order (for fixtures and gallery indexes). */
export function listExampleIds(): string[] {
  return listExamples().map((entry) => entry.id);
}

/**
 * Test-only: drop every registration. Not exported from the public barrel.
 * Kept here so unit tests can isolate define/list cycles.
 */
export function __resetExamplesForTests(): void {
  byId.clear();
}
