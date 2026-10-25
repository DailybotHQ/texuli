/** A fictional planning deck blueprint (layout-deck with card slides), untrusted tier. */
export const deckBlueprint = {
  id: 'layout-deck',
  props: { title: 'Lighthouse planning, sprint 18' },
  children: [
    {
      id: 'layout-card',
      props: { title: 'Agenda' },
      children: [
        {
          id: 'blocks-text',
          props: {
            block: {
              type: 'list',
              items: [
                { text: 'Progress since sprint 17' },
                { text: 'Help center launch plan' },
                { text: 'Decisions we need today' },
              ],
            },
          },
        },
      ],
    },
    {
      id: 'layout-card',
      props: { title: 'Progress' },
      children: [
        {
          id: 'blocks-data',
          props: {
            block: {
              type: 'stat',
              items: [
                { label: 'Stories done', value: '21 of 24', tone: 'success' },
                { label: 'Bugs closed', value: '17', delta: '+5', tone: 'success' },
              ],
            },
          },
        },
      ],
    },
    {
      id: 'layout-card',
      props: { title: 'Burn-down' },
      children: [
        {
          id: 'charts-line',
          props: {
            title: 'Remaining points',
            description: 'Fictional remaining story points fell steadily across the sprint.',
            series: [
              {
                id: 'remaining',
                label: 'Remaining points',
                points: [
                  { x: 'Day 1', y: 48 },
                  { x: 'Day 3', y: 39 },
                  { x: 'Day 5', y: 30 },
                  { x: 'Day 7', y: 19 },
                  { x: 'Day 9', y: 8 },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      id: 'layout-card',
      props: { title: 'Decisions needed' },
      children: [
        {
          id: 'blocks-text',
          props: {
            block: {
              type: 'callout',
              tone: 'warning',
              title: 'Launch date',
              body: 'Confirm whether the help center launches on the 14th or waits for translations.',
            },
          },
        },
      ],
    },
  ],
};
