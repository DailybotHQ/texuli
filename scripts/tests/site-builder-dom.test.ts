// @vitest-environment happy-dom
/**
 * The website builder in the DOM: structured, text and JSON inspector fields
 * against the component schemas, and the keyboard model (list focus, F6 pane
 * cycling, outline multi-select operations) on the mounted BuilderApp.
 */
import { type CatalogTreeInput } from '@texuli/catalog/render/renderer';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BuilderApp from '../../apps/website/src/components/builder/BuilderApp.svelte';
import {
  fieldFamily,
  unsupportedReason,
} from '../../apps/website/src/components/builder/inspector/coverage.ts';
import JsonField from '../../apps/website/src/components/builder/inspector/json/JsonField.svelte';
import {
  jsonIssues,
  parseJsonDraft,
  propExamples,
  schemaCheck,
} from '../../apps/website/src/components/builder/inspector/json/model.ts';
import { stringRule } from '../../apps/website/src/components/builder/inspector/string/model.ts';
import StringField from '../../apps/website/src/components/builder/inspector/string/StringField.svelte';
import {
  editList,
  isPlainObject,
  issuesAt,
  matchVariant,
  nextUniqueItem,
  type Path,
  readContainer,
  resolve,
  sampleValue,
  showRaw,
  unknownKeys,
  validate,
  variantLabel,
  withKey,
} from '../../apps/website/src/components/builder/inspector/struct/model.ts';
import {
  chartStructSchema,
  chartSchemaDefinitions as defs,
} from '../../apps/website/src/components/builder/inspector/struct/sources.ts';
import {
  listAnnouncement,
  listFocusAfter,
  listKeyboard,
  listMoveKey,
} from '../../apps/website/src/components/builder/keyboard/list.ts';
import {
  isPaneKey,
  nextPane,
  paneCycle,
} from '../../apps/website/src/components/builder/keyboard/panes.ts';
import { BUILDER_MANIFESTS } from '../../apps/website/src/components/builder/manifest.ts';
import { inspectorFields } from '../../apps/website/src/components/builder/model.ts';

describe('inspector: structured and JSON props', () => {
  type Schema = Parameters<typeof validate>[0];

  /** Every object or array prop the builder edits that has a chart sub-field schema. */
  const STRUCT_PROPS = BUILDER_MANIFESTS.flatMap((manifest) =>
    manifest.props
      .filter((prop) => prop.kind === 'object' || prop.kind === 'array')
      .flatMap((prop) => {
        const struct = chartStructSchema(manifest.id, prop.name);
        return struct ? [{ id: manifest.id, name: prop.name, schema: struct.schema }] : [];
      })
  );

  /** A sample with every optional field filled and two list items, to mutate everywhere. */
  function fullSample(schema: Schema, depth = 0): unknown {
    const node = resolve(schema, defs);
    if (depth > 3) return sampleValue(node, defs);
    switch (node.kind) {
      case 'object': {
        const out: Record<string, unknown> = {};
        for (const field of node.properties) out[field.name] = fullSample(field, depth + 1);
        return out;
      }
      case 'array': {
        const max = node.constraints?.maxItems ?? 2;
        const list: unknown[] = [];
        for (let index = 0; index < Math.min(2, max); index += 1) {
          list.push(
            nextUniqueItem(list, fullSample(node.items, depth + 1), node.constraints?.uniqueBy)
          );
        }
        return list;
      }
      case 'record':
        return { first: fullSample(node.values, depth + 1) };
      case 'nullable':
        return fullSample(node.value, depth + 1);
      case 'union':
        return fullSample(node.variants[0] as Schema, depth + 1);
      case 'tuple':
        return node.items.map((item) => fullSample(item, depth + 1));
      default:
        return sampleValue(node, defs);
    }
  }

  /** Replace the value at `path` (immutably). */
  function setPath(value: unknown, path: Path, next: unknown): unknown {
    if (path.length === 0) return next;
    const [head, ...rest] = path;
    if (Array.isArray(value)) {
      return value.map((item, index) => (index === head ? setPath(item, rest, next) : item));
    }
    const base = isPlainObject(value) ? value : {};
    return withKey(base, String(head), setPath(base[String(head)], rest, next));
  }

  interface Mutation {
    path: Path;
    value: unknown;
    label: string;
  }

  /** Every targeted break of a sample: unknown keys, missing required, wrong leaf types, list limits. */
  function mutations(schema: Schema, value: unknown, path: Path = [], depth = 0): Mutation[] {
    const node = resolve(schema, defs);
    if (depth > 3) return [];
    const out: Mutation[] = [];
    switch (node.kind) {
      case 'object': {
        if (!isPlainObject(value)) return out;
        if (!node.additionalProperties) {
          out.push({ path: [...path, 'zzUnknown'], value: 1, label: 'unknown key' });
        }
        for (const field of node.properties) {
          if (field.required)
            out.push({ path: [...path, field.name], value: undefined, label: 'missing' });
          out.push(...mutations(field, value[field.name], [...path, field.name], depth + 1));
        }
        return out;
      }
      case 'array': {
        if (!Array.isArray(value)) return out;
        value.forEach((item, index) => {
          out.push(...mutations(node.items, item, [...path, index], depth + 1));
        });
        return out;
      }
      case 'record': {
        if (!isPlainObject(value)) return out;
        for (const [key, item] of Object.entries(value)) {
          out.push(...mutations(node.values, item, [...path, key], depth + 1));
        }
        return out;
      }
      case 'nullable':
        return mutations(node.value, value, path, depth);
      case 'string':
        return [{ path, value: 42, label: 'number for text' }];
      case 'number':
        return [{ path, value: 'x', label: 'text for number' }];
      case 'boolean':
        return [{ path, value: 'yes', label: 'text for boolean' }];
      case 'enum':
        return [{ path, value: '__nope__', label: 'outside enum' }];
      default:
        return out;
    }
  }

  describe('structured props in the builder manifests', () => {
    it('finds a chart sub-field schema for 44 object and array props; accepts the generated sample of every schema, minimal and full; flags every targeted break at exactly the broken path; enforces list limits and unique keys; refuses the wrong container type at the top', () => {
      expect(STRUCT_PROPS).toHaveLength(44);
      for (const { id, name, schema } of STRUCT_PROPS) {
        expect(validate(schema, sampleValue(schema, defs), defs), `${id}.${name} minimal`).toEqual(
          []
        );
        expect(validate(schema, fullSample(schema), defs), `${id}.${name} full`).toEqual([]);
      }
      // flags every targeted break at exactly the broken path
      {
        let checked = 0;
        for (const { id, name, schema } of STRUCT_PROPS) {
          const sample = fullSample(schema);
          for (const mutation of mutations(schema, sample)) {
            const broken = setPath(sample, mutation.path, mutation.value);
            const issues = validate(schema, broken, defs);
            expect(
              issuesAt(issues, mutation.path).length,
              `${id}.${name} ${mutation.label} at ${mutation.path.join('.')}`
            ).toBeGreaterThan(0);
            checked += 1;
          }
        }
        expect(checked).toBeGreaterThan(300);
      }
      for (const { id, name, schema } of STRUCT_PROPS) {
        const node = resolve(schema, defs);
        if (node.kind !== 'array') continue;
        const one = sampleValue(node.items, defs);
        const c = node.constraints;
        if (c?.maxItems !== undefined) {
          const over: unknown[] = [];
          for (let index = 0; index <= c.maxItems; index += 1) {
            over.push(nextUniqueItem(over, one, c.uniqueBy));
          }
          expect(issuesAt(validate(node, over, defs), []).length, `${id}.${name} over max`).toBe(1);
        }
        if (c?.uniqueBy && isPlainObject(one)) {
          const twins = [one, one];
          expect(
            issuesAt(validate(node, twins, defs), [1, c.uniqueBy]).length,
            `${id}.${name} dup`
          ).toBe(1);
        }
      }
      for (const { id, name, schema } of STRUCT_PROPS) {
        const node = resolve(schema, defs);
        const wrong = node.kind === 'array' ? {} : [];
        expect(issuesAt(validate(schema, wrong, defs), []).length, `${id}.${name}`).toBe(1);
        expect(issuesAt(validate(schema, 'text', defs), []).length).toBe(1);
      }
    });
  });

  describe('unions, unknown keys and edits', () => {
    it('names and matches union variants by their tags', () => {
      const format = chartStructSchema('charts-gauge', 'format');
      if (!format) throw new Error('charts-gauge.format schema missing');
      const node = resolve(format.schema, defs);
      expect(node.kind).toBe('union');
      if (node.kind !== 'union') return;
      expect(node.variants.map((variant, index) => variantLabel(variant, index))).toEqual([
        'number',
        'date',
      ]);
      expect(matchVariant(node.variants, { type: 'date' }, defs)).toBe(1);
      expect(matchVariant(node.variants, { type: 'number', style: 'percent' }, defs)).toBe(0);
      expect(matchVariant(node.variants, { type: 'weird' }, defs)).toBe(-1);
      expect(
        issuesAt(validate(node, { type: 'number', style: 'loud' }, defs), ['style'])
      ).toHaveLength(1);
    });

    it('lists unknown keys and removes keys immutably', () => {
      const data = chartStructSchema('charts-pie', 'data');
      if (!data) throw new Error('charts-pie.data schema missing');
      const item = resolve(data.schema, defs);
      if (item.kind !== 'array') throw new Error('expected an array');
      const slice = { id: 'a', label: 'A', value: 1, color: 'red' };
      expect(unknownKeys(item.items, slice)).toEqual(['color']);
      const cleaned = withKey(slice, 'color', undefined);
      expect(cleaned).toEqual({ id: 'a', label: 'A', value: 1 });
      expect(slice).toHaveProperty('color');
    });

    it('edits lists within bounds and leaves out-of-range edits alone', () => {
      const list = ['a', 'b', 'c'];
      expect(editList(list, { action: 'move', index: 0, step: 1 })).toEqual(['b', 'a', 'c']);
      expect(editList(list, { action: 'move', index: 0, step: -1 })).toEqual(list);
      expect(editList(list, { action: 'remove', index: 1 })).toEqual(['a', 'c']);
      expect(editList(list, { action: 'set', index: 5, value: 'z' })).toEqual(list);
      expect(editList(list, { action: 'add', value: 'd' })).toEqual(['a', 'b', 'c', 'd']);
      expect(list).toEqual(['a', 'b', 'c']);
      expect(nextUniqueItem([{ id: 'item-2' }], { id: 'x' }, 'id')).toEqual({ id: 'item-3' });
    });

    it('caps recursive trees', () => {
      const root = chartStructSchema('charts-treemap', 'root');
      if (!root) throw new Error('charts-treemap.root schema missing');
      let deep: Record<string, unknown> = { id: 'leaf', value: 1 };
      for (let level = 0; level < 20; level += 1) deep = { id: `n${level}`, children: [deep] };
      expect(
        validate(root.schema, deep, defs).some((issue) => issue.message.includes('levels deep'))
      ).toBe(true);
    });
  });

  describe('the renderer verdict on the whole prop', () => {
    it('reads unset, kept and refused exactly as sanitizeProps does', () => {
      const manifest = BUILDER_MANIFESTS.find((entry) => entry.id === 'charts-pie');
      const data = manifest?.props.find((prop) => prop.name === 'data');
      const labels = manifest?.props.find((prop) => prop.name === 'labels');
      if (!data || !labels) throw new Error('charts-pie props missing');
      expect(readContainer(data, undefined)).toEqual({ state: 'unset' });
      expect(readContainer(data, [])).toEqual({ state: 'set' });
      // Sub-field breaks are the schema's to flag; the renderer keeps the list.
      expect(readContainer(data, [{ id: 1, color: 'red' }])).toEqual({ state: 'set' });
      for (const wrong of ['oops', {}, 3, null]) {
        expect(readContainer(data, wrong).state, showRaw(wrong)).toBe('invalid');
      }
      for (const wrong of [[], 'oops', null]) {
        expect(readContainer(labels, wrong).state, showRaw(wrong)).toBe('invalid');
      }
      expect(readContainer(labels, {}).state).toBe('set');
    });
  });

  const manifestOf = (id: string) => {
    const manifest = BUILDER_MANIFESTS.find((candidate) => candidate.id === id);
    if (!manifest) throw new Error(`${id} missing`);
    return manifest;
  };
  const propOn = (id: string, name: string) => {
    const prop = manifestOf(id).props.find((candidate) => candidate.name === name);
    if (!prop) throw new Error(`${id}.${name} missing`);
    return prop;
  };

  describe('JSON props checked against the component schemas (PLAN_005 task 5)', () => {
    it('checks every content block family the inspector edits as JSON with that family’s own check; names where a block goes wrong; validates compositions at the untrusted tier, so an unsafe image source is reported; falls back to the renderer’s kind rule where no schema is published, and parses drafts', () => {
      for (const manifest of BUILDER_MANIFESTS.filter((m) => m.id.startsWith('blocks-'))) {
        const block = manifest.props.find((prop) => prop.name === 'block');
        if (!block) continue;
        const family = fieldFamily(manifest.id, block);
        if (family !== 'json') {
          // Text and media blocks have structured editors instead.
          expect(['text-block', 'media-block']).toContain(family);
          continue;
        }
        const check = schemaCheck(manifest.id, 'block');
        expect(check, manifest.id).toBeDefined();
        // The manifest's own example passes; a block of another family does not.
        const examples = propExamples(manifest, 'block');
        expect(examples.length, manifest.id).toBeGreaterThan(0);
        for (const example of examples) {
          expect(
            jsonIssues(block, example.value, check),
            `${manifest.id} ${example.title}`
          ).toEqual([]);
        }
        const foreign = jsonIssues(block, { type: 'heading', level: 2, text: 'Elsewhere' }, check);
        expect(foreign.length, manifest.id).toBeGreaterThan(0);
      }
      // names where a block goes wrong
      {
        const block = propOn('blocks-code', 'block');
        const issues = jsonIssues(
          block,
          { type: 'code', code: 42 },
          schemaCheck('blocks-code', 'block')
        );
        expect(issues.length).toBeGreaterThan(0);
        expect(issues.some((issue) => issue.at.startsWith('$'))).toBe(true);
      }
      // validates compositions at the untrusted tier, so an unsafe image source is reported
      {
        const composition = propOn('media-composition-svg', 'composition');
        const check = schemaCheck('media-composition-svg', 'composition');
        expect(check?.source).toContain('untrusted');
        const valid = { version: 1, width: 320, height: 180, layers: [] };
        expect(jsonIssues(composition, valid, check)).toEqual([]);
        const safe = {
          ...valid,
          layers: [
            {
              id: 'a',
              type: 'image',
              frame: { x: 0, y: 0, width: 100, height: 80 },
              src: '/assets/fictional.webp',
              alt: 'Fictional image',
            },
          ],
        };
        expect(jsonIssues(composition, safe, check)).toEqual([]);
        const unsafe = {
          ...valid,
          layers: [
            {
              id: 'a',
              type: 'image',
              frame: { x: 0, y: 0, width: 100, height: 80 },
              src: 'javascript:alert(1)',
              alt: 'Fictional image',
            },
          ],
        };
        const issues = jsonIssues(composition, unsafe, check);
        expect(
          issues.map((issue) => issue.at),
          JSON.stringify(issues)
        ).toContain('$.layers[0].src');
        expect(jsonIssues(composition, { version: 2 }, check)[0]?.at).toBe('$.version');
      }
      // falls back to the renderer’s kind rule where no schema is published, and parses drafts
      {
        const labels = propOn('blocks-code', 'labels');
        expect(schemaCheck('blocks-code', 'labels')).toBeUndefined();
        expect(jsonIssues(labels, { copy: 'Copy code' })).toEqual([]);
        expect(jsonIssues(labels, ['not', 'an', 'object'])[0]?.message).toContain(
          'refused at paint'
        );
        expect(parseJsonDraft('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
        expect(parseJsonDraft('   ')).toEqual({ ok: true, value: undefined });
        expect(parseJsonDraft('{a:1}').ok).toBe(false);
      }
    });
  });

  describe('props the inspector does not offer, with the reason', () => {
    it('leaves out chart props the catalog types as text but the chart reads as another kind', () => {
      const hidden = BUILDER_MANIFESTS.flatMap((manifest) =>
        inspectorFields(manifest.props)
          .filter((prop) => unsupportedReason(manifest.id, prop))
          .map((prop) => `${manifest.id}.${prop.name}`)
      );
      expect(hidden).toContain('charts-line.interactive');
      expect(hidden).toContain('charts-line.fullDomain');
      expect(hidden).toContain('charts-line.annotations');
      expect(hidden).toContain('charts-pie.innerRatio');
      expect(hidden).toContain('charts-cartesian.interactive');
      expect(hidden).toHaveLength(36);
      expect(unsupportedReason('charts-line', propOn('charts-line', 'interactive'))).toBe(
        'The catalog accepts only text here, but the LineChart chart reads a true or false value, so no blueprint value works yet.'
      );
      // Text the chart really reads as text stays editable.
      expect(unsupportedReason('charts-line', propOn('charts-line', 'title'))).toBeUndefined();
      expect(unsupportedReason('media-image', propOn('media-image', 'alt'))).toBeUndefined();
    });
  });

  describe('the text and JSON field components', () => {
    let app: ReturnType<typeof mount> | undefined;
    afterEach(() => {
      if (app) unmount(app);
      app = undefined;
      document.body.replaceChildren();
    });
    const host = () => {
      const target = document.createElement('div');
      document.body.append(target);
      return target;
    };

    it('a text field shows the player rule and flags a value it would ignore', () => {
      const target = host();
      const changes: unknown[] = [];
      app = mount(StringField, {
        target,
        props: {
          prop: propOn('layout-grid', 'gap') as never,
          value: '1 rem',
          rule: stringRule('layout-grid', 'gap'),
          onchange: (next: unknown) => changes.push(next),
        },
      });
      flushSync();
      const input = target.querySelector('input');
      expect(target.textContent).toContain('player grid layout');
      expect(target.querySelector('[data-severity="warning"]')?.textContent).toContain(
        'ignores this gap'
      );
      if (!input) throw new Error('no input');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(changes).toEqual([undefined]);
    });

    it('a JSON field reports parse errors without saving, saves on blur, and seeds from an example', () => {
      const target = host();
      const changes: unknown[] = [];
      const block = propOn('blocks-code', 'block');
      app = mount(JsonField, {
        target,
        props: {
          prop: block,
          value: undefined,
          check: schemaCheck('blocks-code', 'block'),
          examples: propExamples(manifestOf('blocks-code'), 'block'),
          onchange: (next: unknown) => changes.push(next),
        },
      });
      flushSync();
      const textarea = target.querySelector('textarea');
      if (!textarea) throw new Error('no textarea');
      textarea.value = '{"type": "code",';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      expect(target.querySelector('[data-json-issues]')?.textContent).toContain('Not valid JSON');
      textarea.dispatchEvent(new FocusEvent('blur'));
      expect(changes).toEqual([]);
      textarea.value = '{"type": "code", "code": 42}';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      flushSync();
      expect(target.querySelector('[data-json-issues] li')).not.toBeNull();
      textarea.dispatchEvent(new FocusEvent('blur'));
      expect(changes).toEqual([{ type: 'code', code: 42 }]);
      const example = [...target.querySelectorAll('button')].find((button) =>
        button.textContent?.startsWith('Use example')
      );
      example?.click();
      expect(changes[1]).toEqual({ type: 'code', code: 'n = 1' });
    });
  });
});

describe('keyboard', () => {
  /**
   * Builder keyboard navigation (Task 75): inspector item lists move with
   * Alt+Arrow, focus follows the item after a move or removal, and a status
   * says what happened.
   */

  describe('list focus rules', () => {
    it.each([
      ['up', 2, 3, { index: 1, control: 'up' }],
      ['up', 0, 3, { index: 0, control: 'up' }],
      ['down', 0, 3, { index: 1, control: 'down' }],
      ['down', 2, 3, { index: 2, control: 'down' }],
      ['remove', 1, 2, { index: 1, control: 'remove' }],
      ['remove', 2, 2, { index: 1, control: 'remove' }],
      ['remove', 0, 0, { index: null, control: null }],
    ] as const)(
      'after %s on item %i with %i left, focus goes to %o',
      (control, index, count, target) => {
        expect(listFocusAfter(control, index, count)).toEqual(target);
      }
    );

    it('reads only plain Alt+ArrowUp and Alt+ArrowDown as moves; announces positions 1-based and the count left', () => {
      // reads only plain Alt+ArrowUp and Alt+ArrowDown as moves
      {
        const key = (key: string, mods: Partial<KeyboardEvent> = {}) =>
          listMoveKey({
            key,
            altKey: true,
            ctrlKey: false,
            metaKey: false,
            shiftKey: false,
            ...mods,
          });
        expect(key('ArrowUp')).toBe('up');
        expect(key('ArrowDown')).toBe('down');
        expect(key('ArrowUp', { altKey: false })).toBeNull();
        expect(key('ArrowUp', { shiftKey: true })).toBeNull();
        expect(key('ArrowUp', { metaKey: true })).toBeNull();
        expect(key('ArrowLeft')).toBeNull();
      }
      expect(listAnnouncement('image', 'up', 0, 3)).toBe('Image moved to position 1 of 3.');
      expect(listAnnouncement('item', 'remove', 0, 2)).toBe('Item removed. 2 left.');
      expect(listAnnouncement('item', 'remove', 0, 0)).toBe('Item removed. The list is empty.');
    });
  });

  /** A tiny editor like the inspector's: each button rewrites the list, keyed by index. */
  function mountList(values: string[], options: { nested?: boolean } = {}) {
    const root = document.createElement('div');
    document.body.append(root);
    const list = document.createElement('fieldset');
    root.append(list);
    const action = listKeyboard(list, { label: 'item' });
    const render = () => {
      for (const old of [
        ...list.querySelectorAll(':scope > [data-list-item], :scope > [data-list-control="add"]'),
      ])
        old.remove();
      values.forEach((value, index) => {
        const item = document.createElement('div');
        item.setAttribute('data-list-item', '');
        const field = document.createElement('input');
        field.value = value;
        field.setAttribute('aria-label', `Item ${index + 1}`);
        const button = (control: string, text: string, disabled: boolean, run: () => void) => {
          const element = document.createElement('button');
          element.type = 'button';
          element.textContent = text;
          element.disabled = disabled;
          element.setAttribute('data-list-control', control);
          element.addEventListener('click', () => {
            run();
            render();
          });
          return element;
        };
        const swap = (a: number, b: number) => {
          [values[a], values[b]] = [values[b] as string, values[a] as string];
        };
        item.append(
          field,
          button('up', `Move item ${index + 1} up`, index === 0, () => swap(index, index - 1)),
          button('down', `Move item ${index + 1} down`, index === values.length - 1, () =>
            swap(index, index + 1)
          ),
          button('remove', `Remove item ${index + 1}`, false, () => values.splice(index, 1))
        );
        if (options.nested && index === 0) {
          // A nested list inside an item handles its own keys and controls.
          const inner = document.createElement('div');
          listKeyboard(inner, { label: 'point' });
          const innerItem = document.createElement('div');
          innerItem.setAttribute('data-list-item', '');
          const innerField = document.createElement('input');
          innerField.setAttribute('aria-label', 'Point 1');
          innerItem.append(innerField);
          inner.append(innerItem);
          item.append(inner);
        }
        list.insertBefore(item, list.querySelector(':scope > [data-list-status]'));
      });
      const add = document.createElement('button');
      add.type = 'button';
      add.textContent = 'Add item';
      add.setAttribute('data-list-control', 'add');
      list.insertBefore(add, list.querySelector(':scope > [data-list-status]'));
    };
    render();
    return { list, values, action, root };
  }

  const settle = () => new Promise((done) => setTimeout(done, 10));
  const focusedText = () => (document.activeElement as HTMLElement | null)?.textContent ?? '';
  const focusedLabel = () =>
    (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? '';
  const status = (list: HTMLElement) =>
    list.querySelector(':scope > [data-list-status]')?.textContent;
  const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    );

  describe('listKeyboard action', () => {
    afterEach(() => {
      document.body.replaceChildren();
    });

    it('keeps focus on the moved item after a Move button', async () => {
      const { list, values } = mountList(['a', 'b', 'c']);
      const up = [...list.querySelectorAll('button')].find(
        (b) => b.textContent === 'Move item 3 up'
      ) as HTMLButtonElement;
      up.focus();
      up.click();
      await settle();
      expect(values).toEqual(['a', 'c', 'b']);
      // The moved item ("c") is now item 2; focus is on its Move up control.
      expect(focusedText()).toBe('Move item 2 up');
      expect(status(list)).toBe('Item moved to position 2 of 3.');
    });

    it('falls back to another control when the followed one is disabled at the edge', async () => {
      const { list } = mountList(['a', 'b']);
      const up = [...list.querySelectorAll('button')].find(
        (b) => b.textContent === 'Move item 2 up'
      ) as HTMLButtonElement;
      up.focus();
      up.click();
      await settle();
      // Item 1's Move up is disabled: focus lands on a live control of the same item, not on the page.
      expect(document.activeElement).not.toBe(document.body);
      expect(focusedText()).toMatch(/item 1/);
    });

    it('moves the item with Alt+Arrow and keeps the same field focused', async () => {
      const { list, values } = mountList(['a', 'b', 'c']);
      const field = list.querySelectorAll('input')[0] as HTMLInputElement;
      field.focus();
      press(field, 'ArrowDown', { altKey: true });
      await settle();
      expect(values).toEqual(['b', 'a', 'c']);
      expect(focusedLabel()).toBe('Item 2');
      expect((document.activeElement as HTMLInputElement).value).toBe('a');
      // At the end of the list the key does nothing and nothing breaks.
      press(document.activeElement as Element, 'ArrowDown', { altKey: true });
      press(document.activeElement as Element, 'ArrowDown', { altKey: true });
      await settle();
      expect(values).toEqual(['b', 'c', 'a']);
      expect(focusedLabel()).toBe('Item 3');
    });

    it('after Remove, focuses the next item, then the previous one, then Add', async () => {
      const { list, values } = mountList(['a', 'b']);
      const remove = () =>
        [...list.querySelectorAll('button')].find((b) =>
          b.textContent?.startsWith('Remove')
        ) as HTMLButtonElement;
      const last = [...list.querySelectorAll('button')].find(
        (b) => b.textContent === 'Remove item 2'
      ) as HTMLButtonElement;
      last.focus();
      last.click();
      await settle();
      expect(values).toEqual(['a']);
      expect(focusedText()).toBe('Remove item 1');
      expect(status(list)).toBe('Item removed. 1 left.');
      remove().click();
      await settle();
      expect(values).toEqual([]);
      expect(focusedText()).toBe('Add item');
      expect(status(list)).toBe('Item removed. The list is empty.');
    });

    it('leaves keys inside a nested list to that list', async () => {
      const { list, values } = mountList(['a', 'b'], { nested: true });
      const innerField = list.querySelector('[aria-label="Point 1"]') as HTMLInputElement;
      innerField.focus();
      press(innerField, 'ArrowDown', { altKey: true });
      await settle();
      // The nested point list has no move controls, so nothing moved in the outer list.
      expect(values).toEqual(['a', 'b']);
    });

    it('ignores plain arrows, so text fields keep their caret keys', async () => {
      const { list, values } = mountList(['a', 'b']);
      const field = list.querySelectorAll('input')[0] as HTMLInputElement;
      field.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
      });
      field.dispatchEvent(event);
      await settle();
      expect(event.defaultPrevented).toBe(false);
      expect(values).toEqual(['a', 'b']);
    });
  });

  describe('F6 pane cycling', () => {
    afterEach(() => {
      document.body.replaceChildren();
    });

    it('steps forward and back, wrapping, and enters from outside at either end', () => {
      expect(nextPane(0, 6, false)).toBe(1);
      expect(nextPane(5, 6, false)).toBe(0);
      expect(nextPane(0, 6, true)).toBe(5);
      expect(nextPane(-1, 6, false)).toBe(0);
      expect(nextPane(-1, 6, true)).toBe(5);
      expect(nextPane(-1, 0, false)).toBe(-1);
      expect(isPaneKey({ key: 'F6', altKey: false, ctrlKey: false, metaKey: false })).toBe(true);
      expect(isPaneKey({ key: 'F6', altKey: false, ctrlKey: true, metaKey: false })).toBe(false);
    });

    /** Three panes: two buttons, a nested pane with a field, and an empty pane. */
    function mountPanes() {
      const root = document.createElement('section');
      const pane = (name: string) => {
        const element = document.createElement('div');
        element.setAttribute('data-builder-pane', '');
        element.setAttribute('aria-label', name);
        return element;
      };
      const button = (text: string, disabled = false) => {
        const element = document.createElement('button');
        element.textContent = text;
        element.disabled = disabled;
        return element;
      };
      const first = pane('First');
      first.append(button('Off', true), button('One'), button('Two'));
      const second = pane('Second');
      const inner = pane('Inner');
      const field = document.createElement('input');
      field.setAttribute('aria-label', 'Field');
      inner.append(field);
      second.append(button('Three'), inner);
      const empty = pane('Empty');
      root.append(first, second, empty);
      document.body.append(root);
      paneCycle(root);
      return root;
    }
    const f6 = (shiftKey = false) =>
      (document.activeElement ?? document.body).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F6', shiftKey, bubbles: true, cancelable: true })
      );
    const active = () => {
      const element = document.activeElement as HTMLElement;
      return element.getAttribute('aria-label') ?? element.textContent;
    };

    it('cycles panes in order, skips disabled controls, restores the last focus and focuses an empty pane', () => {
      const root = mountPanes();
      (root.querySelector('button:nth-of-type(3)') as HTMLButtonElement).focus(); // "Two"
      f6();
      expect(active()).toBe('Three');
      f6();
      expect(active()).toBe('Field'); // the nested pane
      f6();
      expect(active()).toBe('Empty'); // nothing focusable: the pane itself
      f6();
      expect(active()).toBe('Two'); // restored, not the first enabled button
      f6(true);
      expect(active()).toBe('Empty');
    });

    it('leaves F6 alone when an inner widget already handled it (the player frames)', () => {
      const root = mountPanes();
      const one = root.querySelector('button:nth-of-type(2)') as HTMLButtonElement;
      one.focus();
      one.addEventListener('keydown', (event) => event.preventDefault(), { once: true });
      f6();
      expect(active()).toBe('One');
    });
  });

  /**
   * Outline multi-select and node operations (PLAN_005 task 4), on the mounted
   * builder: Shift/Ctrl selection, group Alt+Arrow moves and Delete, and
   * Ctrl/Cmd+D, C and V, each one labeled undo step. Pointer drags are
   * asserted in the browser spec; happy-dom has no layout to drop onto.
   */
  describe('outline node operations', () => {
    const text = (markdown: string, id?: string): CatalogTreeInput => ({
      id: 'blocks-text',
      props: { block: id ? { type: 'text', id, markdown } : { type: 'text', markdown } },
    });
    const DRAFT: CatalogTreeInput = {
      id: 'layout-page',
      props: { title: 'Fictional pier notes' },
      children: [
        text('alpha'),
        text('bravo', 'bravo'),
        { id: 'layout-card', props: { title: 'Box' }, children: [text('charlie')] },
        text('delta'),
      ],
    };

    let app: ReturnType<typeof mount> | undefined;
    afterEach(() => {
      if (app) unmount(app);
      app = undefined;
      document.body.replaceChildren();
    });

    async function mountBuilder(initial: CatalogTreeInput = DRAFT, initialSelection = [0]) {
      const target = document.createElement('div');
      document.body.append(target);
      app = mount(BuilderApp, { target, props: { initial, initialSelection } });
      await flush();
      return target;
    }
    const flush = async () => {
      flushSync();
      await tick();
      await settle();
    };
    const row = (root: Element, key: string) => {
      const element = root.querySelector<HTMLElement>(`[data-builder-row="${key}"]`);
      if (!element) throw new Error(`no row ${key}`);
      return element;
    };
    const selectedKeys = (root: Element) =>
      [...root.querySelectorAll('[role="treeitem"][aria-selected="true"]')].map((element) =>
        element.getAttribute('data-builder-row')
      );
    const draft = (root: Element): CatalogTreeInput =>
      JSON.parse(
        root.querySelector<HTMLTextAreaElement>('[data-builder-payload] textarea')?.value ?? '{}'
      );
    /** Reading-order markdown and block ids: what a structural op must change or keep. */
    const texts = (tree: CatalogTreeInput): string[] => {
      const out: string[] = [];
      const visit = (node: CatalogTreeInput) => {
        const block = node.props?.block as { markdown?: string; id?: string } | undefined;
        if (block?.markdown) out.push(block.id ? `${block.markdown}#${block.id}` : block.markdown);
        for (const child of node.children ?? []) visit(child);
      };
      visit(tree);
      return out;
    };
    const outlineStatus = (root: Element) =>
      root.querySelector('[data-outline-status]')?.textContent ?? '';
    const button = (root: Element, name: string) => {
      const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
        (element) => element.textContent?.trim() === name
      );
      if (!found) throw new Error(`no button ${name}`);
      return found;
    };
    const undoTitle = (root: Element) => button(root, 'Undo').title;
    const key = async (target: Element, name: string, init: KeyboardEventInit = {}) => {
      press(target, name, init);
      await flush();
    };

    it('extends with Shift+Arrow, toggles with Space and Ctrl+click, ranges with Shift+click', async () => {
      const root = await mountBuilder();
      expect(root.querySelector('[role="tree"]')?.getAttribute('aria-multiselectable')).toBe(
        'true'
      );
      expect(selectedKeys(root)).toEqual(['0']);
      await key(row(root, '0'), 'ArrowDown', { shiftKey: true });
      expect(selectedKeys(root)).toEqual(['0', '1']);
      expect(document.activeElement).toBe(row(root, '1'));
      await key(row(root, '1'), ' ');
      expect(selectedKeys(root)).toEqual(['0']);
      row(root, '3').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      await flush();
      expect(selectedKeys(root)).toEqual(['0', '3']);
      row(root, '1').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
      await flush();
      // The anchor is the last toggled row (3): the range runs 1 → 3 in reading order.
      expect(selectedKeys(root)).toEqual(['1', '2', '2.0', '3']);
      await key(row(root, '1'), 'Escape');
      expect(selectedKeys(root)).toEqual(['1']);
      await key(row(root, '1'), 'a', { ctrlKey: true });
      expect(selectedKeys(root)).toHaveLength(6);
      // A plain click collapses to one row again.
      row(root, '3').click();
      await flush();
      expect(selectedKeys(root)).toEqual(['3']);
    });

    it('moves a selection with Alt+Arrow as one labeled step, and the selection follows', async () => {
      const root = await mountBuilder();
      await key(row(root, '0'), 'ArrowDown', { shiftKey: true });
      await key(row(root, '1'), 'ArrowDown', { altKey: true });
      expect(texts(draft(root))).toEqual(['charlie', 'alpha', 'bravo#bravo', 'delta']);
      expect(outlineStatus(root)).toBe('Moved 2 components.');
      expect(selectedKeys(root)).toEqual(['1', '2']);
      expect(undoTitle(root)).toBe('Undo: Move Text blocks and 1 more');
      // A second step, then all or nothing: once bravo is last, the group move down is refused.
      await key(row(root, '1'), 'ArrowDown', { altKey: true });
      expect(texts(draft(root))).toEqual(['charlie', 'delta', 'alpha', 'bravo#bravo']);
      await key(row(root, '2'), 'ArrowDown', { altKey: true });
      expect(outlineStatus(root)).toBe(
        'One of the selected components is already last in its group.'
      );
      expect(texts(draft(root))).toEqual(['charlie', 'delta', 'alpha', 'bravo#bravo']);
      button(root, 'Undo').click();
      await flush();
      button(root, 'Undo').click();
      await flush();
      expect(draft(root)).toEqual(DRAFT);
      // Undo brings the whole group back selected.
      expect(selectedKeys(root)).toEqual(['0', '1']);
    });

    it('deletes a selection as one undoable step', async () => {
      const root = await mountBuilder();
      await key(row(root, '0'), ' ');
      row(root, '3').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      await flush();
      row(root, '1').dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
      await flush();
      expect(button(root, 'Remove 2 components').disabled).toBe(false);
      await key(row(root, '1'), 'Delete');
      expect(texts(draft(root))).toEqual(['alpha', 'charlie']);
      expect(outlineStatus(root)).toBe('Removed 2 components.');
      expect(undoTitle(root)).toBe('Undo: Remove Text blocks and 1 more');
      button(root, 'Undo').click();
      await flush();
      expect(draft(root)).toEqual(DRAFT);
      expect(selectedKeys(root)).toEqual(['1', '3']);
    });

    it('duplicates with Ctrl+D: right after each original, fresh block ids, selected, undoable', async () => {
      const root = await mountBuilder(DRAFT, [1]);
      await key(row(root, '1'), 'd', { ctrlKey: true });
      expect(texts(draft(root))).toEqual([
        'alpha',
        'bravo#bravo',
        'bravo#bravo-copy',
        'charlie',
        'delta',
      ]);
      expect(selectedKeys(root)).toEqual(['2']);
      expect(document.activeElement).toBe(row(root, '2'));
      expect(outlineStatus(root)).toBe('Duplicated Text blocks.');
      expect(undoTitle(root)).toBe('Undo: Duplicate Text blocks');
      // A group duplicate through the button: the card carries its child.
      await key(row(root, '2'), 'ArrowDown', { shiftKey: true });
      button(root, 'Duplicate').click();
      await flush();
      expect(texts(draft(root))).toEqual([
        'alpha',
        'bravo#bravo',
        'bravo#bravo-copy',
        'bravo#bravo-copy-2',
        'charlie',
        'charlie',
        'delta',
      ]);
      expect(undoTitle(root)).toBe('Undo: Duplicate 2 components');
      button(root, 'Undo').click();
      await flush();
      button(root, 'Undo').click();
      await flush();
      expect(draft(root)).toEqual(DRAFT);
    });

    it('copies with Ctrl+C and pastes with Ctrl+V inside a container or after a leaf', async () => {
      const root = await mountBuilder(DRAFT, [1]);
      expect(button(root, 'Paste').disabled).toBe(true);
      await key(row(root, '1'), 'c', { ctrlKey: true });
      expect(outlineStatus(root)).toContain('Copied Text blocks.');
      // Copying changes nothing and adds no history step.
      expect(draft(root)).toEqual(DRAFT);
      expect(button(root, 'Undo').disabled).toBe(true);
      expect(button(root, 'Paste').disabled).toBe(false);
      row(root, '2').click();
      await flush();
      await key(row(root, '2'), 'v', { metaKey: true });
      expect(texts(draft(root))).toEqual([
        'alpha',
        'bravo#bravo',
        'charlie',
        'bravo#bravo-copy',
        'delta',
      ]);
      expect(selectedKeys(root)).toEqual(['2.1']);
      expect(undoTitle(root)).toBe('Undo: Paste Text blocks');
      // On a leaf, the paste lands right after it, with yet another fresh id.
      await key(row(root, '2.1'), 'v', { ctrlKey: true });
      expect(texts(draft(root))).toEqual([
        'alpha',
        'bravo#bravo',
        'charlie',
        'bravo#bravo-copy',
        'bravo#bravo-copy-2',
        'delta',
      ]);
    });

    it('refuses a paste that breaks the page structure, visibly, without a history step', async () => {
      // A doc layout nested in a page is already one structural error; a second one adds another.
      const withDoc: CatalogTreeInput = {
        id: 'layout-page',
        props: { title: 'Fictional' },
        children: [{ id: 'layout-doc', props: { title: 'Doc' }, children: [] }, text('alpha')],
      };
      const root = await mountBuilder(withDoc, [0]);
      await key(row(root, '0'), 'c', { ctrlKey: true });
      row(root, '1').click();
      await flush();
      await key(row(root, '1'), 'v', { ctrlKey: true });
      expect(outlineStatus(root)).toBe(
        'That change would break the page structure, so it was not applied.'
      );
      expect(draft(root)).toEqual(withDoc);
      expect(button(root, 'Undo').disabled).toBe(true);
      // Duplicating it is refused the same way.
      row(root, '0').click();
      await flush();
      await key(row(root, '0'), 'd', { ctrlKey: true });
      expect(draft(root)).toEqual(withDoc);
    });
  });
});
