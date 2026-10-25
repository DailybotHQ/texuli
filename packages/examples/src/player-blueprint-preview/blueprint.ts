/** A fictional weekly report blueprint (layout-doc), validated at the untrusted tier. */
export const reportBlueprint = {
  id: 'layout-doc',
  props: { title: 'Lighthouse weekly report' },
  children: [
    { id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'Summary' } } },
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'text',
          markdown:
            'The support squad answered **412 conversations** this week. Median first reply stayed under four minutes.',
        },
      },
    },
    {
      id: 'blocks-data',
      props: {
        block: {
          type: 'kpi',
          items: [
            { label: 'Conversations', value: '412', delta: '+8%', tone: 'success' },
            { label: 'First reply', value: '3m 40s', delta: '-20s', tone: 'success' },
            { label: 'Reopened', value: '9', delta: '+2', tone: 'warning' },
          ],
        },
      },
    },
    {
      id: 'charts-line',
      props: {
        title: 'Conversations per day',
        description: 'Fictional conversations per weekday; Monday is the busiest day.',
        series: [
          {
            id: 'conversations',
            label: 'Conversations',
            points: [
              { x: 'Mon', y: 102 },
              { x: 'Tue', y: 88 },
              { x: 'Wed', y: 79 },
              { x: 'Thu', y: 76 },
              { x: 'Fri', y: 67 },
            ],
          },
        ],
      },
    },
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'callout',
          tone: 'info',
          title: 'Next step',
          body: 'Move the Friday rotation to two people while the new help center ships.',
        },
      },
    },
  ],
};
