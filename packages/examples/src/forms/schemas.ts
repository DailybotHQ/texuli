import type { FormSchema } from '@texuli/forms/model';

/** Fictional data only. */
export const REGISTRATION_SCHEMA: FormSchema = {
  title: 'Community day registration',
  description: 'Register for the example.com community day. Fields marked * are required.',
  submitLabel: 'Register',
  steps: [
    {
      id: 'about',
      title: 'About you',
      fields: [
        { name: 'name', type: 'text', label: 'Full name', required: true, autocomplete: 'name' },
        { name: 'email', type: 'email', label: 'Email', required: true, autocomplete: 'email' },
        { name: 'age', type: 'number', label: 'Age', min: 13, max: 120, step: 1 },
        {
          name: 'guardian',
          type: 'text',
          label: 'Guardian name',
          description: 'Attendees under 18 come with a guardian.',
          when: {
            show: { op: 'lt', left: { op: 'field', name: 'age' }, right: { op: 'num', value: 18 } },
            require: {
              op: 'lt',
              left: { op: 'field', name: 'age' },
              right: { op: 'num', value: 18 },
            },
          },
        },
      ],
    },
    {
      id: 'attendance',
      title: 'Attendance',
      sections: [
        {
          id: 'dates',
          title: 'Dates',
          fields: [
            {
              name: 'arrival',
              type: 'date',
              label: 'Arrival',
              required: true,
              min: '2026-11-01',
              max: '2026-11-30',
            },
            { name: 'departure', type: 'date', label: 'Departure', required: true },
          ],
        },
        {
          id: 'sessions',
          title: 'Sessions',
          fields: [
            {
              name: 'track',
              type: 'radio',
              label: 'Track',
              required: true,
              options: [
                { value: 'design', label: 'Design' },
                { value: 'engineering', label: 'Engineering' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'extras',
      title: 'Extras',
      when: { show: { op: 'neq', left: { op: 'field', name: 'track' }, right: { op: 'null' } } },
      fields: [
        { name: 'newsletter', type: 'switch', label: 'Send me the newsletter' },
        { name: 'terms', type: 'checkbox', label: 'I accept the code of conduct', required: true },
      ],
    },
  ],
  rules: [
    {
      id: 'dates',
      field: 'departure',
      message: 'Departure must be on or after arrival.',
      test: {
        op: 'gte',
        left: { op: 'field', name: 'departure' },
        right: { op: 'field', name: 'arrival' },
      },
    },
  ],
};

const OPTIONS = [
  { value: 'harbor', label: 'Harbor Notes' },
  { value: 'lumen', label: 'Lumen Atlas' },
  { value: 'quill', label: 'Quill & Pine' },
];

export const FIELDS_SCHEMA: FormSchema = {
  title: 'Every field type',
  description: 'Each field is a texuli control named by its label.',
  submitLabel: 'Save',
  sections: [
    {
      id: 'text',
      title: 'Text',
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Project title',
          placeholder: 'Harbor Notes',
          required: true,
        },
        {
          name: 'summary',
          type: 'textarea',
          label: 'Summary',
          rows: 3,
          maxLength: 280,
          description: 'At most 280 characters.',
        },
        { name: 'contact', type: 'email', label: 'Contact email' },
        { name: 'site', type: 'url', label: 'Website', placeholder: 'https://example.com' },
        { name: 'seats', type: 'number', label: 'Seats', min: 1, max: 50 },
        { name: 'labels', type: 'tags', label: 'Labels', maxItems: 5 },
      ],
    },
    {
      id: 'choices',
      title: 'Choices',
      fields: [
        { name: 'workspace', type: 'select', label: 'Workspace', options: OPTIONS },
        { name: 'shared', type: 'multiselect', label: 'Shared with', options: OPTIONS },
        {
          name: 'plan',
          type: 'radio',
          label: 'Plan',
          options: [
            { value: 'free', label: 'Free' },
            { value: 'team', label: 'Team' },
          ],
        },
        { name: 'public', type: 'switch', label: 'Public project' },
        { name: 'agree', type: 'checkbox', label: 'Notify members' },
        { name: 'priority', type: 'slider', label: 'Priority', min: 0, max: 10, step: 1 },
      ],
    },
    {
      id: 'when',
      title: 'Schedule and files',
      fields: [
        { name: 'start', type: 'date', label: 'Start date' },
        { name: 'standup', type: 'time', label: 'Stand-up time' },
        {
          name: 'brief',
          type: 'file',
          label: 'Brief',
          accept: ['.pdf', 'image/*'],
          maxItems: 1,
          maxSize: 5_000_000,
        },
      ],
    },
  ],
};
