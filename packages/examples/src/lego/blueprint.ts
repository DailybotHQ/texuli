/** The spec's lego golden (packages/spec/fixtures/golden/lego.json); the player lego test keeps them equal. */
export const legoBlueprint = {
  format: 'texuli-blueprint',
  version: 1,
  id: 'lego-launch-workspace',
  catalog: '6389ff8dfd63e2b2e7cf5986be9f82fd72a3256e9e86fe634d066bbcd640ddd2',
  status: 'draft',
  createdAt: '2026-10-27T09:00:00Z',
  updatedAt: '2026-10-27T09:00:00Z',
  generator: {
    kind: 'agent',
    name: 'Harbor assistant',
    model: 'example-model',
  },
  tier: 'untrusted',
  profile: 'web',
  asOf: '2026-10-26T23:59:00Z',
  sources: [
    {
      label: 'Harborline workspace',
      href: 'https://example.com/workspace',
    },
  ],
  trigger: {
    kind: 'request',
    label: 'Launch workspace requested in chat',
  },
  spec: '0.6.0',
  state: {
    deals: {
      type: 'list',
      maxItems: 50,
      initial: [
        {
          id: 'd-acme',
          title: 'Acme Rentals',
          column: 'lead',
          detail: '$42k',
        },
        {
          id: 'd-cedar',
          title: 'Cedar Clinics',
          column: 'lead',
          detail: '$67k',
        },
        {
          id: 'd-ember',
          title: 'Ember Foods',
          column: 'proposal',
          detail: '$23k',
        },
        {
          id: 'd-dune',
          title: 'Dune Logistics',
          column: 'won',
          detail: '$9.8k',
        },
      ],
    },
    palette: {
      type: 'list',
      maxItems: 8,
      initial: [
        {
          id: 'b-heading',
          label: 'Heading',
          detail: 'Text block',
        },
        {
          id: 'b-chart',
          label: 'Line chart',
          detail: 'Chart block',
        },
        {
          id: 'b-image',
          label: 'Image',
          detail: 'Media block',
        },
      ],
    },
    outline: {
      type: 'list',
      maxItems: 12,
      initial: [
        {
          id: 'o-intro',
          label: 'Introduction',
          detail: 'Text block',
        },
        {
          id: 'o-metrics',
          label: 'Launch metrics',
          detail: 'Data block',
        },
        {
          id: 'o-hero',
          label: 'Hero image',
          detail: 'Media block',
        },
      ],
    },
    launch: {
      type: 'workflow',
      initial: {
        version: 1,
        cycles: 'forbid',
        nodeTypes: [
          {
            id: 'trigger',
            label: 'Trigger',
            category: 'Start',
            ports: [
              {
                id: 'out',
                direction: 'out',
                multiple: true,
              },
            ],
          },
          {
            id: 'task',
            label: 'Task',
            category: 'Work',
            ports: [
              {
                id: 'in',
                direction: 'in',
                multiple: true,
              },
              {
                id: 'out',
                direction: 'out',
                multiple: true,
              },
            ],
          },
          {
            id: 'done',
            label: 'Done',
            category: 'Finish',
            ports: [
              {
                id: 'in',
                direction: 'in',
                multiple: true,
              },
            ],
          },
        ],
        nodes: [
          {
            id: 'kickoff',
            type: 'trigger',
            label: 'Kickoff',
            position: {
              x: 0,
              y: 0,
            },
          },
          {
            id: 'copy',
            type: 'task',
            label: 'Write launch copy',
            position: {
              x: 260,
              y: 0,
            },
          },
          {
            id: 'live',
            type: 'done',
            label: 'Live',
            position: {
              x: 520,
              y: 0,
            },
          },
        ],
        edges: [
          {
            id: 'l1',
            from: {
              node: 'kickoff',
              port: 'out',
            },
            to: {
              node: 'copy',
              port: 'in',
            },
          },
          {
            id: 'l2',
            from: {
              node: 'copy',
              port: 'out',
            },
            to: {
              node: 'live',
              port: 'in',
            },
          },
        ],
      },
    },
  },
  tree: {
    id: 'layout-page',
    props: {
      title: 'Launch workspace',
      description: 'Board, charts, media, blocks, an outline and a workflow, from one JSON tree.',
    },
    children: [
      {
        id: 'blocks-data',
        props: {
          block: {
            type: 'kpi',
            items: [
              {
                label: 'Open pipeline',
                value: '$141k',
                delta: '+12%',
                tone: 'success',
              },
              {
                label: 'Launch tasks',
                value: '24',
                delta: '-6',
                tone: 'success',
              },
              {
                label: 'Days to launch',
                value: '9',
                tone: 'neutral',
              },
            ],
          },
        },
      },
      {
        id: 'layout-grid',
        props: {
          columns: 3,
        },
        children: [
          {
            id: 'layout-tile',
            props: {
              title: 'Pipeline board',
              span: 2,
            },
            children: [
              {
                id: 'data-board',
                props: {
                  label: 'Pipeline board',
                  density: 'compact',
                  columns: [
                    {
                      id: 'lead',
                      title: 'Lead',
                    },
                    {
                      id: 'proposal',
                      title: 'Proposal',
                      wipSoft: 3,
                    },
                    {
                      id: 'won',
                      title: 'Won',
                    },
                  ],
                },
                bind: {
                  items: {
                    $state: 'deals',
                  },
                },
                on: {
                  move: [
                    {
                      op: 'emit',
                      intent: 'deal-moved',
                      values: {
                        board: 'pipeline',
                      },
                    },
                  ],
                },
              },
            ],
          },
          {
            id: 'layout-stack',
            props: {
              gap: 'medium',
            },
            children: [
              {
                id: 'layout-card',
                props: {
                  title: 'Pipeline trend',
                },
                children: [
                  {
                    id: 'charts-sparkline',
                    props: {
                      label: 'Open pipeline, last 8 weeks',
                      values: [88, 94, 101, 97, 112, 120, 133, 141],
                      variant: 'area',
                      showLast: true,
                    },
                  },
                  {
                    id: 'charts-donut',
                    props: {
                      title: 'Deals by stage',
                      description: 'Open deals per stage',
                      data: [
                        {
                          id: 'lead',
                          label: 'Lead',
                          value: 2,
                        },
                        {
                          id: 'proposal',
                          label: 'Proposal',
                          value: 1,
                        },
                        {
                          id: 'won',
                          label: 'Won',
                          value: 1,
                        },
                      ],
                      labels: {
                        table: 'Data table',
                        category: 'Stage',
                        value: 'Deals',
                      },
                    },
                  },
                ],
              },
              {
                id: 'layout-card',
                props: {
                  title: 'Launch visual',
                },
                children: [
                  {
                    id: 'media-image',
                    props: {
                      src: 'https://example.com/images/launch-hero.jpg',
                      alt: 'A product dashboard on a laptop screen',
                      width: 1200,
                      height: 675,
                      fit: 'cover',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'layout-split',
        props: {
          ratio: '1:2',
          gap: 'medium',
        },
        children: [
          {
            id: 'layout-card',
            props: {
              title: 'Block palette',
            },
            children: [
              {
                id: 'sortable-list',
                props: {
                  label: 'Block palette',
                  itemLabel: 'label',
                  itemDetail: 'detail',
                  reorder: {
                    bind: {
                      $state: 'palette',
                    },
                    group: 'blocks',
                    pull: 'clone',
                  },
                },
              },
            ],
          },
          {
            id: 'layout-card',
            props: {
              title: 'Page outline',
            },
            children: [
              {
                id: 'sortable-list',
                props: {
                  label: 'Page outline',
                  itemLabel: 'label',
                  itemDetail: 'detail',
                  reorder: {
                    bind: {
                      $state: 'outline',
                    },
                    group: 'outline',
                    accepts: ['blocks'],
                  },
                },
                on: {
                  move: [
                    {
                      op: 'emit',
                      intent: 'outline-changed',
                      values: {
                        page: 'launch',
                      },
                    },
                  ],
                },
              },
              {
                id: 'blocks-text',
                props: {
                  block: {
                    type: 'heading',
                    level: 2,
                    text: 'Introduction',
                  },
                },
              },
              {
                id: 'blocks-text',
                props: {
                  block: {
                    type: 'text',
                    markdown: 'The fictional Harborline workspace launches on **November 5**.',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        id: 'layout-card',
        props: {
          title: 'Launch workflow',
        },
        children: [
          {
            id: 'workflow-graph',
            props: {
              label: 'Launch workflow editor',
              mode: 'edit',
              flow: 'LR',
            },
            bind: {
              graph: {
                $state: 'launch',
              },
            },
            on: {
              change: [
                {
                  op: 'emit',
                  intent: 'workflow-changed',
                },
              ],
            },
          },
        ],
      },
    ],
  },
};
