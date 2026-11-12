/**
 * Fictional blueprints the demo agent attaches (example.com data, untrusted tier). The
 * attachment card validates each one with the catalog validator before the player paints it;
 * `REFUSED_BLUEPRINT` names a component the catalog does not have, so it is refused.
 */

/** Support triage: the overnight queue at a glance. */
export const TRIAGE_BLUEPRINT = {
  id: 'layout-doc',
  props: { title: 'Overnight queue' },
  children: [
    {
      id: 'blocks-data',
      props: {
        block: {
          type: 'kpi',
          items: [
            { label: 'Open', value: '18', delta: '+4', tone: 'warning' },
            { label: 'Urgent', value: '3', delta: '+2', tone: 'danger' },
            { label: 'Waiting on customer', value: '6', delta: '-1', tone: 'success' },
          ],
        },
      },
    },
    {
      id: 'blocks-text',
      props: {
        block: {
          type: 'text',
          markdown:
            '- **Billing**: 2 urgent refunds for example.com accounts\n- **Login**: 1 urgent lockout after a password reset\n- **Shipping**: 6 questions about delivery windows',
        },
      },
    },
  ],
};

/** A weekly report built from a request. */
export const REPORT_BLUEPRINT = {
  id: 'layout-page',
  props: {
    title: 'Support weekly report',
    description: 'Fictional support metrics for the week of the example.com launch.',
  },
  children: [
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
      id: 'charts-bar',
      props: {
        title: 'Conversations per day',
        description: 'Fictional conversations per weekday, highest on Tuesday.',
        series: [
          {
            id: 'conversations',
            label: 'Conversations',
            points: [
              { x: 'Mon', y: 71 },
              { x: 'Tue', y: 94 },
              { x: 'Wed', y: 83 },
              { x: 'Thu', y: 88 },
              { x: 'Fri', y: 76 },
            ],
          },
        ],
      },
    },
  ],
};

/**
 * A form generated from a request. Its fields write to declared local state, so it ships in
 * the player's local-state wrapper (`texuli-local-state`), which names each state variable.
 */
export const FORM_BLUEPRINT = {
  format: 'texuli-local-state',
  version: 1,
  state: { name: { type: 'string' }, email: { type: 'string' } },
  blueprint: {
    id: 'layout-doc',
    props: { title: 'Workshop sign-up' },
    children: [
      {
        id: 'action-form',
        props: { label: 'Workshop sign-up', action: 'signup' },
        children: [
          {
            id: 'form-field',
            props: {
              name: 'name',
              state: 'name',
              label: 'Your name',
              kind: 'text',
              required: true,
            },
          },
          {
            id: 'form-field',
            props: {
              name: 'email',
              state: 'email',
              label: 'Email address',
              kind: 'email',
              required: true,
            },
          },
          { id: 'form-submit', props: { label: 'Reserve a seat' } },
        ],
      },
    ],
  },
};

/** An attachment with a component outside the catalog: validation refuses it. */
export const REFUSED_BLUEPRINT = {
  id: 'layout-doc',
  props: { title: 'Revenue forecast' },
  children: [{ id: 'forecast-widget', props: { label: 'Next quarter' } }],
};
