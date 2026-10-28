/**
 * Text twins of a deck, ported from Protoyard's `text/deck.ts` onto model
 * v2: `deckToText` (a readable Markdown document for accessibility, artifact
 * descriptions and LLM context; one-way, unlike `deckToMarkdown`) and
 * `deckOutline` (one compact row per slide). Both are pure and
 * deterministic, and nothing an author typed can become HTML or a link
 * target in them: plain fields are escaped and Markdown fields made inert.
 */

import { mathText, texToMath } from '../math/index.ts';
import type { Deck, DeckSlide } from '../model/deck.ts';
import {
  escapeInline,
  escapeText,
  fenceFor,
  inertMarkdown,
  inlineCode,
  linkTarget,
  stripHidden,
  trimCharEnd,
} from './text.ts';

type Bag = Record<string, unknown>;

export interface DeckTextOptions {
  /** Document title when the deck has none. Default: `meta.title`. */
  title?: string;
  /** Include hidden slides. Default false. */
  includeHidden?: boolean;
  /** Include speaker notes under a "Notes" heading. Default true. */
  notes?: boolean;
}

const join = (parts: readonly (string | false | undefined)[]) =>
  parts
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join('\n\n');

const h = (level: number, text: string) =>
  `${'#'.repeat(Math.min(6, Math.max(1, level)))} ${escapeInline(text)}`;
const str = (value: unknown) =>
  typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
const italic = (text: string) => (text.trim() ? `*${escapeInline(text)}*` : '');

function image(alt: unknown, src: unknown): string {
  const source = str(src);
  return source && !source.startsWith('data:') && !source.startsWith('avatar:')
    ? `![${escapeInline(str(alt))}](${linkTarget(source)})`
    : `*\\[Image: ${escapeInline(str(alt))}\\]*`;
}

const video = (label: unknown) =>
  `*\\[Video${str(label) ? `: ${escapeInline(str(label))}` : ''}\\]*`;

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  if (header.length === 0) return '';
  const cell = (value: string | undefined) => escapeInline(value ?? '') || ' ';
  const line = (cells: readonly string[]) =>
    `| ${header.map((_, i) => cell(cells[i])).join(' | ')} |`;
  return [line(header), `| ${header.map(() => '---').join(' | ')} |`, ...rows.map(line)].join('\n');
}

function codeFence(code: string, lang: string): string {
  const body = trimCharEnd(stripHidden(code), '\n');
  const fence = fenceFor(body);
  return `${fence}${lang.replace(/[^\w+-]/g, '').slice(0, 24)}\n${body}\n${fence}`;
}

const markdown = (value: unknown) => inertMarkdown(str(value)).trim();

/** Every string of a value, labelled by key path (unknown shapes, component props). */
function strings(value: unknown, path: string[] = [], out: string[] = [], depth = 0): string[] {
  if (depth > 6 || out.length >= 100) return out;
  if (typeof value === 'string') {
    out.push(`- ${path.length ? `${escapeInline(path.join('.'))}: ` : ''}${escapeInline(value)}`);
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    out.push(`- ${escapeInline(path.join('.'))}: ${String(value)}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      strings(item, [...path, String(i + 1)], out, depth + 1);
    });
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) strings(item, [...path, key], out, depth + 1);
  }
  return out;
}

function chartText(spec: Bag): string {
  const series = Array.isArray(spec.series) ? (spec.series as Bag[]) : [];
  const labels = Array.isArray(spec.labels) ? (spec.labels as unknown[]).map(str) : [];
  const head = `*Chart (${escapeInline(str(spec.kind))}): ${escapeInline(str(spec.title))}*`;
  if (series.length === 0 || labels.length === 0)
    return join([head, spec.description ? escapeInline(str(spec.description)) : '']);
  const rows = labels.map((label, i) => [
    label,
    ...series.map((s) => {
      const values = Array.isArray(s.values) ? (s.values as unknown[]) : [];
      const v = values[i];
      return typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : '';
    }),
  ]);
  return join([
    head,
    spec.description ? escapeInline(str(spec.description)) : '',
    table(['', ...series.map((s) => str(s.label))], rows),
  ]);
}

function blockText(block: Bag, level: number): string {
  switch (block.type) {
    case 'heading':
      return join([
        block.eyebrow ? italic(str(block.eyebrow)) : '',
        h(level + Math.max(0, Number(block.level ?? 2) - 1), str(block.text)),
        block.subtitle ? escapeText(str(block.subtitle)) : '',
      ]);
    case 'text':
      return markdown(block.markdown);
    case 'list':
      return (Array.isArray(block.items) ? (block.items as Bag[]) : [])
        .map(
          (item, i) =>
            `${block.ordered === true ? `${i + 1}.` : '-'} ${markdown(item.text).split('\n').join('\n   ')}`
        )
        .join('\n');
    case 'quote':
      return [
        ...markdown(block.quote).split('\n'),
        ...(block.cite ? ['', `— ${escapeInline(str(block.cite))}`] : []),
      ]
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'callout':
      return join([
        block.title ? `**${escapeInline(str(block.title))}**` : '',
        markdown(block.body),
      ])
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'divider':
      return '***';
    case 'image':
      return join([image(block.alt, block.src), block.caption ? italic(str(block.caption)) : '']);
    case 'video':
      return video(block.label);
    case 'table': {
      const columns = Array.isArray(block.columns) ? (block.columns as Bag[]) : [];
      const rows = Array.isArray(block.rows) ? (block.rows as Bag[]) : [];
      return join([
        block.caption ? italic(str(block.caption)) : '',
        table(
          columns.map((c) => str(c.label)),
          rows.map((row) => columns.map((c) => str(row[str(c.id)])))
        ),
      ]);
    }
    case 'code':
      return join([
        block.filename ? italic(str(block.filename)) : '',
        codeFence(str(block.code), str(block.lang)),
        block.caption ? italic(str(block.caption)) : '',
      ]);
    case 'math': {
      const result = texToMath(str(block.tex), { display: true });
      return `*Formula: ${escapeInline(result.ok ? mathText(result.node) : str(block.tex))}* ${inlineCode(str(block.tex))}`;
    }
    case 'chart':
      return chartText(block);
    case 'component': {
      const lines = strings(block.props);
      return join([`*Component ${inlineCode(str(block.component))}*`, lines.join('\n')]);
    }
    default: {
      const nested: string[] = [];
      for (const key of ['blocks', 'children'] as const) {
        if (Array.isArray(block[key])) nested.push(blocksText(block[key] as Bag[], level));
      }
      if (Array.isArray(block.columns) && block.type === 'columns') {
        for (const column of block.columns as unknown[])
          if (Array.isArray(column)) nested.push(blocksText(column as Bag[], level));
      }
      if (Array.isArray(block.panels)) {
        for (const panel of block.panels as Bag[]) {
          nested.push(
            join([
              h(level, str(panel.label)),
              Array.isArray(panel.blocks) ? blocksText(panel.blocks as Bag[], level + 1) : '',
            ])
          );
        }
      }
      if (nested.length > 0) return join(nested);
      const copy: Bag = { ...block };
      delete copy.type;
      delete copy.id;
      const lines = strings(copy);
      return join([`*\\[${escapeInline(str(block.type))}\\]*`, lines.join('\n')]);
    }
  }
}

function blocksText(blocks: readonly Bag[], level: number): string {
  return join(blocks.map((block) => blockText(block, level)));
}

/** Body Markdown per catalog layout, from its validated props. */
const LAYOUT_TEXT: Readonly<Record<string, (p: Bag, level: number) => string>> = {
  'title-hero': (p) =>
    join([p.subtitle ? escapeText(str(p.subtitle)) : '', p.meta ? italic(str(p.meta)) : '']),
  'section-divider': (p) => (p.eyebrow ? italic(str(p.eyebrow)) : ''),
  'two-column-split': (p, level) =>
    join(
      [p.left as Bag, p.right as Bag].flatMap((side) => [
        side?.heading ? h(level, str(side.heading)) : '',
        escapeText(str(side?.body)),
      ])
    ),
  'three-column-cards': (p, level) =>
    join(
      (p.cards as Bag[]).flatMap((card) => [
        h(level, str(card.heading)),
        escapeText(str(card.body)),
      ])
    ),
  'image-left': imageSide,
  'image-right': imageSide,
  'image-centered': (p) =>
    join([
      image((p.image as Bag).alt, (p.image as Bag).src),
      p.caption ? italic(str(p.caption)) : '',
    ]),
  'image-full-bleed': (p) =>
    join([
      image((p.image as Bag).alt, (p.image as Bag).src),
      p.caption ? italic(str(p.caption)) : '',
      p.credit ? italic(`Credit: ${str(p.credit)}`) : '',
    ]),
  quote: (p) =>
    [
      ...escapeText(str(p.quote)).split('\n'),
      ...(p.cite ? ['', `— ${escapeInline(str(p.cite))}`] : []),
    ]
      .map((line) => (line ? `> ${line}` : '>'))
      .join('\n'),
  'code-with-callout': (p, level) => {
    const code = p.code as Bag;
    const highlights = Array.isArray(code.highlights)
      ? (code.highlights as unknown[]).map(str)
      : [];
    return join([
      codeFence(str(code.source), str(code.lang)),
      highlights.length
        ? `*Highlighted lines, step by step: ${highlights.map(escapeInline).join(' → ')}*`
        : '',
      p.heading ? h(level, str(p.heading)) : '',
      (p.bullets as unknown[]).map((bullet) => `- ${escapeInline(str(bullet))}`).join('\n'),
    ]);
  },
  'big-stat': (p) =>
    join([
      `**${escapeInline(str(p.number))}** ${escapeInline(str(p.label))}`,
      p.context ? escapeText(str(p.context)) : '',
      p.source ? italic(`Source: ${str(p.source)}`) : '',
    ]),
  'comparison-table': (p) =>
    table(
      ['', ...(p.columns as unknown[]).map(str)],
      (p.rows as Bag[]).map((row) => [
        str(row.label),
        ...(row.values as unknown[]).map((v) => (v === true ? 'Yes' : v === false ? 'No' : str(v))),
      ])
    ),
  'process-steps': (p) =>
    (p.steps as Bag[])
      .map(
        (step, i) =>
          `${i + 1}. **${escapeInline(str(step.title))}**${step.body ? ` ${escapeInline(str(step.body))}` : ''}`
      )
      .join('\n'),
  timeline: (p) =>
    (p.events as Bag[])
      .map((event) => `- **${escapeInline(str(event.time))}** ${escapeInline(str(event.text))}`)
      .join('\n'),
  'team-avatars': (p) =>
    (p.people as Bag[])
      .map(
        (person) =>
          `- **${escapeInline(str(person.name))}**${person.role ? ` — ${escapeInline(str(person.role))}` : ''}`
      )
      .join('\n'),
  'closing-cta': (p) => {
    const cta = p.cta as Bag;
    const href = str(cta.href);
    const safe =
      /^(?:https:|mailto:|#)/.test(href) || (/^[A-Za-z0-9._~/-]/.test(href) && !href.includes(':'));
    return join([
      p.text ? escapeText(str(p.text)) : '',
      safe
        ? `[${escapeInline(str(cta.label))}](${linkTarget(href)})`
        : escapeInline(str(cta.label)),
      p.footnote ? italic(str(p.footnote)) : '',
    ]);
  },
  'video-centered': (p) =>
    join([video((p.video as Bag).label), p.caption ? italic(str(p.caption)) : '']),
  'video-left': videoSide,
  'video-right': videoSide,
  chart: (p) => chartText(p.spec as Bag),
};

function imageSide(p: Bag, level: number): string {
  return join([
    image((p.image as Bag).alt, (p.image as Bag).src),
    p.heading ? h(level, str(p.heading)) : '',
    escapeText(str(p.body)),
  ]);
}

function videoSide(p: Bag, level: number): string {
  return join([
    video((p.video as Bag).label),
    p.heading ? h(level, str(p.heading)) : '',
    escapeText(str(p.body)),
  ]);
}

/** The title a slide is known by: its own, else the layout's title prop, else the first heading. */
export function slideTitle(slide: DeckSlide): string | null {
  const own = slide.title?.trim();
  if (own) return own;
  const bag = slide as unknown as Bag;
  if (Array.isArray(bag.blocks)) {
    const first = (bag.blocks as Bag[]).find((block) => block.type === 'heading');
    return first ? str(first.text).trim() || null : null;
  }
  const props = (bag.props ?? {}) as Bag;
  if (slide.layout === 'custom') return null;
  for (const key of ['title', 'heading', 'number']) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  if (slide.layout === 'quote' && typeof props.quote === 'string') {
    const quote = props.quote.trim().replace(/\s+/g, ' ');
    return quote.length > 60 ? `${quote.slice(0, 59)}…` : quote;
  }
  return null;
}

function slideBody(slide: DeckSlide, level: number): string {
  const bag = slide as unknown as Bag;
  if (slide.layout === 'free') return blocksText(bag.blocks as Bag[], level);
  if (slide.layout === 'component') {
    const component = bag.component as Bag;
    return blockText(
      { type: 'component', component: component.component, props: component.props },
      level
    );
  }
  if (slide.layout === 'custom') {
    const props = bag.props as Bag;
    return join([
      `*Custom slide ${inlineCode(str(props.component))}*`,
      strings(props.data).join('\n'),
    ]);
  }
  const render = LAYOUT_TEXT[slide.layout];
  return render ? render(bag.props as Bag, level) : strings(bag.props).join('\n');
}

function listed(deck: Deck, includeHidden: boolean) {
  const sectionOf = new Map<string, { id: string; title?: string }>();
  for (const section of deck.outline?.sections ?? []) {
    for (const id of section.slideIds) {
      if (!sectionOf.has(id))
        sectionOf.set(
          id,
          section.title === undefined
            ? { id: section.id }
            : { id: section.id, title: section.title }
        );
    }
  }
  return deck.slides
    .filter((slide) => includeHidden || !slide.hidden)
    .map((slide, i) => ({ slide, number: i + 1, section: sectionOf.get(slide.id) ?? null }));
}

/** Never a valid section id (ids are lowercase slugs). */
const UNGROUPED = '#ungrouped';

/** The deck as a readable, inert Markdown document (one-way; see `deckToMarkdown` for the round-trip form). */
export function deckToText(deck: Deck, options: DeckTextOptions = {}): string {
  const includeNotes = options.notes ?? true;
  const slides = listed(deck, options.includeHidden ?? false);
  const hasSections = slides.some((entry) => entry.section !== null);
  const slideLevel = hasSections ? 3 : 2;
  const parts: string[] = [
    h(1, deck.outline?.title?.trim() || options.title?.trim() || deck.meta.title),
  ];
  let current: string | null = null;
  for (const { slide, number, section } of slides) {
    if (hasSections && section && section.id !== current) {
      current = section.id;
      parts.push(h(2, section.title?.trim() || section.id));
    } else if (hasSections && !section && current !== null && current !== UNGROUPED) {
      current = UNGROUPED;
      parts.push(h(2, 'Other slides'));
    }
    const title = slideTitle(slide);
    parts.push(
      join([
        `${'#'.repeat(slideLevel)} ${number}. ${title ? escapeInline(title) : `Slide ${number}`}`,
        slideBody(slide, slideLevel + 1),
        includeNotes &&
          slide.notes?.trim() &&
          join([h(slideLevel + 1, 'Notes'), escapeText(slide.notes)]),
      ])
    );
  }
  return `${parts.join('\n\n')}\n`;
}

export interface DeckOutlineSlide {
  /** 1-based position among the listed slides. */
  number: number;
  id: string;
  layout: string;
  title: string | null;
  section: string | null;
  hidden: boolean;
}

export interface DeckOutlineText {
  title: string | null;
  slides: DeckOutlineSlide[];
}

/** One compact row per slide: id, layout and title (for authoring hints, MCP and agents). */
export function deckOutline(
  deck: Deck,
  options: Pick<DeckTextOptions, 'includeHidden'> = {}
): DeckOutlineText {
  return {
    title: deck.outline?.title?.trim() || deck.meta.title.trim() || null,
    slides: listed(deck, options.includeHidden ?? true).map(({ slide, number, section }) => ({
      number,
      id: slide.id,
      layout: slide.layout,
      title: slideTitle(slide),
      section: section?.id ?? null,
      hidden: slide.hidden === true,
    })),
  };
}

/** The outline as plain lines: `3. pricing · comparison-table · Plans compared`. */
export function formatDeckOutline(outline: DeckOutlineText): string {
  const clean = (text: string) => stripHidden(text).replace(/\s+/g, ' ').trim();
  return outline.slides
    .map(
      (slide) =>
        `${slide.number}. ${slide.id} · ${slide.layout}${slide.title ? ` · ${clean(slide.title)}` : ''}${slide.hidden ? ' (hidden)' : ''}`
    )
    .join('\n');
}
