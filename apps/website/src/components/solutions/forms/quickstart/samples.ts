import type { SolutionEntry } from '../../../../data/solutions/schema.ts';
import type { SolutionQuickstartProps } from '../../shared/types.ts';

export const FORMS_QUICKSTART_VERIFIED_BY = 'tests/e2e/site-solution-forms.spec.ts';

export const FORMS_SCHEMA_SAMPLE = `import { validateFormSchema } from '@texuli/forms/model';

const result = validateFormSchema({
  title: 'Contact example.com',
  fields: [
    { name: 'email', type: 'email', label: 'Email address', required: true },
  ],
});

if (result.ok) {
  console.log(result.form.schema.title);
} else {
  console.error(result.issues);
}`;

export const FORMS_DRAFTS_SAMPLE = `import { createMemoryDrafts } from '@texuli/forms/model';
import { SchemaForm } from '@texuli/forms';

const drafts = { storage: createMemoryDrafts(), key: 'intake-preview' };
// Pass {form, drafts} to SchemaForm. Your app can supply another storage adapter.`;

export function formsQuickstart(entry: SolutionEntry): SolutionQuickstartProps {
  return {
    entry,
    title: 'Start with a form schema',
    install: { label: 'Install', language: 'bash', code: 'pnpm add @texuli/forms@0.17.4' },
    samples: [
      { label: 'Validate a schema', language: 'ts', code: FORMS_SCHEMA_SAMPLE },
      { label: 'Keep a local draft', language: 'ts', code: FORMS_DRAFTS_SAMPLE },
    ],
    verifiedBy: FORMS_QUICKSTART_VERIFIED_BY,
  };
}
