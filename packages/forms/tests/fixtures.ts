import { type CompiledForm, type FormSchema, validateFormSchema } from '../src/model/index.ts';

/** A three-step registration with sections, conditions and a cross-field rule (fictional data). */
export const REGISTRATION: FormSchema = {
  title: 'Event registration',
  description: 'Register for the example.com community day.',
  submitLabel: 'Register',
  steps: [
    {
      id: 'about',
      title: 'About you',
      fields: [
        {
          name: 'name',
          type: 'text',
          label: 'Full name',
          required: true,
          maxLength: 80,
          autocomplete: 'name',
        },
        { name: 'email', type: 'email', label: 'Email', required: true, autocomplete: 'email' },
        { name: 'age', type: 'number', label: 'Age', min: 13, max: 120, step: 1 },
        {
          name: 'guardian',
          type: 'text',
          label: 'Guardian name',
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
          id: 'when',
          title: 'When',
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
            { name: 'time', type: 'time', label: 'Arrival time' },
          ],
        },
        {
          id: 'what',
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
            {
              name: 'workshops',
              type: 'multiselect',
              label: 'Workshops',
              maxItems: 2,
              options: [
                { value: 'a11y', label: 'Accessibility' },
                { value: 'motion', label: 'Motion' },
                { value: 'forms', label: 'Forms' },
              ],
            },
            {
              name: 'diet',
              type: 'select',
              label: 'Diet',
              options: [
                { value: 'none', label: 'No preference' },
                { value: 'veg', label: 'Vegetarian' },
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
        {
          name: 'topics',
          type: 'tags',
          label: 'Topics',
          maxItems: 5,
          maxLength: 24,
          when: { enable: { op: 'field', name: 'newsletter' } },
        },
        { name: 'level', type: 'slider', label: 'Experience', min: 0, max: 10, step: 1 },
        { name: 'notes', type: 'textarea', label: 'Notes', rows: 3, maxLength: 500 },
        {
          name: 'site',
          type: 'url',
          label: 'Website',
          link: { label: 'Why we ask', href: 'https://example.com/privacy' },
        },
        {
          name: 'badge',
          type: 'file',
          label: 'Badge photo',
          accept: ['image/*'],
          maxSize: 2_000_000,
          maxItems: 1,
        },
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

export function compiled(schema: unknown = REGISTRATION): CompiledForm {
  const result = validateFormSchema(schema);
  if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
  return result.form;
}

/** A one-page form. */
export const CONTACT: FormSchema = {
  title: 'Contact us',
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true },
    {
      name: 'topic',
      type: 'select',
      label: 'Topic',
      options: [
        { value: 'sales', label: 'Sales' },
        { value: 'help', label: 'Help' },
      ],
    },
    { name: 'message', type: 'textarea', label: 'Message', required: true, minLength: 10 },
  ],
};
