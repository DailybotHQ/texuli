// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BlueprintStreamAbortError,
  type BlueprintStreamEvent,
  createBlueprintAssembler,
  createBlueprintStream,
  createJsonTokenizer,
  DEFAULT_STREAM_MAX_DEPTH,
  type JsonStreamEvent,
  STREAM_NODE_ORDER,
  STREAM_PROTOTYPE_KEYS,
} from '../src/stream/index.ts';

/**
 * `@texuli/spec/stream` (ADR-014): the incremental tokenizer reads JSON
 * split anywhere exactly as `JSON.parse` does (stricter only on duplicate
 * and prototype keys), in linear time with bounded memory; the assembler
 * reports node shells in the canonical order and flags members out of it;
 * hostile streams stop at a byte offset within a time bound.
 */

const ROOT = join(import.meta.dirname, '..');
const GOLDEN = join(ROOT, 'fixtures/golden');
const goldens = readdirSync(GOLDEN)
  .filter((file) => file.endsWith('.json'))
  .sort();
const read = (file: string) => readFileSync(join(GOLDEN, file), 'utf8');

/** Feed `parts` to a fresh assembler and collect every event. */
function assemble(parts: readonly string[], options = {}) {
  const assembler = createBlueprintAssembler(options);
  const events: BlueprintStreamEvent[] = [];
  for (const part of parts) events.push(...assembler.write(part));
  events.push(...assembler.end());
  return { assembler, events };
}

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function split(text: string, seed: number, max: number): string[] {
  const next = random(seed);
  const out: string[] = [];
  for (let i = 0; i < text.length; ) {
    const size = 1 + Math.floor(next() * max);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

/** Parse `text` with the tokenizer alone, rebuilding the value; `null` value on error. */
function tokenize(text: string, parts = [text]) {
  const tokenizer = createJsonTokenizer({ maxBytes: 1 << 24 });
  const events: JsonStreamEvent[] = [];
  for (const part of parts) events.push(...tokenizer.write(part));
  events.push(...tokenizer.end());
  if (!tokenizer.done) return { ok: false as const, error: tokenizer.error };
  const stack: { value: unknown; key: string | null }[] = [];
  let root: unknown;
  const put = (value: unknown) => {
    const top = stack[stack.length - 1];
    if (!top) root = value;
    else if (Array.isArray(top.value)) top.value.push(value);
    else (top.value as Record<string, unknown>)[top.key as string] = value;
  };
  for (const event of events) {
    if (event.type === 'open') stack.push({ value: event.kind === 'object' ? {} : [], key: null });
    else if (event.type === 'key')
      (stack[stack.length - 1] as { key: string | null }).key = event.key;
    else if (event.type === 'value') put(event.value);
    else put((stack.pop() as { value: unknown }).value);
  }
  return { ok: true as const, value: root, bytes: tokenizer.bytes };
}

type Node = { children?: Node[] } & Record<string, unknown>;
function treePaths(tree: unknown, out = new Map<string, Node>()): Map<string, Node> {
  const visit = (node: Node, path: string) => {
    out.set(path, node);
    node.children?.forEach((child, index) => {
      visit(child, `${path}.children.${index}`);
    });
  };
  if (Array.isArray(tree)) for (const [index, node] of tree.entries()) visit(node, String(index));
  else visit(tree as Node, '0');
  return out;
}

describe('the tokenizer', () => {
  it('reads every golden like JSON.parse, in any chunking', () => {
    for (const file of goldens) {
      const text = read(file);
      const expected = JSON.parse(text);
      for (const parts of [[text], split(text, 3, 1), split(text, 5, 7), split(text, 11, 200)]) {
        const result = tokenize(text, parts);
        expect(result.ok, file).toBe(true);
        expect(result.ok && result.value, file).toEqual(expected);
        expect(result.ok && result.bytes, file).toBe(new TextEncoder().encode(text).length);
      }
    }
  });

  it('reads a value split at every position, inside strings, escapes and surrogate pairs', () => {
    const value = {
      text: 'café \u{1f600}   "quoted" \\ / \n\t emoji 😀 and 𝄞',
      escapes: '\\u00e9 \\ud83d\\ude00',
      numbers: [0, -0.5, 12.5e-3, 1e21, -7],
      flags: [true, false, null],
    };
    const text = JSON.stringify(value).replace('emoji', 'emoji \\ud83d\\ude00 \\u00e9 \\/');
    const expected = JSON.parse(text);
    for (let at = 0; at <= text.length; at += 1) {
      for (const second of [at, Math.min(text.length, at + 3)]) {
        const parts = [text.slice(0, at), text.slice(at, second), text.slice(second)];
        const result = tokenize(text, parts);
        expect(result.ok && result.value, `split at ${at}`).toEqual(expected);
        expect(result.ok && result.bytes).toBe(new TextEncoder().encode(text).length);
      }
    }
  });

  it('accepts exactly what JSON.parse accepts (no duplicate or prototype keys)', () => {
    const corpus = [
      '0',
      '-0',
      '1.5',
      '-1.5e10',
      '1E+2',
      '01',
      '1.',
      '.5',
      '+1',
      '-',
      '1e',
      '--1',
      '0x10',
      '"a"',
      '"\\x"',
      '"\\u12G4"',
      '"\\u12"',
      '"tab\there"',
      '"\\"',
      '""',
      'true',
      'false',
      'null',
      'tru',
      'nul',
      'True',
      'nulll',
      '[]',
      '{}',
      '[1,]',
      '[,1]',
      '{"a":1,}',
      '{"a" 1}',
      '{a:1}',
      "{'a':1}",
      '[1 2]',
      '[',
      ']',
      '{',
      '}',
      '{"a"',
      '{"a":',
      '[1',
      '{} {}',
      '1 2',
      '  [1]  ',
      '\n{"a":[{}]}\t',
      '{"a":{"b":[1,{"c":null}]}}',
      '[[[[]]]]',
      '"é"',
      '[1e-7, 2E7]',
      '{"":0}',
    ];
    for (const text of corpus) {
      let parsed: unknown;
      let accepted = true;
      try {
        parsed = JSON.parse(text);
      } catch {
        accepted = false;
      }
      const result = tokenize(text);
      expect(result.ok, text).toBe(accepted);
      if (accepted) expect(result.ok && result.value, text).toEqual(parsed);
      // The same verdict whatever the chunking.
      expect(tokenize(text, text.split('')).ok, text).toBe(accepted);
    }
  });

  it('refuses duplicate and prototype keys anywhere, at their byte offset', () => {
    const dup = createJsonTokenizer();
    dup.write('{"é":{"a":1,"a":2}}');
    expect(dup.error).toMatchObject({ code: 'duplicate-key', offset: 13 });
    for (const key of STREAM_PROTOTYPE_KEYS) {
      const tokenizer = createJsonTokenizer();
      tokenizer.write(`[{"ok":{"${key}":{}}}]`);
      expect(tokenizer.error, key).toMatchObject({ code: 'prototype-key', offset: 8 });
    }
    // Keys inside strings are just text.
    expect(tokenize('{"text":"__proto__ constructor"}').ok).toBe(true);
  });

  it('stops hostile input at a byte offset, in linear time', () => {
    const time = (run: () => void) => {
      const start = performance.now();
      run();
      return performance.now() - start;
    };
    // Depth bomb: stops at the cap, reading nothing more.
    const deep = createJsonTokenizer();
    const deepMs = time(() => {
      for (let i = 0; i < 100; i += 1) deep.write('['.repeat(10_000));
    });
    expect(deep.error).toMatchObject({ code: 'too-deep', offset: DEFAULT_STREAM_MAX_DEPTH });
    expect(deepMs).toBeLessThan(1000);
    // A huge string: stops at the byte budget, whatever the chunking.
    const huge = createJsonTokenizer({ maxBytes: 64 * 1024 });
    huge.write('{"a":"');
    for (let i = 0; i < 1000 && huge.error === null; i += 1) huge.write('é'.repeat(1000));
    expect(huge.error).toMatchObject({ code: 'too-large', offset: 64 * 1024 });
    // Garbage: the first byte.
    const garbage = createJsonTokenizer();
    garbage.write('\u0000ÿ<script>');
    expect(garbage.error).toMatchObject({ code: 'bad-json', offset: 0 });
    // Truncated: `end()` says so at the byte count.
    const cut = createJsonTokenizer();
    cut.write('{"a":"café');
    cut.end();
    expect(cut.error).toMatchObject({ code: 'truncated', offset: 11 });
    // Linear: doubling a large input does not much more than double the time.
    const big = (n: number) =>
      `[${Array.from({ length: n }, (_, i) => `{"k${i}":"${'x'.repeat(40)}\\n","n":${i}.5,"b":[true,null]}`).join(',')}]`;
    const small = big(20_000);
    const large = big(40_000);
    const run = (text: string) =>
      time(() => {
        const tokenizer = createJsonTokenizer({ maxBytes: 1 << 26 });
        for (let i = 0; i < text.length; i += 4096) tokenizer.write(text.slice(i, i + 4096));
        tokenizer.end();
        expect(tokenizer.done).toBe(true);
      });
    run(small);
    const a = Math.min(run(small), run(small));
    const b = Math.min(run(large), run(large));
    expect(b).toBeLessThan(a * 4 + 50);
    expect(b).toBeLessThan(5000);
  });
});

describe('the assembler', () => {
  for (const file of goldens) {
    it(`${file}: reports every node shell once, in document order, and the whole value`, () => {
      const text = read(file);
      const expected = JSON.parse(text) as Record<string, unknown>;
      const nodes = treePaths(expected.tree);
      const whole = assemble([text]).events;
      for (const parts of [split(text, 2, 1), split(text, 9, 31), split(text, 13, 500)]) {
        const { events, assembler } = assemble(parts);
        expect(assembler.error).toBeNull();
        // The same events whatever the chunking (offsets included).
        expect(events.filter((e) => e.type !== 'complete')).toEqual(
          whole.filter((e) => e.type !== 'complete')
        );
        const shells = events.filter((e) => e.type === 'node');
        expect(shells.map((e) => e.path)).toEqual([...nodes.keys()]);
        for (const event of shells) {
          const { children: _children, ...shell } = nodes.get(event.path) as Node;
          expect(event.shell).toEqual(shell);
          // Spec 0.7.0: a keyed node streams under its key, every other node under its path.
          expect(event.streamId).toBe(typeof shell.key === 'string' ? shell.key : event.path);
        }
        expect(events.filter((e) => e.type === 'node-end')).toHaveLength(nodes.size);
        const headers = events.filter((e) => e.type === 'header');
        expect(headers).toHaveLength(1);
        const { tree: _tree, ...header } = expected;
        expect(headers[0]?.type === 'header' && headers[0].header).toEqual(header);
        expect(events[events.length - 1]).toMatchObject({ type: 'complete', value: expected });
      }
    });
  }

  it('reports a shell before its children arrive', () => {
    const text = '{"id":"layout-page","props":{"title":"A"},"children":[{"id":"badge"';
    const { events } = { events: createBlueprintAssembler().write(text) };
    expect(events.map((e) => e.type)).toEqual(['node-start', 'node', 'node-start', 'node-id']);
    expect(events[1]).toMatchObject({
      type: 'node',
      path: '0',
      shell: { id: 'layout-page', props: { title: 'A' } },
      hasChildren: true,
    });
    expect(events[2]).toMatchObject({ path: '0.children.0', parent: '0', index: 0, inArray: true });
  });

  it('reads arrays of roots, wrappers and childless roots', () => {
    const roots = assemble(['[{"id":"a"},{"id":"b","children":[]}]']).events;
    expect(roots.filter((e) => e.type === 'node').map((e) => e.path)).toEqual(['0', '1']);
    const wrapped = assemble(['{"format":"x","state":{},"blueprint":{"id":"a"}}'], {
      treeMembers: ['tree', 'blueprint'],
    }).events;
    expect(wrapped.map((e) => e.type)).toEqual([
      'header',
      'node-start',
      'node-id',
      'node',
      'node-end',
      'complete',
    ]);
    const single = assemble(['{"id":"badge","props":{"label":"New"}}']).events;
    expect(single.filter((e) => e.type === 'node')).toMatchObject([
      { path: '0', hasChildren: false },
    ]);
  });

  it('flags members after children or after the tree (the canonical order)', () => {
    expect(STREAM_NODE_ORDER[STREAM_NODE_ORDER.length - 1]).toBe('children');
    expect(STREAM_NODE_ORDER.indexOf('motion')).toBe(STREAM_NODE_ORDER.length - 2);
    const late = assemble([
      '{"id":"layout-page","children":[{"id":"a","children":[],"on":{}}],"props":{}}',
    ]).events;
    expect(late.filter((e) => e.type === 'stream-order')).toMatchObject([
      { path: '0.children.0', key: 'on' },
      { path: '0', key: 'props' },
    ]);
    const envelope = assemble([
      '{"format":"texuli-blueprint","tree":{"id":"a"},"state":{"x":1}}',
    ]).events;
    expect(envelope.filter((e) => e.type === 'stream-order')).toMatchObject([
      { path: '$', key: 'state' },
    ]);
    // The late member's value reaches the header once it closed.
    expect(envelope.filter((e) => e.type === 'header').at(-1)).toMatchObject({
      header: { format: 'texuli-blueprint', state: { x: 1 } },
    });
  });

  it('a key names the node in place of its path', () => {
    const events = assemble(['{"id":"a","children":[{"key":"intro","id":"b"}]}']).events;
    expect(
      events.filter((e) => e.type === 'node').map((e) => e.type === 'node' && e.streamId)
    ).toEqual(['0', 'intro']);
  });

  it('stops on errors and aborts, and is never complete after one', () => {
    const truncated = assemble(['{"id":"a","children":[{"id":"b"}']);
    expect(truncated.events.at(-1)).toMatchObject({ type: 'error', error: { code: 'truncated' } });
    const assembler = createBlueprintAssembler();
    assembler.write('{"id":"a"');
    expect(assembler.abort('connection')).toMatchObject([
      { type: 'error', error: { code: 'connection', offset: 9 } },
    ]);
    expect(assembler.write('}')).toEqual([]);
    expect(assembler.end()).toEqual([]);
  });
});

describe('the push handle', () => {
  it('delivers chunks in order, then ends or throws after an abort', async () => {
    const handle = createBlueprintStream();
    handle.write('{"id":');
    handle.write('"a"}');
    handle.end();
    handle.write('ignored');
    const read: string[] = [];
    for await (const chunk of handle) read.push(chunk);
    expect(read).toEqual(['{"id":', '"a"}']);

    const aborted = createBlueprintStream();
    const seen: string[] = [];
    const reading = (async () => {
      for await (const chunk of aborted) seen.push(chunk);
    })();
    aborted.write('{"id"');
    await Promise.resolve();
    aborted.abort('The fictional agent stopped.');
    await expect(reading).rejects.toBeInstanceOf(BlueprintStreamAbortError);
    expect(seen).toEqual(['{"id"']);
    expect(aborted.closed).toBe(true);
  });
});

describe('stream docs', () => {
  it('documents the subpath and every name it exports', () => {
    const exportsMap = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).exports;
    expect(exportsMap['./stream']).toEqual({
      types: './src/stream/index.ts',
      default: './src/stream/index.ts',
    });
    const doc = readFileSync(join(ROOT, 'docs/stream.md'), 'utf8');
    const index = readFileSync(join(ROOT, 'src/stream/index.ts'), 'utf8');
    const names = [...index.matchAll(/^\s+(?:type\s+)?(\w+),?$/gm)].map((m) => m[1] as string);
    expect(names.length).toBeGreaterThan(15);
    for (const name of names) expect(doc, name).toMatch(new RegExp(`\`${name}\\b`));
    expect(readFileSync(join(ROOT, 'README.md'), 'utf8')).toContain('docs/stream.md');
  });
});
