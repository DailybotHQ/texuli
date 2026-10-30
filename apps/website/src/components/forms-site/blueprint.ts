/**
 * Forms as agent data on /forms-page/ (spec 0.8.0, ADR-015): a blueprint
 * whose `schema-form` node carries a whole form (steps, a condition as an
 * expression AST, named formats, a cross-field rule), and a hostile copy
 * that smuggles a regular expression in a `pattern` member, which the forms
 * validator refuses before anything paints. Fictional data only (Harbor,
 * example.com). Checked by apps/website/tests/site-forms.test.ts.
 */

/** The spec version that admits `schema-form` nodes. */
export const FORM_SPEC = '0.8.0';

/** The action the host receives with the submitted answers. */
export const FORM_ACTION = 'book-onboarding';

const CATALOG_PIN = '0'.repeat(64);

/** The form schema the agent wrote (conditions are expression ASTs, as agents send them). */
export const AGENT_FORM_SCHEMA = {
  title: 'Book an onboarding session',
  description: 'Harbor assistant drafted this form from the chat. Answers go to the host.',
  submitLabel: 'Book session',
  steps: [
    {
      id: 'contact',
      title: 'Contact',
      fields: [
        { name: 'name', type: 'text', label: 'Your name', required: true },
        { name: 'email', type: 'email', label: 'Work email', required: true },
        { name: 'phone', type: 'text', label: 'Phone', format: 'phone' },
      ],
    },
    {
      id: 'session',
      title: 'Session',
      fields: [
        {
          name: 'format',
          type: 'radio',
          label: 'Format',
          required: true,
          options: [
            { value: 'video', label: 'Video call' },
            { value: 'onsite', label: 'On site' },
          ],
        },
        {
          name: 'address',
          type: 'text',
          label: 'Office address',
          when: {
            show: {
              op: 'eq',
              left: { op: 'field', name: 'format' },
              right: { op: 'str', value: 'onsite' },
            },
            require: {
              op: 'eq',
              left: { op: 'field', name: 'format' },
              right: { op: 'str', value: 'onsite' },
            },
          },
        },
        { name: 'day', type: 'date', label: 'Preferred day', required: true, min: '2026-11-02' },
        { name: 'from', type: 'time', label: 'From', required: true },
        { name: 'to', type: 'time', label: 'To', required: true },
      ],
    },
  ],
  rules: [
    {
      id: 'window',
      field: 'to',
      message: 'The session must end after it starts.',
      test: { op: 'gt', left: { op: 'field', name: 'to' }, right: { op: 'field', name: 'from' } },
    },
  ],
};

/** A schema that tries to bring its own regular expression (catastrophic backtracking). */
export const HOSTILE_FORM_SCHEMA = {
  ...AGENT_FORM_SCHEMA,
  steps: [
    {
      id: 'contact',
      title: 'Contact',
      fields: [{ name: 'name', type: 'text', label: 'Your name', pattern: '^(a+)+$' }],
    },
  ],
};

export function formTree(schema: unknown): Record<string, unknown> {
  return {
    id: 'layout-page',
    props: { title: 'Onboarding' },
    children: [
      {
        id: 'schema-form',
        key: 'onboarding-form',
        props: { action: FORM_ACTION, schema },
      },
    ],
  };
}

export function formEnvelope(tree: unknown): Record<string, unknown> {
  return {
    format: 'texuli-blueprint',
    version: 1,
    spec: FORM_SPEC,
    id: 'onboarding-form',
    catalog: CATALOG_PIN,
    status: 'draft',
    createdAt: '2026-10-29T09:00:00Z',
    updatedAt: '2026-10-29T09:00:00Z',
    generator: { kind: 'agent', name: 'Harbor assistant', model: 'example-model' },
    tier: 'untrusted',
    profile: 'web',
    tree,
  };
}

export const AGENT_FORM_BLUEPRINT = formEnvelope(formTree(AGENT_FORM_SCHEMA));
export const HOSTILE_FORM_BLUEPRINT = formEnvelope(formTree(HOSTILE_FORM_SCHEMA));
export const AGENT_FORM_JSON = JSON.stringify(AGENT_FORM_BLUEPRINT, null, 2);
/** Only the hostile field, for the page (the rest is the same blueprint). */
export const HOSTILE_FIELD_JSON = JSON.stringify(
  { name: 'name', type: 'text', label: 'Your name', pattern: '^(a+)+$' },
  null,
  2
);
