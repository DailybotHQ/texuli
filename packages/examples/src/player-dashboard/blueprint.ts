/** A fictional operations dashboard blueprint (layout-page + layout-grid), untrusted tier. */
export const dashboardBlueprint = {
  id: 'layout-page',
  props: {
    title: 'Fleet operations',
    description: 'Fictional delivery fleet metrics for the current week.',
  },
  children: [
    {
      id: 'blocks-data',
      props: {
        block: {
          type: 'kpi',
          items: [
            { label: 'Deliveries', value: '1,284', delta: '+6%', tone: 'success' },
            { label: 'On time', value: '94%', delta: '+1 pt', tone: 'success' },
            { label: 'Open incidents', value: '3', delta: '+1', tone: 'warning' },
          ],
        },
      },
    },
    {
      id: 'layout-grid',
      props: { columns: 2 },
      children: [
        {
          id: 'layout-card',
          props: { title: 'Volume' },
          children: [
            {
              id: 'charts-line',
              props: {
                title: 'Deliveries per day',
                description: 'Fictional deliveries per weekday, peaking on Thursday.',
                series: [
                  {
                    id: 'deliveries',
                    label: 'Deliveries',
                    points: [
                      { x: 'Mon', y: 238 },
                      { x: 'Tue', y: 251 },
                      { x: 'Wed', y: 262 },
                      { x: 'Thu', y: 281 },
                      { x: 'Fri', y: 252 },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'layout-card',
          props: { title: 'Fleet mix' },
          children: [
            {
              id: 'charts-donut',
              props: {
                title: 'Vehicles by type',
                description: 'Vans make up most of the fictional fleet.',
                data: [
                  { id: 'vans', label: 'Vans', value: 42 },
                  { id: 'bikes', label: 'Cargo bikes', value: 18 },
                  { id: 'trucks', label: 'Trucks', value: 9 },
                ],
                labels: { table: 'View data table', category: 'Vehicle type', value: 'Vehicles' },
              },
            },
          ],
        },
        {
          id: 'layout-card',
          props: { title: 'Delays' },
          children: [
            {
              id: 'charts-bar',
              props: {
                title: 'Late deliveries by depot',
                description: 'The north depot had the most late deliveries.',
                series: [
                  {
                    id: 'late',
                    label: 'Late deliveries',
                    points: [
                      { x: 'North', y: 31 },
                      { x: 'East', y: 18 },
                      { x: 'South', y: 22 },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          id: 'layout-card',
          props: { title: 'Capacity' },
          children: [
            {
              id: 'charts-gauge',
              props: { label: 'Fleet utilization', value: 78, min: 0, max: 100 },
            },
          ],
        },
      ],
    },
    {
      id: 'layout-card',
      props: { title: 'Open incidents' },
      children: [
        {
          id: 'blocks-data',
          props: {
            block: {
              type: 'table',
              caption: 'Open incidents',
              columns: [
                { id: 'ref', label: 'Reference' },
                { id: 'depot', label: 'Depot' },
                { id: 'hours', label: 'Hours open' },
              ],
              rows: [
                { ref: 'FL-201', depot: 'North', hours: 5 },
                { ref: 'FL-204', depot: 'South', hours: 3 },
                { ref: 'FL-207', depot: 'North', hours: 1 },
              ],
            },
          },
        },
      ],
    },
  ],
};
