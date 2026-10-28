import { BLOCK_CONTENT_LIMITS } from '../schema/primitives.ts';
import type { BlockCatalogEntry } from './types.ts';

/**
 * Catalog metadata for the core block vocabulary. Later family tasks extend
 * this list; agents and the website read useWhen / dontUseWhen / limits / a11y.
 */
export const BLOCK_CATALOG: readonly BlockCatalogEntry[] = Object.freeze([
  {
    type: 'heading',
    label: 'Heading',
    family: 'text',
    useWhen: ['Introduce a section or slide title with a clear hierarchy.'],
    dontUseWhen: ['Long body copy — use a text block instead.'],
    limits: [
      `text ≤ ${BLOCK_CONTENT_LIMITS.heading} characters`,
      'level 1–4',
      'align: start | center',
    ],
    a11y: 'Rendered as the matching heading level; keep one h1 per page when possible.',
    exampleMinimal: { type: 'heading', level: 2, text: 'Section title' },
    exampleRich: {
      type: 'heading',
      level: 1,
      text: 'Northwind quarterly review',
      eyebrow: 'Q3 2026',
      subtitle: 'Fictional example data only',
      align: 'center',
      id: 'title',
    },
  },
  {
    type: 'text',
    label: 'Paragraph',
    family: 'text',
    useWhen: ['Body copy with light markdown emphasis.'],
    dontUseWhen: ['A single short label — use heading or list item text.'],
    limits: [
      `markdown ≤ ${BLOCK_CONTENT_LIMITS.markdown} characters`,
      'size: sm | md | lg; align: start | center',
    ],
    a11y: 'Markdown is parsed to semantic elements; no raw HTML.',
    exampleMinimal: { type: 'text', markdown: 'A short paragraph.' },
    exampleRich: {
      type: 'text',
      markdown: 'Northwind Labs is a **fictional** company.\n\nEvery number below is example data.',
      size: 'lg',
    },
  },
  {
    type: 'list',
    label: 'List',
    family: 'text',
    useWhen: ['Three or more parallel points or steps.'],
    dontUseWhen: ['A single sentence — use text.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.listItems} items`,
      'style: bullet | number | check (item done) | icon (item icon)',
    ],
    a11y: 'Rendered as ul or ol; check items are named Done or Not done.',
    exampleMinimal: { type: 'list', items: [{ text: 'First item' }] },
    exampleRich: {
      type: 'list',
      style: 'check',
      items: [{ text: 'Plan', done: true }, { text: 'Ship', done: true }, { text: 'Measure' }],
    },
  },
  {
    type: 'quote',
    label: 'Quote',
    family: 'text',
    useWhen: ['A short pull quote or testimonial.'],
    dontUseWhen: ['Long body copy — use text.'],
    limits: [
      `quote ≤ ${BLOCK_CONTENT_LIMITS.shortMarkdown} characters`,
      'avatar: like image src (no remote URLs)',
    ],
    a11y: 'Uses the blockquote element; cite and role are optional plain text.',
    exampleMinimal: { type: 'quote', quote: 'Ship small pieces.' },
    exampleRich: {
      type: 'quote',
      quote: 'Small pieces. Infinite possibilities.',
      cite: 'Ada Example',
      role: 'Head of Design (fictional)',
      avatar: 'avatar:av-007',
      tone: 'accent',
    },
  },
  {
    type: 'callout',
    label: 'Callout',
    family: 'text',
    useWhen: ['Highlight a warning, tip or summary beside the main flow.'],
    dontUseWhen: ['Primary body content — use text.'],
    limits: [
      `body ≤ ${BLOCK_CONTENT_LIMITS.shortMarkdown} characters`,
      'icon: a kebab-case icon name',
    ],
    a11y: 'Tone maps to theme tokens with AA contrast; title is optional.',
    exampleMinimal: { type: 'callout', body: 'Remember the limits.' },
    exampleRich: {
      type: 'callout',
      title: 'Summary',
      body: 'Median response fell while volume grew **18%**.',
      icon: 'info',
      tone: 'info',
    },
  },
  {
    type: 'divider',
    label: 'Divider',
    family: 'structure',
    useWhen: ['Separate two sections visually.'],
    dontUseWhen: ['Nesting content — use columns or headings.'],
    limits: ['variant: line | space; label (line only)'],
    a11y: 'A thematic break (hr); a label names it.',
    exampleMinimal: { type: 'divider' },
    exampleRich: { type: 'divider', label: 'Part two', tone: 'neutral' },
  },
  {
    type: 'code',
    label: 'Code',
    family: 'code',
    useWhen: ['Show a short code sample or config snippet.'],
    dontUseWhen: ['Prose — use text.'],
    limits: [
      `code ≤ ${BLOCK_CONTENT_LIMITS.code} characters`,
      `≤ ${BLOCK_CONTENT_LIMITS.codeLines} lines`,
      `≤ ${BLOCK_CONTENT_LIMITS.codeHighlightSteps} highlight steps ("1-2,4")`,
    ],
    a11y: 'Preformatted text; language is metadata for highlighters, not executed.',
    exampleMinimal: { type: 'code', code: 'const n = 1;' },
    exampleRich: {
      type: 'code',
      lang: 'ts',
      filename: 'example.ts',
      caption: 'One export.',
      lineNumbers: true,
      highlights: ['1', '2'],
      code: 'export const a = 1;\nexport const b = 2;\n',
    },
  },
  {
    type: 'cta',
    label: 'Call to action',
    family: 'structure',
    useWhen: ['One to three safe outbound or in-page actions.'],
    dontUseWhen: ['Navigation chrome — use the app shell.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.ctaActions} actions`,
      'href uses the untrusted URL policy (https, mailto, #fragment)',
    ],
    a11y: 'Actions are real links with visible labels; blocked hrefs never render as anchors.',
    exampleMinimal: {
      type: 'cta',
      actions: [{ label: 'Read the guide', href: 'https://example.com/guide' }],
    },
    exampleRich: {
      type: 'cta',
      actions: [
        { label: 'Docs', href: 'https://example.com/docs' },
        { label: 'Contact', href: 'mailto:hello@example.com' },
      ],
    },
  },
  {
    type: 'columns',
    label: 'Columns',
    family: 'structure',
    useWhen: ['Place two to four short blocks side by side.'],
    dontUseWhen: ['Deep nesting — keep containers shallow.'],
    limits: [
      `2–${BLOCK_CONTENT_LIMITS.columns} columns`,
      `≤ ${BLOCK_CONTENT_LIMITS.blocksPerColumn} blocks per column`,
      `nesting ≤ ${BLOCK_CONTENT_LIMITS.containerDepth}`,
    ],
    a11y: 'Columns reflow on narrow viewports; order follows source order.',
    exampleMinimal: {
      type: 'columns',
      columns: [[{ type: 'text', markdown: 'Left' }], [{ type: 'text', markdown: 'Right' }]],
    },
    exampleRich: {
      type: 'columns',
      columns: [
        [
          { type: 'heading', level: 3, text: 'Plan' },
          { type: 'text', markdown: 'Write the brief.' },
        ],
        [
          { type: 'heading', level: 3, text: 'Ship' },
          { type: 'text', markdown: 'Validate and release.' },
        ],
      ],
    },
  },
  {
    type: 'grid',
    label: 'Grid',
    family: 'structure',
    useWhen: ['Show a small set of titled cells in a responsive grid.'],
    dontUseWhen: ['Linked feature cards — use cards; nested blocks — use columns.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.cards} cells`,
      'columns 2–4 optional',
      `body ≤ ${BLOCK_CONTENT_LIMITS.shortMarkdown} characters`,
    ],
    a11y: 'Each cell is an article; the section label comes from title or a default.',
    exampleMinimal: {
      type: 'grid',
      cells: [
        { title: 'Design', body: 'Tokens and themes.' },
        { title: 'Build', body: 'Components and blocks.' },
      ],
    },
    exampleRich: {
      type: 'grid',
      title: 'Harbor squads',
      columns: 3,
      cells: [
        { title: 'Design', body: 'Owns the token contract.', tone: 'info' },
        { title: 'Build', body: 'Ships the structure family.', tone: 'success' },
        { title: 'Review', body: 'Checks a11y and contrast.', tone: 'warning' },
      ],
    },
  },
  {
    type: 'tabs',
    label: 'Tabs',
    family: 'structure',
    useWhen: ['Show two to six panels of content, one at a time.'],
    dontUseWhen: ['A long FAQ — use accordion; side-by-side content — use columns.'],
    limits: [
      `2–${BLOCK_CONTENT_LIMITS.tabPanels} panels`,
      `≤ ${BLOCK_CONTENT_LIMITS.blocksPerColumn} blocks per panel`,
      `nesting ≤ ${BLOCK_CONTENT_LIMITS.containerDepth}`,
      'stable id required',
    ],
    a11y: 'Renders as a real tab list with tabpanels; keyboard arrows move focus.',
    exampleMinimal: {
      type: 'tabs',
      id: 'overview',
      label: 'Overview',
      panels: [
        { id: 'plan', label: 'Plan', blocks: [{ type: 'text', markdown: 'Write the brief.' }] },
        {
          id: 'ship',
          label: 'Ship',
          blocks: [{ type: 'text', markdown: 'Validate and release.' }],
        },
      ],
    },
    exampleRich: {
      type: 'tabs',
      id: 'harbor-tabs',
      label: 'Harbor product areas',
      defaultPanel: 'design',
      panels: [
        {
          id: 'design',
          label: 'Design',
          blocks: [
            { type: 'heading', level: 3, text: 'Design' },
            { type: 'text', markdown: 'Tokens, themes and contrast.' },
          ],
        },
        {
          id: 'build',
          label: 'Build',
          blocks: [{ type: 'text', markdown: 'Components and content blocks.' }],
        },
      ],
    },
  },
  {
    type: 'accordion',
    label: 'Accordion',
    family: 'structure',
    useWhen: ['Collapse short FAQ-style sections under headings.'],
    dontUseWhen: ['One panel at a time with nested blocks — use tabs.'],
    limits: [
      `1–${BLOCK_CONTENT_LIMITS.tabPanels} items`,
      `body ≤ ${BLOCK_CONTENT_LIMITS.shortMarkdown} characters`,
    ],
    a11y: 'Each item is a heading button that expands a region; single or multiple mode.',
    exampleMinimal: {
      type: 'accordion',
      items: [
        { id: 'what', title: 'What is Harbor?', body: 'A fictional product lab.' },
        { id: 'who', title: 'Who is it for?', body: 'Design and build squads.' },
      ],
    },
    exampleRich: {
      type: 'accordion',
      id: 'faq',
      label: 'Harbor FAQ',
      mode: 'single',
      items: [
        {
          id: 'limits',
          title: 'What are the limits?',
          body: 'Each family keeps short markdown and shallow nesting.',
        },
        {
          id: 'a11y',
          title: 'How is accessibility handled?',
          body: 'Keyboard operation, AA contrast and forced-colors borders.',
        },
      ],
    },
  },
  {
    type: 'cards',
    label: 'Cards',
    family: 'structure',
    useWhen: ['Present a small set of titled cards, optionally linked.'],
    dontUseWhen: ['Plain cells without links — use grid; data tables — use table.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.cards} items`,
      'columns 2–4 optional',
      'href uses the untrusted URL policy',
      'icon: a kebab-case icon name',
    ],
    a11y: 'Linked cards are single anchors with a visible title; rejected hrefs stay non-interactive.',
    exampleMinimal: {
      type: 'cards',
      items: [
        { title: 'Docs', body: 'Read the guide.', href: 'https://example.com/docs' },
        { title: 'Support', body: 'Ask the team.', href: 'mailto:hello@example.com' },
      ],
    },
    exampleRich: {
      type: 'cards',
      title: 'Harbor resources',
      columns: 2,
      items: [
        {
          title: 'Design system',
          icon: 'check',
          eyebrow: 'Tokens',
          body: 'Palettes, type and density.',
          href: 'https://example.com/design',
          tone: 'info',
        },
        {
          title: 'Component kit',
          eyebrow: 'UI',
          body: 'Buttons, cards and tabs.',
          href: 'https://example.com/ui',
          tone: 'success',
        },
      ],
    },
  },
  {
    type: 'image',
    label: 'Image',
    family: 'media',
    useWhen: ['Show one photo or illustration inline.'],
    dontUseWhen: ['A set of related photos — use gallery; a captioned plate — use figure.'],
    limits: [
      'src is avatar:, relative raster path, or png/jpeg/webp/gif data URI (no remote URLs)',
      `width/height ≤ ${BLOCK_CONTENT_LIMITS.mediaDimension}`,
    ],
    a11y: 'alt is required unless decorative: true; caption and credit are plain text.',
    exampleMinimal: {
      type: 'image',
      src: 'assets/cover.webp',
      alt: 'Cover',
      width: 16,
      height: 9,
    },
    exampleRich: {
      type: 'image',
      src: 'assets/harbor.webp',
      alt: 'Harbor at dusk',
      width: 1200,
      height: 800,
      caption: 'Northwind Labs dock (fictional).',
      credit: 'Example Studio',
      fit: 'cover',
    },
  },
  {
    type: 'figure',
    label: 'Figure',
    family: 'media',
    useWhen: ['A single image that must carry a caption.'],
    dontUseWhen: ['Decorative chrome without a caption — use image with decorative: true.'],
    limits: ['caption required', 'same src rules as image'],
    a11y: 'Rendered as figure/figcaption; alt still required unless decorative.',
    exampleMinimal: {
      type: 'figure',
      src: 'assets/diagram.webp',
      alt: 'Flow diagram',
      width: 800,
      height: 500,
      caption: 'Request path through the API gateway.',
    },
    exampleRich: {
      type: 'figure',
      src: 'assets/diagram.webp',
      alt: 'Architecture sketch',
      width: 960,
      height: 540,
      caption: 'Harbor Notes service map (example).',
      credit: 'Northwind Labs',
      fit: 'contain',
    },
  },
  {
    type: 'video',
    label: 'Video',
    family: 'media',
    useWhen: ['Short product or tutorial clips that ship with the document.'],
    dontUseWhen: ['Remote streams — only embedded or relative mp4/webm sources.'],
    limits: [
      'src is relative mp4/webm or data URI',
      'autoplay requires muted: true',
      `width/height ≤ ${BLOCK_CONTENT_LIMITS.mediaDimension}`,
    ],
    a11y: 'label is the accessible name; controls default on; autoplay respects reduced motion.',
    exampleMinimal: {
      type: 'video',
      src: './clips/demo.mp4',
      label: 'Product tour',
      width: 16,
      height: 9,
    },
    exampleRich: {
      type: 'video',
      src: './clips/demo.mp4',
      label: 'Harbor Notes walkthrough',
      poster: 'assets/poster.webp',
      width: 1280,
      height: 720,
      caption: 'Two-minute overview (fictional).',
      controls: true,
      loop: false,
    },
  },
  {
    type: 'gallery',
    label: 'Gallery',
    family: 'media',
    useWhen: ['Two or more related images in a grid.'],
    dontUseWhen: ['A single image — use image or figure.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.galleryItems} items`,
      'each item follows image src rules',
      'columns 2–4 optional',
    ],
    a11y: 'Each item keeps its own alt; title labels the group.',
    exampleMinimal: {
      type: 'gallery',
      items: [
        { src: 'assets/a.webp', alt: 'A', width: 4, height: 3 },
        { src: 'assets/b.webp', alt: 'B', width: 4, height: 3 },
      ],
    },
    exampleRich: {
      type: 'gallery',
      title: 'Harbor Notes screens',
      columns: 3,
      items: [
        {
          src: 'assets/a.webp',
          alt: 'Inbox',
          width: 800,
          height: 600,
          caption: 'Inbox',
        },
        {
          src: 'assets/b.webp',
          alt: 'Editor',
          width: 800,
          height: 600,
          caption: 'Editor',
        },
        {
          src: 'assets/c.webp',
          alt: 'Share sheet',
          width: 800,
          height: 600,
          caption: 'Share',
        },
      ],
    },
  },
  {
    type: 'table',
    label: 'Table',
    family: 'data',
    useWhen: ['Compare a small set of labeled values in rows and columns.'],
    dontUseWhen: ['Huge datasets — use a data grid view instead.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.tableColumns} columns`,
      `≤ ${BLOCK_CONTENT_LIMITS.tableRows} rows`,
      'cells are plain text, numbers or null',
    ],
    a11y: 'Native table markup with caption; keep headers short.',
    exampleMinimal: {
      type: 'table',
      columns: [{ id: 'name', label: 'Name' }],
      rows: [{ name: 'Ada' }],
    },
    exampleRich: {
      type: 'table',
      caption: 'Fictional quarterly scores',
      columns: [
        { id: 'team', label: 'Team' },
        { id: 'score', label: 'Score' },
      ],
      rows: [
        { team: 'Design', score: 92 },
        { team: 'Build', score: 88 },
      ],
    },
  },
  {
    type: 'stat',
    label: 'Stat row',
    family: 'data',
    useWhen: ['Show a few key figures with short labels.'],
    dontUseWhen: ['A full KPI dashboard — prefer kpi with denser cards.'],
    limits: [
      `≤ ${BLOCK_CONTENT_LIMITS.statItems} items`,
      `trend: 2–${BLOCK_CONTENT_LIMITS.trendPoints} numbers`,
    ],
    a11y: 'Each stat is a labeled value; deltas are plain text; a title names the group.',
    exampleMinimal: {
      type: 'stat',
      items: [{ label: 'Active', value: '128' }],
    },
    exampleRich: {
      type: 'stat',
      title: 'Northwind this quarter',
      items: [
        {
          label: 'Active seats',
          value: '128',
          delta: '+12%',
          tone: 'success',
          trend: [96, 104, 117, 128],
        },
        { label: 'Median latency', value: '42 ms', tone: 'info' },
      ],
      source: 'Fictional sample data',
    },
  },
  {
    type: 'kpi',
    label: 'KPI row',
    family: 'data',
    useWhen: ['Highlight outcome metrics in a compact row.'],
    dontUseWhen: ['Narrative explanation — pair with text blocks.'],
    limits: [`≤ ${BLOCK_CONTENT_LIMITS.statItems} items`],
    a11y: 'Same structure as stat; rendered as KPI cards.',
    exampleMinimal: {
      type: 'kpi',
      items: [{ label: 'NPS', value: '54' }],
    },
    exampleRich: {
      type: 'kpi',
      items: [
        { label: 'NPS', value: '54', delta: '+3', hint: 'Trailing 90 days', tone: 'success' },
        { label: 'Churn', value: '2.1%', delta: '-0.4%', tone: 'success' },
      ],
    },
  },
  {
    type: 'chart',
    label: 'Chart',
    family: 'data',
    useWhen: ['Embed a small chart with a title and description.'],
    dontUseWhen: ['Exploratory analytics — use a full chart host.'],
    limits: [
      'kind is any @texuli/charts id without "charts-" (line … calendar; see CHART_KINDS)',
      'title and description required',
      'line, area, bar, stacked-bar, combo, heatmap, scatter and bubble take top-level series/cells/points plus optional family extras in props',
      'every other kind takes a closed props object (no callbacks or class)',
      'series/points/cells/props capped for documents',
    ],
    a11y: 'description is required; charts expose a data table fallback.',
    exampleMinimal: {
      type: 'chart',
      kind: 'bar',
      title: 'Sign-ups',
      description: 'Weekly fictional sign-ups.',
      series: [
        {
          id: 'new',
          label: 'New',
          points: [
            { x: 'W1', y: 12 },
            { x: 'W2', y: 18 },
          ],
        },
      ],
    },
    exampleRich: {
      type: 'chart',
      kind: 'line',
      title: 'Latency',
      description: 'Median latency in milliseconds for a fictional service.',
      series: [
        {
          id: 'p50',
          label: 'p50',
          points: [
            { x: 'Mon', y: 40 },
            { x: 'Tue', y: 38 },
            { x: 'Wed', y: 41 },
          ],
        },
      ],
    },
  },
] satisfies readonly BlockCatalogEntry[]);

const byType = new Map(BLOCK_CATALOG.map((entry) => [entry.type, entry]));

/** Look up catalog metadata for a block type. */
export function getCatalogEntry(type: string): BlockCatalogEntry | undefined {
  return byType.get(type as BlockCatalogEntry['type']);
}

/** All catalog types in registration order. */
export function listCatalogTypes(): BlockCatalogEntry['type'][] {
  return BLOCK_CATALOG.map((entry) => entry.type);
}
