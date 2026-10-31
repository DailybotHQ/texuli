/**
 * `deckToMarkdown`: a validated v2 deck → canonical deck Markdown, so
 * JSON → Markdown → JSON gives the same deck. The writer prefers readable
 * Markdown and proves it: every free block and every slide is read back
 * and compared, and whatever does not survive falls back to an exact JSON
 * fence (`::: block`, `::: props`, `::: slide`). Deck-level fields the
 * dialect cannot express are reported, never silently dropped.
 */
import { DECK_SOLID_TOKENS, isDeckBackgroundPreset } from '../model/backgrounds/schema.ts';
import type { Deck, DeckSlide } from '../model/deck.ts';
import { createDiagnostic, type DeckDiagnostic } from '../schema/index.ts';
import { attributeWritable, writeAttribute } from './attributes.ts';
import { FRONTMATTER_KEYS, writeScalar } from './frontmatter.ts';
import { deriveSlideId, readDeckDraft, stackSectionId } from './parse.ts';
import { escapeInline, fenceFor, hasUnsafeLink, inertJson, jsonEqual } from './text.ts';

type Bag = Record<string, unknown>;
type AttrList = [string, string | number | true][];

export interface DeckMarkdownWriteResult {
  markdown: string;
  /** `md-unrepresentable` warnings: deck fields the Markdown could not carry. */
  issues: DeckDiagnostic[];
}

const e = escapeInline;

function isBag(value: unknown): value is Bag {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function attrText(list: AttrList): string {
  return list.map(([name, value]) => writeAttribute(name, value)).join(' ');
}

function comment(kind: 'slide' | 'element', list: AttrList): string {
  return `<!-- .${kind}: ${attrText(list)} -->`;
}

function brace(list: AttrList): string {
  if (list.length === 0) return '';
  const parts = list.map(([name, value]) =>
    name === 'id' && typeof value === 'string' ? `#${value}` : writeAttribute(name, value)
  );
  return ` {${parts.join(' ')}}`;
}

/** Fragment attributes, auto-numbered (free slides) or explicit (layouts). */
class Steps {
  counter = 0;
  readonly explicit: boolean;
  constructor(explicit: boolean) {
    this.explicit = explicit;
  }
  attrs(target: Bag, span = 1): AttrList {
    const out: AttrList = [];
    if (typeof target.id === 'string') out.push(['id', target.id]);
    if (typeof target.step === 'number') {
      if (typeof target.fragment === 'string') out.push(['fragment', target.fragment]);
      else if (typeof target.reveal === 'string') out.push(['reveal', target.reveal]);
      else out.push(['fragment', true]);
      if (this.explicit || target.step !== this.counter + 1) out.push(['step', target.step]);
      this.counter = Math.max(this.counter, target.step + span - 1);
    }
    if (typeof target.tone === 'string') out.push(['tone', target.tone]);
    return out;
  }
}

function withoutSteps(block: Bag): Bag {
  const out: Bag = { ...block };
  delete out.step;
  delete out.fragment;
  delete out.reveal;
  return out;
}

function json(name: string, value: unknown, head = ''): string {
  return `::: ${name}${head}\n${inertJson(value)}\n:::`;
}

// ---------------------------------------------------------------------------
// Free blocks

function blockMarkdown(block: Bag, steps: Steps): string {
  const own = (list: AttrList, text: string) =>
    list.length > 0 ? `${text}\n${comment('element', list)}` : text;
  switch (block.type) {
    case 'heading':
      return own(steps.attrs(block), `${'#'.repeat(Number(block.level))} ${e(String(block.text))}`);
    case 'text':
      return own(steps.attrs(block), String(block.markdown));
    case 'list': {
      const items = (block.items as Bag[]).map((item, i) => {
        const marker = block.ordered === true ? `${i + 1}. ` : '- ';
        const lines = String(item.text).split('\n');
        const body = [
          lines[0] ?? '',
          ...lines
            .slice(1)
            .map((line) => (line === '' ? '' : `${' '.repeat(marker.length)}${line}`)),
        ].join('\n');
        return `${marker}${body}`;
      });
      const head: AttrList = [];
      if (typeof block.id === 'string') head.push(['id', block.id]);
      if (typeof block.tone === 'string' && typeof block.step !== 'number')
        head.push(['tone', block.tone]);
      if (typeof block.step === 'number') {
        const n = items.length;
        const first = {
          step: block.step,
          fragment: block.fragment,
          reveal: block.reveal,
          tone: block.tone,
        } as Bag;
        const firstAttrs = steps.attrs(first, n).filter(([name]) => name !== 'id');
        const rest = firstAttrs.filter(([name]) => name !== 'step');
        items.forEach((item, i) => {
          const list = i === 0 ? firstAttrs : rest;
          items[i] = appendTrailing(item, list);
        });
      }
      return own(head, items.join('\n'));
    }
    case 'quote': {
      const lines = String(block.quote)
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'));
      if (typeof block.cite === 'string') lines.push('>', `> — ${e(block.cite)}`);
      return own(steps.attrs(block), lines.join('\n'));
    }
    case 'table': {
      const columns = block.columns as Bag[];
      const header = `| ${columns.map((column) => e(String(column.label))).join(' | ')} |`;
      const align = `| ${columns.map(() => '---').join(' | ')} |`;
      const rows = (block.rows as Bag[]).map(
        (row) =>
          `| ${columns.map((column) => (row[String(column.id)] === null ? '' : e(String(row[String(column.id)])))).join(' | ')} |`
      );
      return own(steps.attrs(block), [header, align, ...rows].join('\n'));
    }
    case 'image': {
      const title = typeof block.caption === 'string' ? ` "${block.caption}"` : '';
      const alt = typeof block.alt === 'string' ? e(block.alt) : '';
      const list = steps.attrs(block);
      if (typeof block.width === 'number') list.push(['width', block.width]);
      if (typeof block.height === 'number') list.push(['height', block.height]);
      if (block.decorative === true) list.push(['decorative', true]);
      return own(list, `![${alt}](${String(block.src)}${title})`);
    }
    case 'divider':
      return own(steps.attrs(block), '***');
    case 'code': {
      const code = String(block.code);
      const fence = fenceFor(code);
      const info: string[] = [];
      if (typeof block.lang === 'string') info.push(block.lang);
      if (Array.isArray(block.highlights)) info.push(`[${block.highlights.join('|')}]`);
      const list = steps.attrs(block);
      if (typeof block.filename === 'string') list.push(['filename', block.filename]);
      if (typeof block.caption === 'string') list.push(['caption', block.caption]);
      if (block.lineNumbers === true) list.push(['numbers', true]);
      return `${fence}${info.join(' ')}${brace(list)}\n${code}\n${fence}`;
    }
    case 'math':
      return own(steps.attrs(block), `$$\n${String(block.tex)}\n$$`);
    case 'component': {
      const list = steps.attrs(block);
      if (typeof block.height === 'string') list.push(['height', block.height]);
      return json(`component ${String(block.component)}`, block.props ?? {}, brace(list));
    }
    default:
      return json('block', block);
  }
}

function appendTrailing(line: string, list: AttrList): string {
  if (list.length === 0) return line;
  const lines = line.split('\n');
  lines[0] = `${lines[0]} ${comment('element', list)}`;
  return lines.join('\n');
}

/** A block that reads back unchanged on its own (fragment fields aside). */
function blockSurvives(block: Bag): boolean {
  if (
    block.type === 'component' ||
    !['heading', 'text', 'list', 'quote', 'table', 'image', 'divider', 'code', 'math'].includes(
      String(block.type)
    )
  ) {
    return true;
  }
  const bare = withoutSteps(block);
  const text = blockMarkdown(bare, new Steps(false));
  const read = readDeckDraft(`${text}\n`);
  if (read.sink.errors > 0) return false;
  const slide = (read.draft?.slides as Bag[] | undefined)?.[0];
  const blocks = slide?.blocks as Bag[] | undefined;
  return blocks?.length === 1 && jsonEqual(blocks[0], bare);
}

// ---------------------------------------------------------------------------
// Layouts

type LayoutWriter = (props: Bag, steps: Steps) => string[];

const italic = (text: unknown, prefix = '') => `*${prefix}${e(String(text))}*`;
const opt = (value: unknown, write: (value: unknown) => string): string[] =>
  value === undefined ? [] : [write(value)];

function region(
  name: string,
  target: Bag,
  steps: Steps,
  extra: AttrList,
  body: string[]
): string[] {
  return [`::: ${name}${brace([...steps.attrs(target), ...extra])}`, ...body, ':::'];
}

function imageLines(image: Bag, steps: Steps, extra: AttrList = []): string[] {
  const list = steps.attrs(image);
  if (typeof image.width === 'number') list.push(['width', image.width]);
  if (typeof image.height === 'number') list.push(['height', image.height]);
  list.push(...extra);
  const line = `![${e(String(image.alt))}](${String(image.src)})`;
  return list.length > 0 ? [`${line}\n${comment('element', list)}`] : [line];
}

function videoLines(video: Bag, steps: Steps): string[] {
  const list: AttrList = [['src', String(video.src)]];
  if (typeof video.label === 'string') list.push(['label', video.label]);
  if (typeof video.width === 'number') list.push(['width', video.width]);
  if (typeof video.height === 'number') list.push(['height', video.height]);
  for (const flag of ['autoplay', 'loop', 'muted']) {
    if (video[flag] === true) list.push([flag, true]);
    else if (video[flag] === false) list.push([flag, 'false']);
  }
  return region('video', video, steps, list, []);
}

const title2 = (props: Bag) => opt(props.title, (v) => `## ${e(String(v))}`);
const sub = (target: Bag) => opt(target.heading, (v) => `### ${e(String(v))}`);

const LAYOUT_WRITERS: Readonly<Record<string, LayoutWriter>> = {
  'title-hero': (p) => [
    `# ${e(String(p.title))}`,
    ...opt(p.subtitle, (v) => e(String(v))),
    ...opt(p.meta, (v) => italic(v)),
  ],
  'section-divider': (p) => [...opt(p.eyebrow, (v) => italic(v)), `# ${e(String(p.title))}`],
  'two-column-split': (p, s) => [
    ...title2(p),
    ...(['left', 'right'] as const).flatMap((side) => {
      const column = p[side] as Bag;
      return region(side, column, s, [], [...sub(column), e(String(column.body))]);
    }),
  ],
  'three-column-cards': (p, s) => [
    ...title2(p),
    ...(p.cards as Bag[]).flatMap((card) =>
      region('card', card, s, typeof card.icon === 'string' ? [['icon', card.icon]] : [], [
        ...sub(card),
        e(String(card.body)),
      ])
    ),
  ],
  'image-left': imageSide,
  'image-right': imageSide,
  'image-centered': (p, s) => [
    ...title2(p),
    ...imageLines(p.image as Bag, s),
    ...opt(p.caption, (v) => italic(v)),
  ],
  'image-full-bleed': (p, s) => [
    ...imageLines(p.image as Bag, s, typeof p.overlay === 'string' ? [['overlay', p.overlay]] : []),
    ...opt(p.caption, (v) => italic(v)),
    ...opt(p.credit, (v) => italic(v, 'Credit: ')),
  ],
  quote: (p) => [
    [
      `> ${e(String(p.quote))}`,
      ...(p.cite === undefined ? [] : ['>', `> — ${e(String(p.cite))}`]),
    ].join('\n'),
  ],
  'code-with-callout': (p, s) => {
    const code = p.code as Bag;
    const source = String(code.source);
    const fence = fenceFor(source);
    const steps = Array.isArray(code.highlights) ? ` [${code.highlights.join('|')}]` : '';
    return [
      ...title2(p),
      `${fence}${String(code.lang)}${steps}${brace(s.attrs(code))}\n${source}\n${fence}`,
      ...sub(p),
      (p.bullets as unknown[]).map((bullet) => `- ${e(String(bullet))}`).join('\n'),
    ];
  },
  'big-stat': (p) => [
    `**${e(String(p.number))}** ${e(String(p.label))}`,
    ...opt(p.context, (v) => e(String(v))),
    ...opt(p.source, (v) => italic(v, 'Source: ')),
  ],
  'comparison-table': (p, s) => {
    const cell = (value: unknown) =>
      value === true ? 'Yes' : value === false ? 'No' : value === null ? '' : e(String(value));
    const columns = p.columns as unknown[];
    const rows = (p.rows as Bag[]).map((row) =>
      appendTrailing(
        `| ${[e(String(row.label)), ...(row.values as unknown[]).map(cell)].join(' | ')} |`,
        s.attrs(row)
      )
    );
    return [
      ...title2(p),
      [
        `|  | ${columns.map((c) => e(String(c))).join(' | ')} |`,
        `| ${['', ...columns].map(() => '---').join(' | ')} |`,
        ...rows,
      ].join('\n'),
    ];
  },
  'process-steps': (p, s) => [
    ...title2(p),
    (p.steps as Bag[])
      .map((step, i) =>
        appendTrailing(
          `${i + 1}. **${e(String(step.title))}**${step.body === undefined ? '' : ` ${e(String(step.body))}`}`,
          s.attrs(step)
        )
      )
      .join('\n'),
  ],
  timeline: (p, s) => [
    ...title2(p),
    (p.events as Bag[])
      .map((event) =>
        appendTrailing(`- **${e(String(event.time))}** ${e(String(event.text))}`, s.attrs(event))
      )
      .join('\n'),
  ],
  'team-avatars': (p, s) => [
    ...title2(p),
    (p.people as Bag[])
      .map((person) => {
        const list = s.attrs(person);
        if (typeof person.avatar === 'string') list.push(['avatar', person.avatar]);
        return appendTrailing(
          `- **${e(String(person.name))}**${person.role === undefined ? '' : ` — ${e(String(person.role))}`}`,
          list
        );
      })
      .join('\n'),
  ],
  'closing-cta': (p, s) => {
    const cta = p.cta as Bag;
    const list = s.attrs(cta);
    const link = `[${e(String(cta.label))}](${String(cta.href)})`;
    return [
      `# ${e(String(p.title))}`,
      ...opt(p.text, (v) => e(String(v))),
      list.length > 0 ? `${link}\n${comment('element', list)}` : link,
      ...opt(p.footnote, (v) => italic(v)),
    ];
  },
  'video-centered': (p, s) => [
    ...title2(p),
    ...videoLines(p.video as Bag, s),
    ...opt(p.caption, (v) => italic(v)),
  ],
  'video-left': videoSide,
  'video-right': videoSide,
  chart: (p) => {
    const list: AttrList = [];
    if (typeof p.height === 'string') list.push(['height', p.height]);
    if (p.showTable === true) list.push(['table', true]);
    else if (p.showTable === false) list.push(['table', 'false']);
    return [...title2(p), json('chart', p.spec, brace(list))];
  },
};

function imageSide(p: Bag, s: Steps): string[] {
  return [...title2(p), ...imageLines(p.image as Bag, s), ...sub(p), e(String(p.body))];
}

function videoSide(p: Bag, s: Steps): string[] {
  return [...title2(p), ...videoLines(p.video as Bag, s), ...sub(p), e(String(p.body))];
}

// ---------------------------------------------------------------------------
// Slides

interface SlidePlan {
  idAttr: boolean;
  section: AttrList;
}

function backgroundAttrs(background: unknown): AttrList | null {
  if (background === undefined) return [];
  if (typeof background === 'string') return [['background', background]];
  if (!isBag(background)) return null;
  switch (background.kind) {
    case 'solid':
      if (typeof background.color === 'string') return [['background-color', background.color]];
      return [
        [
          'background-color',
          typeof background.token === 'string' ? background.token : 'background',
        ],
      ];
    case 'gradient':
      return [
        [
          'background-gradient',
          background.angle === undefined
            ? String(background.gradient)
            : `${String(background.gradient)}, ${String(background.angle)}deg`,
        ],
      ];
    case 'pattern':
      return [['background-pattern', String(background.pattern)]];
    case 'image':
    case 'image-full':
    case 'video':
    case 'video-full': {
      const image = String(background.kind).startsWith('image');
      const out: AttrList = [
        [image ? 'background-image' : 'background-video', String(background.src)],
      ];
      if (String(background.kind).endsWith('-full')) out.push(['background-full', true]);
      if (typeof background.alt === 'string') out.push(['background-alt', background.alt]);
      if (typeof background.poster === 'string') out.push(['background-poster', background.poster]);
      if (typeof background.fit === 'string') out.push(['background-fit', background.fit]);
      if (typeof background.position === 'string')
        out.push(['background-position', background.position]);
      if (typeof background.tone === 'string') out.push(['tone', background.tone]);
      if (typeof background.overlay === 'number')
        out.push(['background-overlay', background.overlay]);
      return out;
    }
    default:
      return null;
  }
}

/** The `.slide` attributes of a slide, or null when one cannot be written. */
function slideAttrs(slide: Bag, plan: SlidePlan): AttrList | null {
  const out: AttrList = [];
  if (plan.idAttr) out.push(['id', String(slide.id)]);
  if (slide.layout !== 'free') out.push(['layout', String(slide.layout)]);
  if (typeof slide.master === 'string') out.push(['master', slide.master]);
  if (typeof slide.title === 'string') out.push(['title', slide.title]);
  if (slide.theme !== undefined) {
    if (typeof slide.theme !== 'string') return null;
    out.push(['theme', slide.theme]);
  }
  if (typeof slide.transition === 'string') out.push(['transition', slide.transition]);
  if (slide.hidden === true) out.push(['hidden', true]);
  else if (slide.hidden === false) out.push(['hidden', 'false']);
  if (Array.isArray(slide.steps)) {
    if (
      slide.steps.some(
        (label) => String(label).includes('|') || String(label) !== String(label).trim()
      )
    )
      return null;
    out.push(['steps', slide.steps.join('|')]);
  }
  const background = backgroundAttrs(slide.background);
  if (background === null) return null;
  out.push(...background, ...plan.section);
  for (const [, value] of out)
    if (typeof value === 'string' && !attributeWritable(value)) return null;
  return out;
}

function notesText(notes: unknown): string[] {
  if (typeof notes !== 'string' || notes === '') return [];
  const lines = notes
    .split('\n')
    .map((line) =>
      /^(?:-{2,}[ \t]*$| {0,3}(?::::|`{3}|~{3}|\$\$))/.test(line) ? `\\${line}` : line
    );
  return [`Note: ${lines.join('\n')}`];
}

/** Slide content in Markdown; `jsonBlocks` names free blocks written as JSON fences. */
function slideBody(
  slide: Bag,
  jsonBlocks: ReadonlySet<number>,
  propsJson: boolean
): string[] | null {
  if (slide.layout === 'free') {
    const steps = new Steps(false);
    return (slide.blocks as Bag[]).map((block, i) =>
      jsonBlocks.has(i) ? json('block', block) : blockMarkdown(block, steps)
    );
  }
  if (slide.layout === 'component') {
    const component = slide.component as Bag;
    return [json(`component ${String(component.component)}`, component.props ?? {})];
  }
  if (slide.layout === 'custom') {
    const props = slide.props as Bag;
    return [
      props.data === undefined
        ? `::: custom ${String(props.component)}\n:::`
        : json(`custom ${String(props.component)}`, props.data),
    ];
  }
  if (propsJson) return [json('props', slide.props)];
  const writer = LAYOUT_WRITERS[String(slide.layout)];
  if (!writer) return null;
  return writer(slide.props as Bag, new Steps(true));
}

function slideMarkdown(
  slide: Bag,
  plan: SlidePlan,
  jsonBlocks: ReadonlySet<number>,
  propsJson: boolean
): string | null {
  const attrs = slideAttrs(slide, plan);
  const body = slideBody(slide, jsonBlocks, propsJson);
  if (attrs === null || body === null) return null;
  const parts = [
    ...(attrs.length > 0 ? [comment('slide', attrs)] : []),
    ...body,
    ...notesText(slide.notes),
  ];
  return parts.join('\n\n');
}

function withoutId(slide: Bag | undefined): Bag | undefined {
  if (!slide) return undefined;
  const out = { ...slide };
  delete out.id;
  return out;
}

/** True when `text` reads back as `slide` (ids aside). */
function slideSurvives(text: string, slide: Bag): boolean {
  const read = readDeckDraft(`${text}\n`);
  if (read.sink.errors > 0) return false;
  const slides = read.draft?.slides as Bag[] | undefined;
  return slides?.length === 1 && jsonEqual(withoutId(slides[0]), withoutId(slide));
}

function writeSlide(slide: Bag, plan: SlidePlan): string {
  const head = plan.section.length > 0 ? `${comment('slide', plan.section)}\n\n` : '';
  // Notes are written verbatim after `Note:`: a link whose target the text
  // twins would drop (`[x](javascript:…)`) keeps the slide in an exact,
  // inert JSON fence instead of becoming live Markdown.
  if (typeof slide.notes === 'string' && hasUnsafeLink(slide.notes)) {
    return `${head}${json('slide', slide)}`;
  }
  const jsonBlocks = new Set<number>();
  if (slide.layout === 'free') {
    (slide.blocks as Bag[]).forEach((block, i) => {
      if (!blockSurvives(block)) jsonBlocks.add(i);
    });
  }
  const first = slideMarkdown(slide, plan, jsonBlocks, false);
  if (first !== null && slideSurvives(first, slide)) return first;
  if (slide.layout !== 'free' && slide.layout !== 'component' && slide.layout !== 'custom') {
    const props = slideMarkdown(slide, plan, jsonBlocks, true);
    if (props !== null && slideSurvives(props, slide)) return props;
  }
  if (slide.layout === 'free') {
    const all = new Set((slide.blocks as Bag[]).map((_, i) => i));
    const blocks = slideMarkdown(slide, plan, all, false);
    if (blocks !== null && slideSurvives(blocks, slide)) return blocks;
  }
  return `${head}${json('slide', slide)}`;
}

// ---------------------------------------------------------------------------
// The deck

function frontmatter(deck: Deck, issues: DeckDiagnostic[]): string[] {
  const values = new Map<string, unknown>();
  const meta = deck.meta as Bag;
  for (const key of ['title', 'description', 'author', 'date', 'locale', 'dir'])
    values.set(key, meta[key]);
  const style = (deck.style ?? {}) as Bag;
  const theme = style.theme;
  if (typeof theme === 'string') values.set('theme', theme);
  else if (isBag(theme)) {
    if (theme.kind === 'catalog') values.set('theme', theme.id);
    else if (theme.kind === 'seed') values.set('themeSeed', theme.seed);
    else
      unrepresentable(
        issues,
        ['style', 'theme'],
        'An embedded theme object cannot be written as frontmatter.'
      );
    if (theme.kind !== 'embedded' && theme.mode !== undefined) values.set('themeMode', theme.mode);
  }
  for (const key of [
    'fontPair',
    'aspect',
    'density',
    'radius',
    'motion',
    'transition',
    'logo',
    'footer',
    'slideNumbers',
    'progress',
    'codeTheme',
    'math',
  ]) {
    values.set(key, style[key]);
  }
  const background = style.background;
  if (typeof background === 'string' && isDeckBackgroundPreset(background))
    values.set('background', background);
  else if (
    isBag(background) &&
    background.kind === 'solid' &&
    typeof background.color === 'string'
  ) {
    values.set('background', background.color);
  } else if (
    isBag(background) &&
    background.kind === 'solid' &&
    (background.token === undefined ||
      (DECK_SOLID_TOKENS as readonly string[]).includes(String(background.token)))
  ) {
    values.set('background', background.token ?? 'background');
  } else if (background !== undefined) {
    unrepresentable(
      issues,
      ['style', 'background'],
      'Deck-wide gradient, pattern and media backgrounds cannot be written as frontmatter; set them per slide or use a preset.'
    );
  }
  const navigation = (deck.navigation ?? {}) as Bag;
  values.set('start', navigation.start);
  values.set('loop', navigation.loop);
  values.set('autoSlide', navigation.autoSlideMs);
  values.set('outlineTitle', deck.outline?.title);
  const designSystem = deck.designSystem;
  if (designSystem?.ref !== undefined) values.set('designSystem', designSystem.ref);
  else if (designSystem !== undefined)
    unrepresentable(
      issues,
      ['designSystem', 'inline'],
      'An inline design system cannot be written as frontmatter; use a ref (`designSystem: id@x.y.z`).'
    );

  const lines = ['---'];
  for (const key of Object.keys(FRONTMATTER_KEYS)) {
    const value = values.get(key);
    if (value === undefined) continue;
    if (typeof value === 'string' && value.includes('\n')) {
      unrepresentable(issues, FRONTMATTER_KEYS[key]?.path ?? [], `"${key}" holds a line break.`);
      continue;
    }
    lines.push(`${key}: ${writeScalar(value as string | number | boolean)}`);
  }
  lines.push('---');
  return lines;
}

function unrepresentable(
  issues: DeckDiagnostic[],
  path: readonly (string | number)[],
  message: string
): void {
  issues.push(
    createDiagnostic('md-unrepresentable', message, path, {
      severity: 'warning',
      fix: 'Keep the JSON deck as the source of truth for this field.',
    })
  );
}

/**
 * Write a validated deck as canonical deck Markdown, with `md-unrepresentable`
 * warnings for deck-level fields the dialect cannot hold. Slides and blocks
 * always round-trip (as Markdown when it reads back exactly, otherwise as JSON
 * fences).
 */
export function writeDeckMarkdown(deck: Deck): DeckMarkdownWriteResult {
  const issues: DeckDiagnostic[] = [];
  const slides = deck.slides as unknown as Bag[];
  const lines = frontmatter(deck, issues);

  // Sections: which slide opens one, which are stacked, where a named one ends.
  const sectionAttrs = new Map<number, AttrList>();
  const vertical = new Set<number>();
  const index = new Map<string, number>();
  slides.forEach((slide, i) => {
    index.set(String(slide.id), i);
  });
  const inNamed = new Set<number>();
  for (const section of deck.outline?.sections ?? []) {
    const positions = section.slideIds.map((id) => index.get(id) ?? -1);
    const first = positions[0] ?? -1;
    if (first < 0) continue;
    const list: AttrList = [];
    if (section.stack === true) {
      if (section.id !== stackSectionId(section.slideIds[0] ?? ''))
        list.push(['section', section.id]);
      for (const position of positions.slice(1)) vertical.add(position);
    } else {
      list.push(['section', section.id]);
      for (const position of positions) inNamed.add(position);
    }
    if (section.title !== undefined) list.push(['section-title', section.title]);
    sectionAttrs.set(first, list);
  }
  const ends = new Set<number>();
  slides.forEach((_, i) => {
    if (
      i > 0 &&
      inNamed.has(i - 1) &&
      !inNamed.has(i) &&
      !vertical.has(i) &&
      !sectionAttrs.has(i)
    ) {
      ends.add(i);
    }
  });

  const used = new Set<string>();
  const parts: string[] = [];
  slides.forEach((slide, i) => {
    const derived = deriveSlideId(slide, i, used);
    const id = String(slide.id);
    used.add(id);
    const section: AttrList = [...(sectionAttrs.get(i) ?? [])];
    if (ends.has(i)) section.push(['section-end', true]);
    const text = writeSlide(slide, { idAttr: derived !== id, section });
    parts.push(i === 0 ? text : `${vertical.has(i) ? '--' : '---'}\n\n${text}`);
  });
  const markdown = `${lines.join('\n')}\n\n${parts.join('\n\n')}\n`;

  // Prove the deck-level fields; report what did not survive.
  const read = readDeckDraft(markdown).draft ?? {};
  for (const key of ['meta', 'style', 'navigation', 'outline'] as const) {
    const before = (deck as unknown as Bag)[key];
    if (!jsonEqual(before, read[key]) && !issues.some((issue) => issue.path[0] === key)) {
      unrepresentable(issues, [key], `Part of \`${key}\` does not survive the Markdown form.`);
    }
  }
  return { markdown, issues };
}

/** A validated deck as canonical deck Markdown (see `writeDeckMarkdown` for the warnings). */
export function deckToMarkdown(deck: Deck): string {
  return writeDeckMarkdown(deck).markdown;
}

export type { DeckSlide };
