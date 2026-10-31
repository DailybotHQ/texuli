/**
 * The form schemas of /forms-page/, all plain `@texuli/forms` data that the
 * islands validate with `validateFormSchema` before they paint:
 *
 * - `FIELDS_SCHEMA`: one field per `FORM_FIELD_TYPES` entry, built from a
 *   record keyed by `FormFieldType`, so a new field type fails the type
 *   check until the gallery shows it;
 * - `VALIDATION_SCHEMA`: every closed rule, a host validator and a
 *   cross-field rule (`RULE_COVERAGE` maps each `FORM_RULE_NAMES` entry to
 *   the field that shows it);
 * - `FLOW_SCHEMA`: a multi-step flow whose fields, sections and a whole
 *   step appear, become required or become editable from earlier answers;
 * - `DRAFT_SCHEMA`: a short form with drafts and autosave.
 *
 * Conditions are written in the text form of the expression language and
 * parsed once here (`parseExpressionText` from `@texuli/core/expression`),
 * so the page shows the same text the schema holds as data. Fictional data
 * only (example.com). Checked by apps/website/tests/site-forms.test.ts.
 */
import {
  type ExpressionNode,
  formatExpression,
  parseExpressionText,
} from '@texuli/core/expression';
import {
  FORM_FIELD_TYPES,
  type FormField,
  type FormFieldType,
  type FormRuleName,
  type FormSchema,
} from '@texuli/forms/model';

/** Parses a condition in the expression language's text form; a typo fails the build. */
export function condition(text: string): ExpressionNode {
  const parsed = parseExpressionText(text);
  if (!parsed.ok) throw new Error(`Invalid condition: ${text}`);
  return parsed.expression.ast;
}

/** The text form of a condition, as the page shows it. */
export function conditionText(node: ExpressionNode | undefined): string {
  return node ? formatExpression(node) : '';
}

const PROJECTS = [
  { value: 'harbor', label: 'Harbor Notes' },
  { value: 'lumen', label: 'Lumen Atlas' },
  { value: 'quill', label: 'Quill & Pine' },
];

export type FieldGroup = 'text' | 'choice' | 'time';

export const FIELD_GROUPS: readonly { readonly id: FieldGroup; readonly title: string }[] = [
  { id: 'text', title: 'Text and numbers' },
  { id: 'choice', title: 'Choices and toggles' },
  { id: 'time', title: 'Dates, times and files' },
];

export interface FieldSample {
  readonly group: FieldGroup;
  /** The texuli control that paints it. */
  readonly control: string;
  readonly field: FormField;
}

/** The custom field kind the gallery paints itself (a people picker). */
export const GALLERY_KIND = 'person';

/**
 * How the gallery validates its schema: at the default (untrusted) tier,
 * opting in to credential fields and to the custom kind it paints, as a host
 * would for agent output.
 */
export const GALLERY_OPTIONS = { credentials: true, kinds: [GALLERY_KIND] } as const;

/** One sample field per type. Keyed by `FormFieldType`: the compiler checks it is exhaustive. */
export const FIELD_SAMPLES: Readonly<Record<FormFieldType, FieldSample>> = {
  text: {
    group: 'text',
    control: 'Input',
    field: {
      // Not `title`, `description` or `summary`: SchemaForm uses those ids itself (reported).
      name: 'projectTitle',
      type: 'text',
      label: 'Project title',
      placeholder: 'Harbor Notes',
      description: 'A single line of text.',
      autocomplete: 'off',
    },
  },
  textarea: {
    group: 'text',
    control: 'Textarea',
    field: {
      name: 'projectSummary',
      type: 'textarea',
      label: 'Summary',
      rows: 3,
      maxLength: 280,
      description: 'Several lines, at most 280 characters.',
    },
  },
  number: {
    group: 'text',
    control: 'Input (number)',
    field: { name: 'seats', type: 'number', label: 'Seats', min: 1, max: 50, step: 1 },
  },
  email: {
    group: 'text',
    control: 'Input (email)',
    field: { name: 'contact', type: 'email', label: 'Contact email', autocomplete: 'email' },
  },
  url: {
    group: 'text',
    control: 'Input (url)',
    field: {
      name: 'site',
      type: 'url',
      label: 'Website',
      placeholder: 'https://example.com',
      description: 'https and http here (protocols); the URL policy checks both.',
      protocols: ['http', 'https'],
    },
  },
  password: {
    group: 'text',
    control: 'Input (password) with a reveal toggle',
    field: {
      name: 'deployPassword',
      type: 'password',
      label: 'Deploy password',
      autocomplete: 'new-password',
      minLength: 12,
      description: 'At least 12 characters. Never saved in drafts; masked in summaries.',
    },
  },
  otp: {
    group: 'text',
    control: 'Input (one-time code)',
    field: {
      name: 'verification',
      type: 'otp',
      label: 'Verification code',
      length: 6,
      description: 'Six digits; one input with autocomplete="one-time-code".',
    },
  },
  tags: {
    group: 'text',
    control: 'TagsInput',
    field: {
      name: 'labels',
      type: 'tags',
      label: 'Labels',
      maxItems: 5,
      description: 'Type a label and press Enter. At most five.',
    },
  },
  select: {
    group: 'choice',
    control: 'Select',
    field: { name: 'workspace', type: 'select', label: 'Workspace', options: PROJECTS },
  },
  multiselect: {
    group: 'choice',
    control: 'Checkbox group',
    field: { name: 'shared', type: 'multiselect', label: 'Shared with', options: PROJECTS },
  },
  radio: {
    group: 'choice',
    control: 'RadioGroup',
    field: {
      name: 'plan',
      type: 'radio',
      label: 'Plan',
      options: [
        { value: 'free', label: 'Free', description: 'Up to five people' },
        { value: 'team', label: 'Team', description: 'Unlimited people' },
      ],
    },
  },
  checkbox: {
    group: 'choice',
    control: 'Checkbox',
    field: { name: 'notify', type: 'checkbox', label: 'Notify members' },
  },
  switch: {
    group: 'choice',
    control: 'Switch',
    field: { name: 'public', type: 'switch', label: 'Public project' },
  },
  color: {
    group: 'choice',
    control: 'ColorPicker',
    field: { name: 'accent', type: 'color', label: 'Accent color' },
  },
  custom: {
    group: 'choice',
    control: 'Painted by the page (a field snippet)',
    field: {
      name: 'owner',
      type: 'custom',
      kind: GALLERY_KIND,
      label: 'Owner',
      config: { directory: 'team' },
      description: 'A host-painted field: validated, summarized and submitted with the rest.',
    },
  },
  slider: {
    group: 'choice',
    control: 'Slider',
    field: { name: 'priority', type: 'slider', label: 'Priority', min: 0, max: 10, step: 1 },
  },
  date: {
    group: 'time',
    control: 'DatePicker',
    field: { name: 'start', type: 'date', label: 'Start date', min: '2026-01-01' },
  },
  time: {
    group: 'time',
    control: 'TimeField',
    field: { name: 'standup', type: 'time', label: 'Stand-up time' },
  },
  datetime: {
    group: 'time',
    control: 'DatePicker + TimeField',
    field: { name: 'kickoff', type: 'datetime', label: 'Kickoff', min: '2026-01-01T09:00' },
  },
  file: {
    group: 'time',
    control: 'FileUpload',
    field: {
      name: 'brief',
      type: 'file',
      label: 'Brief',
      accept: ['.pdf', 'image/*'],
      maxItems: 1,
      maxSize: 5_000_000,
      description: 'A PDF or an image up to 5 MB. Nothing is uploaded: the host would.',
    },
  },
};

/** The gallery rows in `FORM_FIELD_TYPES` order. */
export const FIELD_ROWS = FORM_FIELD_TYPES.map((type) => ({ type, ...FIELD_SAMPLES[type] }));

export const FIELDS_SCHEMA: FormSchema = {
  title: 'Every field type',
  description: `${FORM_FIELD_TYPES.length} field types, each painted by a texuli control and named by its label.`,
  submitLabel: 'Save project',
  sections: FIELD_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    fields: FIELD_ROWS.filter((row) => row.group === group.id).map((row) => row.field),
  })),
};

/** Starting values for the gallery, so the choices show something. */
export const FIELDS_VALUES = {
  projectTitle: 'Harbor Notes',
  workspace: 'lumen',
  shared: ['harbor'],
  plan: 'team',
  priority: 6,
  labels: ['launch'],
  public: true,
};

/** The host validator's name in the validation demo. */
export const HANDLE_VALIDATOR = 'handle-available';

/** Handles the fictional host says are taken. */
export const TAKEN_HANDLES: readonly string[] = ['harbor', 'admin', 'lumen-atlas'];

export const VALIDATION_SCHEMA: FormSchema = {
  title: 'Create a workspace',
  description: 'Submit it empty first: an error summary takes focus and links to each answer.',
  submitLabel: 'Create workspace',
  sections: [
    {
      id: 'identity',
      title: 'Identity',
      fields: [
        {
          name: 'handle',
          type: 'text',
          label: 'Workspace handle',
          description: 'Lowercase words joined by hyphens, 3 to 20 characters. Try harbor.',
          required: true,
          minLength: 3,
          maxLength: 20,
          format: 'slug',
          validator: HANDLE_VALIDATOR,
        },
        {
          name: 'owner',
          type: 'email',
          label: 'Owner email',
          required: true,
          messages: { required: 'Every workspace needs an owner.' },
        },
        {
          name: 'accent',
          type: 'text',
          label: 'Accent color',
          format: 'hex-color',
          placeholder: '#0ea5e9',
        },
        { name: 'zip', type: 'text', label: 'Billing ZIP code', format: 'postal-code-us' },
      ],
    },
    {
      id: 'capacity',
      title: 'Capacity',
      fields: [
        {
          name: 'seats',
          type: 'number',
          label: 'Seats',
          description: 'Sold in fives, from 5 to 100.',
          required: true,
          min: 5,
          max: 100,
          step: 5,
        },
        {
          name: 'topics',
          type: 'multiselect',
          label: 'Topics',
          description: 'Pick one to three.',
          minItems: 1,
          maxItems: 3,
          options: [
            { value: 'design', label: 'Design' },
            { value: 'engineering', label: 'Engineering' },
            { value: 'support', label: 'Support' },
            { value: 'sales', label: 'Sales' },
          ],
        },
        {
          name: 'labels',
          type: 'tags',
          label: 'Labels',
          description: 'Up to four labels, each 2 to 12 characters.',
          maxItems: 4,
          minLength: 2,
          maxLength: 12,
        },
        {
          name: 'logo',
          type: 'file',
          label: 'Logo',
          description: 'A PNG or SVG up to 200 KB.',
          accept: ['image/png', '.svg'],
          maxItems: 1,
          maxSize: 200_000,
        },
      ],
    },
    {
      id: 'dates',
      title: 'Trial',
      fields: [
        {
          name: 'trialStart',
          type: 'date',
          label: 'Trial starts',
          required: true,
          min: '2026-01-01',
        },
        { name: 'trialEnd', type: 'date', label: 'Trial ends', required: true },
      ],
    },
  ],
  rules: [
    {
      id: 'trial-order',
      field: 'trialEnd',
      message: 'The trial must end after it starts.',
      test: condition('trialEnd > trialStart'),
    },
  ],
};

export interface RuleCoverage {
  readonly rule: FormRuleName;
  readonly where: string;
}

/** Each closed rule and where the validation demo shows it. Keyed by `FormRuleName`: exhaustive. */
const COVERAGE: Readonly<Record<FormRuleName, string>> = {
  required: 'Workspace handle, Owner email, Seats and both trial dates (they start filled in)',
  minLength: 'Workspace handle (3), each label (2)',
  maxLength: 'Workspace handle (20), each label (12)',
  min: 'Seats (5), Trial starts (2026-01-01)',
  max: 'Seats (100)',
  step: 'Seats (in fives)',
  format: 'Workspace handle (slug), Owner email, Accent color (hex-color), Billing ZIP code',
  minItems: 'Topics (1)',
  maxItems: 'Topics (3), Labels (4), Logo (1)',
  option:
    'A value outside the choices: refused when a draft or a host restores it (try the tampered draft below)',
  fileType: 'Logo (PNG or SVG)',
  fileSize: 'Logo (200 KB)',
};

export const RULE_COVERAGE: readonly RuleCoverage[] = (Object.keys(COVERAGE) as FormRuleName[]).map(
  (rule) => ({ rule, where: COVERAGE[rule] })
);

export const FLOW_SCHEMA: FormSchema = {
  title: 'Request a pilot workspace',
  description: 'Fields, a section and a whole step appear from your answers.',
  submitLabel: 'Send request',
  steps: [
    {
      id: 'you',
      title: 'About you',
      fields: [
        { name: 'name', type: 'text', label: 'Full name', required: true, autocomplete: 'name' },
        {
          name: 'email',
          type: 'email',
          label: 'Work email',
          required: true,
          autocomplete: 'email',
        },
        {
          name: 'role',
          type: 'radio',
          label: 'Role',
          required: true,
          options: [
            { value: 'engineer', label: 'Engineer' },
            { value: 'designer', label: 'Designer' },
            { value: 'manager', label: 'Manager' },
            { value: 'other', label: 'Something else' },
          ],
        },
        {
          name: 'roleOther',
          type: 'text',
          label: 'Your role',
          description: 'Shown and required when you pick Something else.',
          when: { show: condition('role == "other"'), require: condition('role == "other"') },
        },
      ],
    },
    {
      id: 'team',
      title: 'Your team',
      sections: [
        {
          id: 'size',
          title: 'Size and plan',
          fields: [
            {
              name: 'people',
              type: 'number',
              label: 'People on the team',
              required: true,
              min: 1,
              max: 500,
            },
            {
              name: 'plan',
              type: 'select',
              label: 'Plan',
              required: true,
              options: [
                { value: 'free', label: 'Free' },
                { value: 'team', label: 'Team' },
                { value: 'enterprise', label: 'Enterprise' },
              ],
            },
          ],
        },
        {
          id: 'enterprise',
          title: 'Enterprise options',
          when: { show: condition('plan == "enterprise"') },
          fields: [
            { name: 'sso', type: 'switch', label: 'Single sign-on' },
            {
              name: 'ssoDomain',
              type: 'text',
              label: 'Sign-on domain',
              placeholder: 'example.com',
              description: 'Editable once single sign-on is on, and then required.',
              when: { enable: condition('sso'), require: condition('sso') },
            },
          ],
        },
      ],
    },
    {
      id: 'review',
      title: 'Security review',
      description: 'Only for teams of more than 50 people.',
      when: { show: condition('people > 50') },
      fields: [
        { name: 'securityContact', type: 'email', label: 'Security contact', required: true },
        { name: 'review', type: 'date', label: 'Preferred review date', min: '2026-01-01' },
      ],
    },
    {
      id: 'confirm',
      title: 'Confirm',
      fields: [
        { name: 'newsletter', type: 'switch', label: 'Send me the pilot newsletter' },
        { name: 'terms', type: 'checkbox', label: 'I accept the pilot terms', required: true },
      ],
    },
  ],
  rules: [
    {
      id: 'free-size',
      field: 'people',
      message: 'The free plan covers up to five people.',
      test: condition('plan != "free" or people <= 5'),
    },
  ],
};

export const DRAFT_SCHEMA: FormSchema = {
  title: 'Launch feedback',
  description: 'Type anything: the draft saves itself. Then remount the form.',
  submitLabel: 'Send feedback',
  fields: [
    { name: 'headline', type: 'text', label: 'Headline', required: true, maxLength: 80 },
    {
      name: 'mood',
      type: 'radio',
      label: 'How did the launch go?',
      options: [
        { value: 'great', label: 'Great' },
        { value: 'fine', label: 'Fine' },
        { value: 'rough', label: 'Rough' },
      ],
    },
    { name: 'score', type: 'slider', label: 'Score', min: 0, max: 10, step: 1, default: 7 },
    { name: 'details', type: 'textarea', label: 'Details', rows: 4, maxLength: 1000 },
  ],
};

/** The draft storage key the demo uses. */
export const DRAFT_KEY = 'forms-page-feedback';

/**
 * A tampered draft, as a hostile extension or an old version could leave
 * it: a value of the wrong type, a choice outside the options, a field the
 * form does not have and an over-long text. Restoring coerces it field by
 * field.
 */
export const TAMPERED_DRAFT = {
  format: 'texuli-form-draft',
  version: 1,
  step: 0,
  savedAt: 1_793_000_000_000,
  values: {
    headline: 'Restored from a tampered draft',
    mood: 'furious',
    score: 'eleven',
    isAdmin: true,
    details: 'x'.repeat(1200),
  },
};
