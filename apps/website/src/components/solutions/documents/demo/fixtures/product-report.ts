/**
 * The /solutions/documents/ demo fixture (PLAN_015, SOURCE §8.3): a
 * fictional product report with a title, two sections, a list and a data
 * table. Plain `@texuli/document` data; the test validates it at the
 * untrusted tier. Fictional data only (Lumen, example.com).
 */
import type {
  DocumentBlock,
  DocumentInline,
  ListItem,
  TexuliDocument,
} from '@texuli/document/model';

/** The id of the report's title heading (the rename action edits it). */
export const REPORT_TITLE_ID = 'report-title';

const text = (value: string): DocumentInline[] => [{ type: 'text', text: value, marks: [] }];

const paragraph = (id: string, value: string): DocumentBlock => ({
  id,
  type: 'paragraph',
  content: text(value),
});

const heading = (id: string, level: 2 | 3, value: string): DocumentBlock => ({
  id,
  type: 'heading',
  level,
  content: text(value),
});

const item = (id: string, value: string): ListItem => ({
  id,
  blocks: [paragraph(`${id}-text`, value)],
});

/** A fictional quarterly product report. Titles are level 2, so a host page keeps its own h1. */
export const PRODUCT_REPORT: TexuliDocument = {
  format: 'texuli-document',
  formatVersion: 1,
  meta: {
    title: 'Lumen quarterly product report',
    locale: 'en',
    authors: ['Lumen product team'],
    description: 'A fictional product report for the Texuli documents demo.',
  },
  blocks: [
    heading(REPORT_TITLE_ID, 2, 'Lumen quarterly product report'),
    paragraph(
      'summary',
      'Lumen is a fictional note-taking app. This report sums up the quarter for the team.'
    ),
    heading('highlights-heading', 3, 'Highlights'),
    {
      id: 'highlights',
      type: 'list',
      kind: 'bullet',
      items: [
        item('highlight-offline', 'Offline mode shipped to every workspace.'),
        item('highlight-search', 'Search results now load in one round trip.'),
        item('highlight-a11y', 'Every dialog passed a keyboard-only review.'),
      ],
    },
    heading('metrics-heading', 3, 'Metrics'),
    paragraph('metrics-intro', 'The numbers below are sample data, not real usage.'),
    {
      id: 'metrics-table',
      type: 'block',
      family: 'data',
      block: 'table',
      props: {
        caption: 'Quarter metrics (fictional)',
        columns: [
          { id: 'metric', label: 'Metric' },
          { id: 'value', label: 'Value' },
        ],
        rows: [
          { id: 'active', metric: 'Weekly active teams', value: '1,240' },
          { id: 'notes', metric: 'Notes created', value: '58,300' },
          { id: 'nps', metric: 'Survey score', value: '47' },
        ],
      },
    },
  ],
};
