/**
 * Slide builder: the nodes of one slide → a v2 slide object (not yet
 * validated), with fragments numbered the reveal.js way and a source map
 * from JSON paths to Markdown positions. Free slides get blocks; the 20
 * catalog layouts map headings, paragraphs, lists, images, tables and `:::`
 * regions onto their props; `component`, `custom` and `::: props` / `::: slide`
 * fences carry bounded JSON.
 */

import { texToMath } from '../math/index.ts';
import { SLIDE_MASTERS } from '../model/deck.ts';
import { DECK_CATALOG_LAYOUT_IDS, type DeckCatalogLayoutId } from '../model/layouts/catalog.ts';
import { type PathSegment, toJsonPath } from '../schema/index.ts';
import { type Attr } from './attributes.ts';
import {
  type ElementRead,
  type MarkSpec,
  readElement,
  readSlideAttrs,
  type SlideAttrRead,
} from './attrs-closed.ts';
import type { Attrs, ListItemNode, MdNode, SlideSource, Src } from './blocks.ts';
import type { IssueSink } from './issues.ts';
import { readJson } from './json.ts';
import { DECK_MARKDOWN_LIMITS } from './limits.ts';
import { unescapeInline } from './text.ts';

type Bag = Record<string, unknown>;

/** Shared state across the slides of one document. */
export interface BuildContext {
  sink: IssueSink;
  /** JSON path → source position. */
  map: Map<string, Src>;
  /** JSON values still allowed in fence bodies. */
  jsonBudget: { nodes: number };
}

export interface BuiltSlide {
  slide: Bag;
  attrs: SlideAttrRead;
  src: Src;
}

type DirectiveNode = MdNode & { kind: 'directive' };

/** One fragment target in document order. */
type Mark =
  | { kind: 'one'; target: Bag; spec: MarkSpec }
  | { kind: 'items'; target: Bag; specs: (MarkSpec | undefined)[]; src: Src };

class SlideBuilder {
  readonly ctx: BuildContext;
  readonly base: PathSegment[];
  readonly marks: Mark[] = [];

  constructor(ctx: BuildContext, base: PathSegment[]) {
    this.ctx = ctx;
    this.base = base;
  }

  get sink(): IssueSink {
    return this.ctx.sink;
  }

  record(path: readonly PathSegment[], src: Src): void {
    const key = toJsonPath([...this.base, ...path]);
    if (!this.ctx.map.has(key)) this.ctx.map.set(key, src);
  }

  /** Read element/brace attributes onto `target`: id, fragment marks and allowed extras. */
  element(target: Bag, attrs: Attrs | undefined, allowed: readonly string[] = []): ElementRead {
    const read = readElement(attrs?.list ?? [], new Set(allowed), this.sink);
    if (read.id !== undefined) target.id = read.id;
    if (read.mark) {
      if (read.mark.fragment) this.marks.push({ kind: 'one', target, spec: read.mark });
      else if (read.mark.tone !== undefined) target.tone = read.mark.tone;
    }
    return read;
  }

  extra(node: { src: Src }, what: string): void {
    this.sink.report(
      'md-layout-extra',
      `${what} has no place in this layout.`,
      node.src,
      this.base,
      'Remove it, use a free slide, or write the props as a `::: props` JSON fence.'
    );
  }

  missing(src: Src, what: string, path: PathSegment[]): void {
    this.sink.report(
      'md-layout-missing',
      `This layout needs ${what}.`,
      src,
      [...this.base, ...path],
      'Add it, or check the layout sample in the layout catalog.'
    );
  }

  /** Parse a JSON fence body; record every value's position. */
  json(node: DirectiveNode, path: PathSegment[]): unknown {
    const body = node.body ?? '';
    const result = readJson(body, { nodes: this.ctx.jsonBudget.nodes });
    this.ctx.jsonBudget.nodes = Math.max(0, this.ctx.jsonBudget.nodes - result.nodes);
    const where = (offset: number): Src => {
      let line = node.bodyLine ?? node.src.line + 1;
      let lineStart = 0;
      for (let i = 0; i < offset && i < body.length; i++) {
        if (body.charCodeAt(i) === 0x0a) {
          line++;
          lineStart = i + 1;
        }
      }
      return { line, column: offset - lineStart + 1 };
    };
    if (!result.ok) {
      this.sink.report(
        result.limit ? 'md-json-limit' : 'md-json',
        result.message,
        where(result.offset),
        [...this.base, ...path],
        'Write one JSON object between the opening `::: …` line and a closing `:::` line.'
      );
      return undefined;
    }
    // Offsets → positions in one pass over the body.
    const entries = [...result.offsets.entries()].sort((a, b) => a[1] - b[1]);
    let line = node.bodyLine ?? node.src.line + 1;
    let lineStart = 0;
    let i = 0;
    for (const [relative, offset] of entries) {
      for (; i < offset && i < body.length; i++) {
        if (body.charCodeAt(i) === 0x0a) {
          line++;
          lineStart = i + 1;
        }
      }
      const suffix = relative.slice(1);
      const key = `${toJsonPath([...this.base, ...path])}${suffix}`;
      if (!this.ctx.map.has(key)) this.ctx.map.set(key, { line, column: offset - lineStart + 1 });
    }
    return result.value;
  }

  jsonObject(node: DirectiveNode, path: PathSegment[], what: string): Bag | undefined {
    const value = this.json(node, path);
    if (value === undefined) return undefined;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      this.sink.report('md-json', `${what} must be a JSON object.`, node.src, [
        ...this.base,
        ...path,
      ]);
      return undefined;
    }
    return value as Bag;
  }

  /** Number the marks: reveal.js order, explicit `step` values kept. */
  numberMarks(): void {
    let counter = 0;
    const apply = (target: Bag, spec: MarkSpec, step: number) => {
      target.step = step;
      if (spec.effect !== undefined) target.fragment = spec.effect;
      if (spec.reveal !== undefined) target.reveal = spec.reveal;
      if (spec.tone !== undefined) target.tone = spec.tone;
    };
    const at = (mark: Mark): [number, number] =>
      mark.kind === 'one' ? [mark.spec.line, mark.spec.column] : [mark.src.line, mark.src.column];
    const ordered = this.marks
      .map((mark, index) => ({ mark, index }))
      .sort((a, b) => {
        const [la, ca] = at(a.mark);
        const [lb, cb] = at(b.mark);
        return la - lb || ca - cb || a.index - b.index;
      })
      .map(({ mark }) => mark);
    for (const mark of ordered) {
      if (mark.kind === 'one') {
        const step = mark.spec.step ?? counter + 1;
        counter = Math.max(counter, step);
        if (Array.isArray(mark.target.items)) {
          counter = Math.max(counter, step + mark.target.items.length - 1);
        }
        apply(mark.target, mark.spec, step);
        continue;
      }
      const marked = mark.specs.filter((spec): spec is MarkSpec => spec?.fragment === true);
      const first = marked[0];
      if (!first) continue;
      const n = mark.specs.length;
      const same =
        marked.length === n &&
        marked.every(
          (spec, i) =>
            spec.effect === first.effect &&
            spec.tone === first.tone &&
            spec.reveal === first.reveal &&
            (i === 0 || spec.step === undefined)
        );
      if (!same) {
        this.sink.report(
          'md-fragment-approximated',
          'List items reveal one after another with one effect; these item fragments differ, so the list steps as a whole from its first fragment.',
          mark.src,
          this.base,
          'Mark every item with the same effect, or none.'
        );
      }
      const step = first.step ?? counter + 1;
      counter = Math.max(counter, step + n - 1);
      apply(mark.target, first, step);
    }
  }

  // -------------------------------------------------------------------------
  // Free slides

  freeBlocks(nodes: readonly MdNode[]): Bag[] {
    const blocks: Bag[] = [];
    for (const node of nodes) {
      const path: PathSegment[] = ['blocks', blocks.length];
      const block = this.freeBlock(node, path);
      if (block) {
        this.record(path, node.src);
        blocks.push(block);
      }
    }
    return blocks;
  }

  freeBlock(node: MdNode, path: PathSegment[]): Bag | undefined {
    switch (node.kind) {
      case 'heading': {
        const block: Bag = { type: 'heading', level: node.level, text: unescapeInline(node.text) };
        this.element(block, node.attrs);
        return block;
      }
      case 'paragraph': {
        const block: Bag = { type: 'text', markdown: node.text };
        this.element(block, node.attrs);
        return block;
      }
      case 'list': {
        const block: Bag = { type: 'list', items: node.items.map((item) => ({ text: item.text })) };
        if (node.ordered) block.ordered = true;
        node.items.forEach((item, i) => {
          this.record([...path, 'items', i], item.src);
        });
        this.listMarks(block, node.items, node.src);
        this.element(block, node.attrs);
        return block;
      }
      case 'quote': {
        const block: Bag = { type: 'quote', quote: node.text };
        if (node.cite !== undefined) block.cite = unescapeInline(node.cite);
        this.element(block, node.attrs);
        return block;
      }
      case 'table': {
        const columns = node.header.map((label, i) => ({
          id: `c${i + 1}`,
          label: unescapeInline(label),
        }));
        const rows = node.rows.map((row, r) => {
          this.record([...path, 'rows', r], row.src);
          if (row.attrs) {
            this.sink.report(
              'md-fragment-not-steppable',
              'Table rows of a free slide do not reveal one by one; the attributes were dropped.',
              row.attrs.src,
              [...this.base, ...path, 'rows', r]
            );
          }
          const out: Bag = {};
          columns.forEach((column, c) => {
            const cell = row.cells[c];
            out[column.id] = cell === undefined || cell === '' ? null : unescapeInline(cell);
          });
          return out;
        });
        const block: Bag = { type: 'table', columns, rows };
        this.element(block, node.attrs);
        return block;
      }
      case 'image': {
        const block: Bag = { type: 'image', src: node.url, alt: unescapeInline(node.alt) };
        const read = this.element(block, node.attrs, ['width', 'height', 'decorative']);
        this.dimensions(block, read);
        if (read.other.has('decorative')) {
          block.decorative = true;
          delete block.alt;
        }
        if (node.title !== undefined) block.caption = node.title;
        return block;
      }
      case 'rule': {
        const block: Bag = { type: 'divider' };
        this.element(block, node.attrs);
        return block;
      }
      case 'code': {
        const block: Bag = { type: 'code', code: node.code };
        if (node.lang !== undefined) block.lang = node.lang;
        if (node.highlights !== undefined) block.highlights = node.highlights;
        const brace = this.element(block, node.brace, ['filename', 'caption', 'numbers']);
        const filename = brace.other.get('filename');
        if (filename && filename.value !== true) block.filename = filename.value;
        const caption = brace.other.get('caption');
        if (caption && caption.value !== true) block.caption = caption.value;
        if (brace.other.has('numbers')) block.lineNumbers = true;
        this.element(block, node.attrs);
        return block;
      }
      case 'math': {
        const block: Bag = { type: 'math', tex: node.tex };
        const math = texToMath(node.tex, { display: true });
        for (const issue of math.issues) {
          this.sink.report(
            issue.code === 'tex-limit' ? 'md-tex-limit' : 'md-tex-unsupported',
            issue.message,
            node.src,
            [...this.base, ...path, 'tex'],
            'Use the supported TeX subset (see @texuli/deck/math); the formula shows as source text.'
          );
        }
        this.element(block, node.attrs);
        return block;
      }
      case 'directive':
        return this.freeDirective(node, path);
    }
  }

  dimensions(target: Bag, read: ElementRead): void {
    for (const name of ['width', 'height'] as const) {
      const attr = read.other.get(name);
      if (!attr) continue;
      const value = attr.value === true ? Number.NaN : Number(attr.value);
      if (
        !Number.isInteger(value) ||
        value < 1 ||
        value > 4096 ||
        !/^\d+$/.test(String(attr.value))
      ) {
        this.sink.report('md-attr-value', `"${name}" is a whole number of pixels from 1 to 4096.`, {
          line: attr.line,
          column: attr.column,
        });
        continue;
      }
      target[name] = value;
    }
  }

  listMarks(target: Bag, items: readonly ListItemNode[], src: Src): void {
    const specs = items.map((item) => {
      if (!item.attrs) return undefined;
      const read = readElement(item.attrs.list, new Set(), this.sink);
      if (read.id !== undefined) {
        this.sink.report('md-attr-value', 'List items have no id; it was dropped.', item.attrs.src);
      }
      return read.mark;
    });
    if (specs.some((spec) => spec?.fragment === true)) {
      this.marks.push({ kind: 'items', target, specs, src });
    }
  }

  freeDirective(node: DirectiveNode, path: PathSegment[]): Bag | undefined {
    if (node.name === 'component') {
      const id = node.arg ?? '';
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) {
        this.sink.report(
          'md-attr-value',
          '`::: component` needs a catalog component id.',
          node.src,
          [...this.base, ...path],
          'Write `::: component chart-bar` (a lowercase catalog id).'
        );
        return undefined;
      }
      const props =
        (node.body ?? '').trim() === ''
          ? {}
          : this.jsonObject(node, [...path, 'props'], 'Component props');
      if (props === undefined) return undefined;
      const item: Bag = { type: 'component', component: id, props };
      const read = this.element(item, node.brace, ['height']);
      const height = read.other.get('height');
      if (height && height.value !== true) item.height = height.value;
      this.element(item, node.attrs);
      return item;
    }
    if (node.name === 'block') {
      const body = this.jsonObject(node, path, 'A `::: block` body');
      if (body === undefined) return undefined;
      if (node.arg !== undefined) {
        if (body.type !== undefined && body.type !== node.arg) {
          this.sink.report(
            'md-attr-value',
            `The body's type "${String(body.type).slice(0, 40)}" differs from "${node.arg}".`,
            node.src,
            [...this.base, ...path]
          );
        }
        body.type ??= node.arg;
      }
      this.element(body, node.brace);
      this.element(body, node.attrs);
      return body;
    }
    this.sink.report(
      'md-region-unknown',
      `"::: ${node.name}" is not allowed on a free slide.`,
      node.src,
      [...this.base, ...path],
      node.name === 'left' || node.name === 'right' || node.name === 'card'
        ? 'Set a layout first: <!-- .slide: layout="two-column-split" -->.'
        : 'Free slides take Markdown, `::: component <id>` and `::: block` fences.'
    );
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Layouts

/** `*text*` as a whole paragraph (no other unescaped `*` inside): its inner text. */
function wrapped(raw: string): string | undefined {
  if (raw.length < 3 || !raw.startsWith('*') || raw.startsWith('**') || !raw.endsWith('*')) {
    return undefined;
  }
  if (raw.endsWith('\\*')) return undefined;
  const inner = raw.slice(1, -1);
  if (/(?<!\\)\*/.test(inner) || /^\s|\s$/.test(inner)) return undefined;
  return inner;
}

/** `**lead** rest` → [lead, rest]. */
function leadSplit(raw: string): { lead: string; rest?: string } | undefined {
  const match = /^\*\*((?:\\.|[^*\\])+)\*\*(?:[ \t]+([\s\S]+))?$/.exec(raw.trim());
  if (!match) return undefined;
  const out: { lead: string; rest?: string } = { lead: match[1] ?? '' };
  if (match[2] !== undefined) out.rest = match[2];
  return out;
}

const plain = unescapeInline;

class Pool {
  readonly nodes: MdNode[];
  constructor(nodes: readonly MdNode[]) {
    this.nodes = [...nodes];
  }
  take<K extends MdNode['kind']>(
    kind: K,
    test: (node: MdNode & { kind: K }) => boolean = () => true
  ): (MdNode & { kind: K }) | undefined {
    const index = this.nodes.findIndex(
      (node) => node.kind === kind && test(node as MdNode & { kind: K })
    );
    if (index === -1) return undefined;
    return this.nodes.splice(index, 1)[0] as MdNode & { kind: K };
  }
  directive(name: string): DirectiveNode | undefined {
    return this.take('directive', (node) => node.name === name);
  }
}

type LayoutBuild = (b: SlideBuilder, pool: Pool, props: Bag, src: Src) => void;

function heading(b: SlideBuilder, pool: Pool, props: Bag, field: string, max: number): void {
  const node = pool.take('heading', (h) => h.level <= max);
  if (node) {
    props[field] = plain(node.text);
    b.record(['props', field], node.src);
  }
}

function subheading(b: SlideBuilder, pool: Pool, target: Bag, path: PathSegment[]): void {
  const node = pool.take('heading', (h) => h.level >= 3);
  if (node) {
    target.heading = plain(node.text);
    b.record([...path, 'heading'], node.src);
  }
}

function italic(
  b: SlideBuilder,
  pool: Pool,
  target: Bag,
  field: string,
  path: PathSegment[],
  prefix = ''
): void {
  const node = pool.take('paragraph', (p) => {
    const inner = wrapped(p.text);
    return (
      inner !== undefined &&
      (prefix === '' ? !/^(?:Credit|Source): /.test(inner) : inner.startsWith(prefix))
    );
  });
  if (node) {
    target[field] = plain((wrapped(node.text) ?? '').slice(prefix.length));
    b.record([...path, field], node.src);
  }
}

function body(b: SlideBuilder, pool: Pool, target: Bag, field: string, path: PathSegment[]): void {
  const node = pool.take('paragraph', (p) => wrapped(p.text) === undefined);
  if (node) {
    target[field] = plain(node.text);
    b.record([...path, field], node.src);
    b.element(target, node.attrs);
  }
}

function imageProp(b: SlideBuilder, pool: Pool, props: Bag, src: Src, overlay = false): void {
  const node = pool.take('image');
  if (!node) {
    b.missing(src, 'an image line: ![alt](src)', ['props', 'image']);
    return;
  }
  const image: Bag = { src: node.url, alt: plain(node.alt) };
  const read = b.element(
    image,
    node.attrs,
    overlay ? ['width', 'height', 'overlay'] : ['width', 'height']
  );
  b.dimensions(image, read);
  const value = read.other.get('overlay');
  if (value && value.value !== true) props.overlay = value.value;
  props.image = image;
  b.record(['props', 'image'], node.src);
}

function region(
  b: SlideBuilder,
  node: DirectiveNode,
  path: PathSegment[],
  allowed: readonly string[] = []
): { target: Bag; pool: Pool; read: ElementRead } {
  const target: Bag = {};
  const read = b.element(target, node.brace, allowed);
  b.element(target, node.attrs);
  b.record(path, node.src);
  return { target, pool: new Pool(node.children ?? []), read };
}

function leftovers(b: SlideBuilder, pool: Pool): void {
  for (const node of pool.nodes)
    b.extra(node, node.kind === 'directive' ? `"::: ${node.name}"` : `This ${node.kind}`);
}

function videoProp(b: SlideBuilder, pool: Pool, props: Bag, src: Src): void {
  const node = pool.directive('video');
  if (!node) {
    b.missing(src, 'a `::: video {src="…"}` region', ['props', 'video']);
    return;
  }
  const {
    target,
    pool: inner,
    read,
  } = region(
    b,
    node,
    ['props', 'video'],
    ['src', 'label', 'width', 'height', 'autoplay', 'loop', 'muted']
  );
  const srcAttr = read.other.get('src');
  if (srcAttr && srcAttr.value !== true) target.src = srcAttr.value;
  else b.missing(node.src, 'a video `src`', ['props', 'video', 'src']);
  const label = read.other.get('label');
  if (label && label.value !== true) target.label = label.value;
  b.dimensions(target, read);
  for (const flag of ['autoplay', 'loop', 'muted'] as const) {
    const attr = read.other.get(flag);
    if (attr) target[flag] = attr.value === true || attr.value === 'true';
  }
  leftovers(b, inner);
  props.video = target;
}

function listItems(
  b: SlideBuilder,
  pool: Pool,
  props: Bag,
  field: string,
  ordered: boolean,
  src: Src,
  read: (item: ListItemNode, out: Bag) => void
): void {
  const node = pool.take('list', (l) => l.ordered === ordered);
  if (!node) {
    b.missing(src, ordered ? 'a numbered list' : 'a bullet list', ['props', field]);
    return;
  }
  props[field] = node.items.map((item, i) => {
    const out: Bag = {};
    read(item, out);
    b.element(out, item.attrs, field === 'people' ? ['avatar'] : []);
    b.record(['props', field, i], item.src);
    return out;
  });
}

const LAYOUTS: Readonly<Record<DeckCatalogLayoutId, LayoutBuild>> = {
  'title-hero'(b, pool, props, src) {
    heading(b, pool, props, 'title', 6);
    if (props.title === undefined) b.missing(src, 'a `# Title` heading', ['props', 'title']);
    body(b, pool, props, 'subtitle', ['props']);
    italic(b, pool, props, 'meta', ['props']);
  },
  'section-divider'(b, pool, props, src) {
    italic(b, pool, props, 'eyebrow', ['props']);
    heading(b, pool, props, 'title', 6);
    if (props.title === undefined) b.missing(src, 'a `# Title` heading', ['props', 'title']);
  },
  'two-column-split'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    for (const side of ['left', 'right'] as const) {
      const node = pool.directive(side);
      if (!node) {
        b.missing(src, `a \`::: ${side}\` region`, ['props', side]);
        continue;
      }
      const { target, pool: inner } = region(b, node, ['props', side]);
      subheading(b, inner, target, ['props', side]);
      body(b, inner, target, 'body', ['props', side]);
      leftovers(b, inner);
      props[side] = target;
    }
  },
  'three-column-cards'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    const cards: Bag[] = [];
    for (let node = pool.directive('card'); node; node = pool.directive('card')) {
      const path = ['props', 'cards', cards.length];
      const { target, pool: inner, read } = region(b, node, path, ['icon']);
      const icon = read.other.get('icon');
      if (icon && icon.value !== true) target.icon = icon.value;
      subheading(b, inner, target, path);
      body(b, inner, target, 'body', path);
      leftovers(b, inner);
      cards.push(target);
    }
    if (cards.length === 0) b.missing(src, 'three `::: card` regions', ['props', 'cards']);
    props.cards = cards;
  },
  'image-left': imageSide,
  'image-right': imageSide,
  'image-centered'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    imageProp(b, pool, props, src);
    italic(b, pool, props, 'caption', ['props']);
  },
  'image-full-bleed'(b, pool, props, src) {
    imageProp(b, pool, props, src, true);
    italic(b, pool, props, 'caption', ['props']);
    italic(b, pool, props, 'credit', ['props'], 'Credit: ');
  },
  quote(b, pool, props, src) {
    const node = pool.take('quote');
    if (!node) {
      b.missing(src, 'a `> quote` block', ['props', 'quote']);
      return;
    }
    props.quote = plain(node.text);
    if (node.cite !== undefined) props.cite = plain(node.cite);
    b.record(['props', 'quote'], node.src);
    b.element(props, node.attrs);
  },
  'code-with-callout'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    const node = pool.take('code');
    if (!node) b.missing(src, 'a code fence', ['props', 'code']);
    else {
      const code: Bag = { lang: node.lang ?? '', source: node.code };
      if (node.highlights !== undefined) code.highlights = node.highlights;
      b.element(code, node.brace);
      b.element(code, node.attrs);
      if (node.lang === undefined)
        b.missing(node.src, 'a code language (```ts)', ['props', 'code', 'lang']);
      props.code = code;
      b.record(['props', 'code'], node.src);
    }
    subheading(b, pool, props, ['props']);
    const list = pool.take('list');
    if (!list) b.missing(src, 'a bullet list', ['props', 'bullets']);
    else {
      props.bullets = list.items.map((item, i) => {
        b.record(['props', 'bullets', i], item.src);
        return plain(item.text);
      });
    }
  },
  'big-stat'(b, pool, props, src) {
    const node = pool.take('paragraph', (p) => leadSplit(p.text)?.rest !== undefined);
    if (!node) b.missing(src, 'a `**number** label` paragraph', ['props', 'number']);
    else {
      const split = leadSplit(node.text);
      props.number = plain(split?.lead ?? '');
      props.label = plain(split?.rest ?? '');
      b.record(['props', 'number'], node.src);
      b.element(props, node.attrs);
    }
    italic(b, pool, props, 'source', ['props'], 'Source: ');
    const context = pool.take('paragraph', (p) => wrapped(p.text) === undefined);
    if (context) {
      props.context = plain(context.text);
      b.record(['props', 'context'], context.src);
    }
  },
  'comparison-table'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    const node = pool.take('table');
    if (!node) {
      b.missing(src, 'a pipe table', ['props', 'rows']);
      return;
    }
    props.columns = node.header.slice(1).map(plain);
    props.rows = node.rows.map((row, i) => {
      const out: Bag = {
        label: plain(row.cells[0] ?? ''),
        values: row.cells.slice(1).map((cell) => {
          const text = plain(cell);
          if (text === 'Yes') return true;
          if (text === 'No') return false;
          return text === '' ? null : text;
        }),
      };
      b.element(out, row.attrs);
      b.record(['props', 'rows', i], row.src);
      return out;
    });
    b.record(['props', 'columns'], node.src);
  },
  'process-steps'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    listItems(b, pool, props, 'steps', true, src, (item, out) => {
      const split = leadSplit(item.text);
      out.title = plain(split?.lead ?? item.text);
      if (split?.rest !== undefined) out.body = plain(split.rest);
    });
  },
  timeline(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    listItems(b, pool, props, 'events', false, src, (item, out) => {
      const split = leadSplit(item.text);
      out.time = plain(split?.lead ?? '');
      out.text = plain(split?.rest ?? item.text);
    });
  },
  'team-avatars'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    const node = pool.take('list', (l) => !l.ordered);
    if (!node) {
      b.missing(src, 'a bullet list of people', ['props', 'people']);
      return;
    }
    props.people = node.items.map((item, i) => {
      const out: Bag = {};
      const split = leadSplit(item.text);
      out.name = plain(split?.lead ?? item.text);
      const role = split?.rest?.replace(/^(?:—|--)[ \t]+/, '');
      if (role !== undefined) out.role = plain(role);
      const read = b.element(out, item.attrs, ['avatar']);
      const avatar = read.other.get('avatar');
      if (avatar && avatar.value !== true) out.avatar = avatar.value;
      b.record(['props', 'people', i], item.src);
      return out;
    });
  },
  'closing-cta'(b, pool, props, src) {
    heading(b, pool, props, 'title', 6);
    if (props.title === undefined) b.missing(src, 'a `# Title` heading', ['props', 'title']);
    const link = pool.take('paragraph', (p) =>
      /^\[((?:\\.|[^\]\\])+)\]\(([^\s()]+)\)$/.test(p.text.trim())
    );
    if (!link) b.missing(src, 'a `[Label](https://…)` link paragraph', ['props', 'cta']);
    else {
      const match = /^\[((?:\\.|[^\]\\])+)\]\(([^\s()]+)\)$/.exec(link.text.trim());
      const cta: Bag = { label: plain(match?.[1] ?? ''), href: match?.[2] ?? '' };
      b.element(cta, link.attrs);
      props.cta = cta;
      b.record(['props', 'cta'], link.src);
    }
    italic(b, pool, props, 'footnote', ['props']);
    body(b, pool, props, 'text', ['props']);
  },
  'video-centered'(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    videoProp(b, pool, props, src);
    italic(b, pool, props, 'caption', ['props']);
  },
  'video-left': videoSide,
  'video-right': videoSide,
  chart(b, pool, props, src) {
    heading(b, pool, props, 'title', 2);
    const node = pool.directive('chart');
    if (!node) {
      b.missing(src, 'a `::: chart` JSON fence', ['props', 'spec']);
      return;
    }
    const spec = b.jsonObject(node, ['props', 'spec'], 'The chart spec');
    if (spec !== undefined) props.spec = spec;
    const read = readElement(node.brace?.list ?? [], new Set(['height', 'table']), b.sink);
    const height = read.other.get('height');
    if (height && height.value !== true) props.height = height.value;
    const table = read.other.get('table');
    if (table) props.showTable = table.value === true || table.value === 'true';
    if (read.mark || read.id !== undefined) {
      b.sink.report(
        'md-fragment-not-steppable',
        'Put chart step fields inside the chart JSON.',
        node.src,
        [...b.base, 'props', 'spec']
      );
    }
  },
};

function imageSide(b: SlideBuilder, pool: Pool, props: Bag, src: Src): void {
  heading(b, pool, props, 'title', 2);
  imageProp(b, pool, props, src);
  subheading(b, pool, props, ['props']);
  body(b, pool, props, 'body', ['props']);
}

function videoSide(b: SlideBuilder, pool: Pool, props: Bag, src: Src): void {
  heading(b, pool, props, 'title', 2);
  videoProp(b, pool, props, src);
  subheading(b, pool, props, ['props']);
  body(b, pool, props, 'body', ['props']);
}

// ---------------------------------------------------------------------------

function isCatalogLayout(value: string): value is DeckCatalogLayoutId {
  return (DECK_CATALOG_LAYOUT_IDS as readonly string[]).includes(value);
}

/** Build one slide. `index` is its position in `slides`. */
export function buildSlide(
  source: SlideSource,
  index: number,
  src: Src,
  ctx: BuildContext
): BuiltSlide {
  const base: PathSegment[] = ['slides', index];
  const b = new SlideBuilder(ctx, base);
  const attrs = readSlideAttrs(source.slideAttrs, ctx.sink);
  const at = (name: string): Src => {
    const attr: Attr | undefined = attrs.at.get(name);
    return attr ? { line: attr.line, column: attr.column } : src;
  };
  ctx.map.set(toJsonPath(base), src);

  // `::: slide`: the whole slide as JSON.
  const whole = source.nodes.find((node) => node.kind === 'directive' && node.name === 'slide') as
    | DirectiveNode
    | undefined;
  if (whole) {
    for (const node of source.nodes)
      if (node !== whole) b.extra(node, 'Content next to `::: slide`');
    const slide = b.jsonObject(whole, [], 'A `::: slide` body') ?? {};
    if (source.notes && slide.notes === undefined) slide.notes = source.notes.text;
    return { slide, attrs, src };
  }

  const slide: Bag = {};
  const layout = attrs.layout ?? 'free';
  slide.layout = layout;
  ctx.map.set(toJsonPath([...base, 'layout']), at('layout'));

  if (layout === 'free') {
    if (attrs.master !== undefined) {
      if ((SLIDE_MASTERS as readonly string[]).includes(attrs.master)) slide.master = attrs.master;
      else {
        ctx.sink.report(
          'md-attr-value',
          `"master" is one of: ${SLIDE_MASTERS.join(', ')}.`,
          at('master'),
          base
        );
      }
    }
    slide.blocks = b.freeBlocks(source.nodes);
  } else {
    if (attrs.master !== undefined) {
      ctx.sink.report(
        'md-attr-conflict',
        '`master` applies to free slides only.',
        at('master'),
        base
      );
    }
    const pool = new Pool(source.nodes);
    if (layout === 'component') {
      const node = pool.directive('component');
      if (!node) b.missing(src, 'one `::: component <id>` fence', ['component']);
      else {
        const props =
          (node.body ?? '').trim() === ''
            ? {}
            : b.jsonObject(node, ['component', 'props'], 'Component props');
        slide.component = { component: node.arg ?? '', props: props ?? {} };
        ctx.map.set(toJsonPath([...base, 'component']), node.src);
        if ((node.brace?.list.length ?? 0) > 0 || node.attrs) {
          ctx.sink.report(
            'md-fragment-not-steppable',
            'A whole-slide component takes no attributes; use slide `steps`.',
            node.src,
            base
          );
        }
      }
    } else if (layout === 'custom') {
      const node = pool.directive('custom');
      if (!node) b.missing(src, 'one `::: custom <component>` fence', ['props']);
      else {
        const props: Bag = { component: node.arg ?? '' };
        if ((node.body ?? '').trim() !== '') {
          const data = b.jsonObject(node, ['props', 'data'], 'Custom slide data');
          if (data !== undefined) props.data = data;
        }
        slide.props = props;
        ctx.map.set(toJsonPath([...base, 'props']), node.src);
      }
    } else if (isCatalogLayout(layout)) {
      const json = pool.directive('props');
      if (json) {
        slide.props = b.jsonObject(json, ['props'], 'Layout props') ?? {};
        ctx.map.set(toJsonPath([...base, 'props']), json.src);
      } else {
        const props: Bag = {};
        (LAYOUTS[layout] as LayoutBuild)(b, pool, props, src);
        slide.props = props;
      }
    } else {
      ctx.sink.report(
        'md-layout-unknown',
        `Unknown layout "${layout.slice(0, 64)}".`,
        at('layout'),
        [...base, 'layout'],
        `Use one of: ${DECK_CATALOG_LAYOUT_IDS.join(', ')}, free, component, custom.`
      );
      slide.props = {};
    }
    leftovers(b, pool);
  }
  b.numberMarks();

  if (attrs.title !== undefined) slide.title = attrs.title;
  if (attrs.theme !== undefined) slide.theme = attrs.theme;
  if (attrs.transition !== undefined) slide.transition = attrs.transition;
  if (attrs.hidden !== undefined) slide.hidden = attrs.hidden;
  if (attrs.steps !== undefined) slide.steps = attrs.steps;
  if (attrs.background !== undefined) slide.background = attrs.background;
  for (const [field, attr] of [
    ['title', 'title'],
    ['theme', 'theme'],
    ['transition', 'transition'],
    ['hidden', 'hidden'],
    ['steps', 'steps'],
    ['background', 'background'],
  ] as const) {
    if (attrs.at.has(attr)) ctx.map.set(toJsonPath([...base, field]), at(attr));
  }
  if (source.notes) {
    slide.notes = source.notes.text;
    ctx.map.set(toJsonPath([...base, 'notes']), source.notes.src);
  }
  if (DECK_MARKDOWN_LIMITS.slides < index + 1) {
    ctx.sink.report('md-too-many-slides', 'Too many slides.', src, base);
  }
  return { slide, attrs, src };
}

/** The text an id is derived from: the slide title, the props title, or a free slide's first heading. */
export function idCandidate(slide: Bag): string {
  if (typeof slide.title === 'string' && slide.title.trim()) return slide.title;
  const props = slide.props as Bag | undefined;
  if (props && typeof props.title === 'string' && slide.layout !== 'custom') return props.title;
  if (Array.isArray(slide.blocks)) {
    const first = slide.blocks.find((block) => (block as Bag)?.type === 'heading') as
      | Bag
      | undefined;
    if (first && typeof first.text === 'string') return first.text;
  }
  return '';
}
