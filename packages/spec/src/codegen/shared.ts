import { checkSchemaDocument, refName, type Schema } from '../dialect.ts';

/** What every generated file is stamped with. */
export interface Stamp {
  specVersion: string;
  /** SHA-256 over the normative files' digests (`manifest.json`). */
  specDigest: string;
}

/** One schema document the generators project. */
export interface SchemaUnit {
  /** Path inside the package, e.g. `schemas/blueprint.schema.json`. */
  source: string;
  schema: Schema;
  /** Prefix for `$defs` type names (`Blueprint` + `node` = `BlueprintNode`). */
  prefix: string;
}

/** `meetingRef` → `MeetingRef`, `stacked-bar` → `StackedBar`. */
export function pascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** `portable-core` → `PORTABLE_CORE`, `setProp` → `SET_PROP`. */
export function upperSnake(value: string): string {
  const snake = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return /^[0-9]/.test(snake) ? `V_${snake}` : snake;
}

/** The generated type name of a `$defs` entry. */
export function defName(unit: SchemaUnit, def: string): string {
  return `${unit.prefix}${pascal(def)}`;
}

/** The generated type name a `$ref` points at. */
export function refType(unit: SchemaUnit, ref: string): string {
  const name = refName(ref);
  if (name === undefined) throw new Error(`${unit.source}: unsupported $ref ${ref}`);
  return defName(unit, name);
}

/** The root type name: the schema's `title`. */
export function rootName(unit: SchemaUnit): string {
  if (!unit.schema.title || !/^[A-Z][A-Za-z0-9]*$/.test(unit.schema.title)) {
    throw new Error(`${unit.source}: the root schema needs a PascalCase "title"`);
  }
  return unit.schema.title;
}

/** Refuse a schema outside the dialect: generation never guesses. */
export function assertSupported(unit: SchemaUnit): void {
  const issues = checkSchemaDocument(unit.schema);
  if (issues.length > 0) {
    const detail = issues.map((i) => `${i.path} ${i.code}`).join('; ');
    throw new Error(`${unit.source}: not in the spec dialect: ${detail}`);
  }
}

/** Whether a schema node is a closed object with declared properties. */
export function isRecordType(node: Schema): boolean {
  return node.type === 'object' && node.properties !== undefined;
}

/** Whether a schema node is a string enum. */
export function isStringEnum(node: Schema): node is Schema & { enum: readonly string[] } {
  return Array.isArray(node.enum) && node.enum.every((value) => typeof value === 'string');
}

/** Words of `text` wrapped to `width` columns. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
