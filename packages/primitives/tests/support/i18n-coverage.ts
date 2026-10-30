/// <reference types="node" />
// Static checks behind the message catalog (ADR-016), shared by the
// primitives and texuli i18n tests: every user-visible English default
// goes through `msg(id, english)` or `localizeLabels`, and the package's
// central English catalog lists exactly those ids with the same text.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { formatMessage, type MessageCatalog } from '@texuli/core/i18n';

function svelteFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) svelteFiles(path, out);
    else if (name.endsWith('.svelte')) out.push(path);
  }
  return out;
}

/** A `$props()` default that is an English string (`closeLabel = 'Close',`). */
const PROP_DEFAULT = /^\s+[a-zA-Z]+\s*=\s*'[A-Z][^']*[a-z][^']*',\s*$/;
/** An English fallback written inline (`?? 'Show options'`). */
const INLINE_FALLBACK = /\?\? '[A-Z][^']*[a-z][^']*'/;
/** A literal English accessible name (`aria-label="Primary"`). */
const LITERAL_ARIA = /aria-label="[A-Z][a-z][^"{]*"/;
const CALL = /\bmsg\(\s*'([^']+)',\s*'((?:[^'\\]|\\.)*)'/g;

/** Lines that still hard-code an English label, as `file:line: text`. */
export function hardCodedLabels(srcDir: string): string[] {
  const hits: string[] = [];
  for (const file of svelteFiles(srcDir)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const propsStart = lines.findIndex((line) => /^let \{\s*$/.test(line));
    const propsEnd = lines.findIndex(
      (line, index) => index > propsStart && /^\}.*\$props\(\);/.test(line)
    );
    lines.forEach((line, index) => {
      const inProps = propsStart !== -1 && index > propsStart && index < propsEnd;
      if (
        (inProps && PROP_DEFAULT.test(line)) ||
        INLINE_FALLBACK.test(line) ||
        LITERAL_ARIA.test(line)
      ) {
        hits.push(`${relative(srcDir, file)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
  return hits;
}

/** Every `msg('id', 'English')` call in the package's components. */
export function messageCalls(srcDir: string): Map<string, string> {
  const calls = new Map<string, string>();
  for (const file of svelteFiles(srcDir)) {
    for (const match of readFileSync(file, 'utf8').matchAll(CALL)) {
      const id = match[1] as string;
      const english = (match[2] as string).replace(/\\'/g, "'");
      const previous = calls.get(id);
      if (previous !== undefined && previous !== english) {
        throw new Error(`${id} has two English defaults: ${previous} / ${english}`);
      }
      calls.set(id, english);
    }
  }
  return calls;
}

const kebab = (key: string) => key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/**
 * Differences between the catalog and the sources: ids the components use
 * that the catalog lacks or words differently, and catalog ids nothing uses.
 * Function labels are checked by formatting the catalog template with `{0}`.
 */
export function catalogDrift(
  catalog: MessageCatalog,
  calls: ReadonlyMap<string, string>,
  objects: readonly (readonly [string, object])[]
): string[] {
  const expected = new Map<string, string | ((...args: never[]) => string)>(calls);
  for (const [prefix, object] of objects) {
    for (const [key, value] of Object.entries(object))
      expected.set(`${prefix}.${kebab(key)}`, value);
  }
  const drift: string[] = [];
  for (const [id, english] of expected) {
    const message = catalog.messages[id];
    if (message === undefined) drift.push(`missing ${id}`);
    else if (typeof english === 'string' && message !== english) drift.push(`differs ${id}`);
    else if (typeof english === 'function') {
      const sample = (english as (value: string) => string)('Sample');
      if (formatMessage(message, { 0: 'Sample' }) !== sample) drift.push(`differs ${id}`);
    }
  }
  for (const id of Object.keys(catalog.messages)) {
    if (!expected.has(id)) drift.push(`unused ${id}`);
  }
  return drift;
}
