import type { Recording } from './provider.ts';

/**
 * Recorded answers for the site's preset prompts, replayed by the fake
 * provider until the developer chooses a real one. Fictional data only.
 */

const heading = (level: number, text: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'heading', level, text } },
});
const text = (markdown: string) => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});

export const DEMO_PROMPTS = {
  report: 'Build a weekly report for the fictional Harbor support team.',
  dashboard: 'Make a dashboard of ticket volume by channel.',
  deck: 'Prepare a three-point planning deck for Monday.',
} as const;

export const DEMO_RECORDINGS: readonly Recording[] = [
  {
    prompt: DEMO_PROMPTS.report,
    calls: [
      [
        {
          type: 'text',
          text: 'Here is a weekly report with the highlights and the ticket numbers.',
        },
        {
          type: 'tool',
          name: 'emit_blueprint',
          input: {
            tree: {
              id: 'layout-doc',
              props: { title: 'Harbor support, week 42' },
              children: [
                heading(2, 'Highlights'),
                text('Median first response fell to **42 minutes**. Satisfaction held at 94%.'),
                {
                  id: 'blocks-data',
                  props: {
                    block: {
                      type: 'kpi',
                      items: [
                        { label: 'Tickets solved', value: '1,310', delta: '+9%', tone: 'success' },
                        { label: 'Open backlog', value: '193', delta: '-4%', tone: 'success' },
                      ],
                    },
                  },
                },
                heading(2, 'Next week'),
                text('Close the oldest Integrations tickets and review the billing macros.'),
              ],
            },
          },
        },
        { type: 'usage', inputTokens: 1200, outputTokens: 240 },
      ],
    ],
  },
  {
    prompt: DEMO_PROMPTS.dashboard,
    calls: [
      [
        { type: 'text', text: 'A dashboard with the channel mix and the daily volume.' },
        {
          type: 'tool',
          name: 'emit_blueprint',
          input: {
            tree: {
              id: 'layout-page',
              props: { title: 'Ticket volume', description: 'Fictional data for week 42.' },
              children: [
                {
                  id: 'layout-grid',
                  props: { columns: 2 },
                  children: [
                    {
                      id: 'layout-card',
                      props: { title: 'By channel' },
                      children: [
                        {
                          id: 'charts-donut',
                          props: {
                            title: 'Tickets by channel',
                            description: 'Share of tickets per channel',
                            data: [
                              { id: 'email', label: 'Email', value: 540 },
                              { id: 'chat', label: 'Chat', value: 486 },
                              { id: 'phone', label: 'Phone', value: 258 },
                            ],
                            labels: { table: 'Data table', category: 'Channel', value: 'Tickets' },
                          },
                        },
                      ],
                    },
                    {
                      id: 'layout-card',
                      props: { title: 'Per day' },
                      children: [
                        {
                          id: 'charts-bar',
                          props: {
                            title: 'Tickets per day',
                            description: 'Opened tickets per weekday',
                            series: [
                              {
                                id: 'opened',
                                label: 'Opened',
                                points: [
                                  { x: 'Mon', y: 210 },
                                  { x: 'Tue', y: 198 },
                                  { x: 'Wed', y: 187 },
                                ],
                              },
                            ],
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        },
        { type: 'usage', inputTokens: 1300, outputTokens: 310 },
      ],
    ],
  },
  {
    prompt: DEMO_PROMPTS.deck,
    calls: [
      [
        { type: 'text', text: 'A short deck: what shipped, what is blocked, and the plan.' },
        {
          type: 'tool',
          name: 'emit_blueprint',
          input: {
            tree: {
              id: 'layout-deck',
              props: { title: 'Monday planning' },
              children: [
                heading(2, 'Shipped'),
                text('Billing exports and the new onboarding checklist.'),
                heading(2, 'Blocked'),
                text('The calendar sync waits on a vendor fix.'),
                heading(2, 'Plan'),
                text('Finish the sync, then start the reporting refresh.'),
              ],
            },
          },
        },
        { type: 'usage', inputTokens: 1100, outputTokens: 200 },
      ],
    ],
  },
];
