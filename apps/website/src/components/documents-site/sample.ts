/**
 * The /documents-page/ sample documents: a fictional team handbook (with
 * nested pages, columns, a callout, a toggle and a live chart embed), the
 * draft two people review together, and the page settings of the paged
 * view. Titles are level-2 headings, so the page keeps one h1 in every
 * view (the paged view renders levels as written). Plain `@texuli/document` data, validated at the untrusted tier by
 * apps/website/tests/site-documents.test.ts. Fictional data only
 * (Harbor, example.com).
 */
import type { DocumentInline, DocumentJsonObject, TexuliDocument } from '@texuli/document/model';

const text = (value: string): DocumentInline[] => [{ type: 'text', text: value, marks: [] }];

const para = (id: string, value: string) => ({
  id,
  type: 'paragraph' as const,
  content: text(value),
});

const heading = (id: string, level: 2 | 3 | 4, value: string) => ({
  id,
  type: 'heading' as const,
  level,
  content: text(value),
});

const item = (id: string, value: string, checked?: boolean) => ({
  id,
  ...(checked === undefined ? {} : { checked }),
  blocks: [para(`${id}-text`, value)],
});

/** The chart the handbook embeds: a catalog component the player paints. */
export const HANDBOOK_CHART = {
  id: 'charts-donut',
  props: {
    title: 'Tickets by channel',
    description: 'Share of tickets by channel last week (fictional)',
    data: [
      { id: 'email', label: 'Email', value: 54 },
      { id: 'chat', label: 'Chat', value: 48 },
      { id: 'phone', label: 'Phone', value: 25 },
    ],
    labels: { table: 'Data table', category: 'Channel', value: 'Tickets' },
  },
} as const;

/** The root page of the handbook: every kind of block the editor offers, in one page. */
export const HANDBOOK: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: {
    title: 'Harbor team handbook',
    locale: 'en',
    authors: ['Harbor support team'],
    description: 'How the fictional Harbor support team works.',
  },
  page: {
    size: 'a4',
    orientation: 'portrait',
    header: { start: '{title}', end: 'Fictional sample' },
    footer: { center: 'Page {page} of {pages}' },
    breaks: ['numbers'],
  },
  blocks: [
    heading('title', 2, 'Harbor team handbook'),
    {
      id: 'intro',
      type: 'paragraph',
      content: [
        { type: 'text', text: 'How the fictional Harbor support team works: ', marks: [] },
        { type: 'text', text: 'who answers what', marks: [{ type: 'strong' }] },
        { type: 'text', text: ', the weekly rituals and the numbers we watch. The ', marks: [] },
        {
          type: 'text',
          text: 'status page',
          marks: [{ type: 'link', href: 'https://example.com/status' }],
        },
        { type: 'text', text: ' lists open incidents.', marks: [] },
      ],
    },
    {
      id: 'tip',
      type: 'callout',
      tone: 'info',
      title: 'Try it',
      blocks: [
        para(
          'tip-text',
          'Type / in an empty paragraph for the block menu. Drag a handle, or press Alt+Up and Alt+Down, to move a block.'
        ),
      ],
    },
    heading('who', 3, 'Who answers what'),
    {
      id: 'who-columns',
      type: 'columns',
      columns: [
        {
          id: 'who-left',
          type: 'column',
          width: 6,
          blocks: [
            {
              id: 'who-list',
              type: 'list',
              kind: 'bullet',
              items: [
                item('who-email', 'Email: Ada and Lin, within four hours'),
                item('who-chat', 'Chat: the on-call pair, within ten minutes'),
                item('who-phone', 'Phone: Sam, business hours'),
              ],
            },
          ],
        },
        {
          id: 'who-right',
          type: 'column',
          width: 6,
          blocks: [
            para(
              'who-note',
              'Escalations go to the duty lead. Billing questions go to the finance queue, never to a personal inbox.'
            ),
          ],
        },
      ],
    },
    heading('pages', 3, 'More pages'),
    { id: 'link-onboarding', type: 'page-link', ref: 'pages/onboarding', title: 'Onboarding' },
    { id: 'link-rituals', type: 'page-link', ref: 'pages/rituals', title: 'Weekly rituals' },
    heading('numbers', 3, 'The numbers we watch'),
    para(
      'numbers-text',
      'The chart below is a catalog component embedded in the page and painted by the player at the untrusted tier.'
    ),
    {
      id: 'chart',
      type: 'embed',
      kind: 'component',
      title: 'Tickets by channel',
      inline: structuredClone(HANDBOOK_CHART) as unknown as DocumentJsonObject,
    },
    {
      id: 'faq',
      type: 'toggle',
      summary: text('Why a handbook and not a wiki?'),
      blocks: [
        para(
          'faq-text',
          'One owner per page, every edit in one history, and the same document exports to Markdown, DOCX and PDF.'
        ),
      ],
    },
    {
      id: 'quote',
      type: 'quote',
      blocks: [para('quote-text', 'Answer the customer, then fix the cause.')],
    },
    { id: 'end', type: 'divider' },
  ],
};

/** The nested pages the handbook links to, by reference. */
export const NESTED_PAGES: Readonly<Record<string, TexuliDocument>> = {
  'pages/onboarding': {
    format: 'texuli-document',
    formatVersion: 1,
    meta: { title: 'Onboarding', locale: 'en' },
    blocks: [
      heading('ob-title', 2, 'Onboarding'),
      para('ob-intro', 'Your first week on the fictional Harbor team.'),
      {
        id: 'ob-list',
        type: 'list',
        kind: 'todo',
        items: [
          item('ob-1', 'Read the handbook', true),
          item('ob-2', 'Shadow a chat shift', false),
          item('ob-3', 'Answer your first ticket', false),
        ],
      },
      { id: 'ob-link', type: 'page-link', ref: 'pages/rituals', title: 'Weekly rituals' },
    ],
  },
  'pages/rituals': {
    format: 'texuli-document',
    formatVersion: 1,
    meta: { title: 'Weekly rituals', locale: 'en' },
    blocks: [
      heading('ri-title', 2, 'Weekly rituals'),
      {
        id: 'ri-list',
        type: 'list',
        kind: 'ordered',
        items: [
          item('ri-1', 'Monday: plan the week'),
          item('ri-2', 'Wednesday: review the oldest tickets'),
          item('ri-3', 'Friday: write the weekly report'),
        ],
      },
    ],
  },
};

/** The root page of the handbook, as a page reference for the breadcrumb. */
export const HANDBOOK_REF = { ref: 'pages/handbook', title: 'Harbor team handbook' } as const;

/** The draft two collaborators review side by side. */
export const REVIEW_DRAFT: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: { title: 'Release notes draft', locale: 'en' },
  blocks: [
    heading('rn-title', 2, 'Release notes draft'),
    para('rn-intro', 'The fictional Harbor app gets faster search and a calmer inbox this week.'),
    para('rn-search', 'Search now answers in under a second for most queries.'),
    {
      id: 'rn-list',
      type: 'list',
      kind: 'bullet',
      items: [
        item('rn-1', 'Filters remember your last choice'),
        item('rn-2', 'Archived tickets stay out of the inbox'),
      ],
    },
  ],
};
