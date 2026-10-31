/**
 * Catalog manifest for forms as data (spec 0.8.0, ADR-015): one
 * `schema-form` id whose `schema` prop carries a closed form schema
 * (`@texuli/forms/model`): typed fields, sections, steps, conditions as
 * expression ASTs over earlier fields, named formats and cross-field
 * rules. Agents never send regular expressions or code. `validateDraft`
 * checks the schema with the forms validator at the host's tier, and the
 * player paints it with `@texuli/forms`; submitting proposes the `action`
 * intent to the host with the submitted values, like `action-form`.
 * Build-time only; a subpath group the catalog root does not re-export.
 */
import { manifestData } from '../../manifest/data.ts';
import type { CatalogManifest } from '../../manifest/types.ts';
import type { GrammarComponentMeta } from '../../render/grammar/types.ts';

/** The catalog id of a schema-driven form (spec 0.8.0). */
export const SCHEMA_FORM_CATALOG_ID = 'schema-form' as const;

export const schemaFormManifest: CatalogManifest = /* @__PURE__ */ manifestData({
  id: SCHEMA_FORM_CATALOG_ID,
  package: '@texuli/forms',
  label: 'Schema form',
  summary:
    'A whole form as data: typed fields in sections or steps, conditional logic, named formats and cross-field rules, painted with texuli controls; submitting proposes one action intent to the host.',
  tier: 'content',
  agentEmittable: true,
  useWhen: [
    'Collect structured answers: registrations, requests, surveys, intake and settings',
    'A multi-step flow with per-step validation, or fields that appear, become required or become editable from earlier answers',
  ],
  dontUseWhen: [
    'One or two values for an action: use action-form with form-field',
    'Payment: use a host-region. Password and one-time-code (otp) fields only where the host allows credential fields',
    'A filter bar over data: use control-filter or data-filter-builder',
  ],
  a11y: [
    'A form landmark named by its title; every control is a texuli control with a visible label, its description and its error linked',
    'Errors are announced, an error summary takes focus and links to each field; each new step heading takes focus and is announced',
    'Keyboard-complete: native order, Enter moves to the next step or submits; reduced motion makes step transitions instant',
  ],
  props: [
    {
      name: 'schema',
      kind: 'object',
      required: true,
      description:
        'The form: { title, description?, submitLabel?, fields | sections | steps, rules? }. Field types: text, textarea, number, email, url (protocols: ["https"] by default, ["http", "https"] to allow http), date, time, datetime (YYYY-MM-DDTHH:MM), select (clearable: an empty choice, on by default while optional), multiselect, checkbox, radio, switch, slider, file (host-handled), tags, color (#hex), password and otp (credential fields, refused unless the host allows them), and custom (painted by the host: kind must be a kind the host registered, config holds scalar settings). Rules: required, minLength, maxLength, min, max, step, minItems, maxItems, a named format (email, url, phone, postal-code…, never a pattern) and validator (a name the host registered). when.show / require / enable are expressions over earlier fields; rules[] are cross-field expressions that fail when false.',
      schema: { $ref: '#/$defs/formSchema' },
    },
    {
      name: 'action',
      kind: 'string',
      required: true,
      description: 'The action name the host receives with the submitted values.',
    },
    {
      name: 'label',
      kind: 'string',
      trust: 'untrusted',
      description: 'Accessible name; defaults to the form title.',
    },
  ],
  events: ['submit'],
  examples: [
    {
      id: 'request',
      title: 'Access request',
      props: {
        action: 'request-access',
        schema: {
          title: 'Request access',
          submitLabel: 'Send request',
          fields: [
            { name: 'email', type: 'email', label: 'Work email', required: true },
            {
              name: 'team',
              type: 'select',
              label: 'Team',
              required: true,
              options: [
                { value: 'design', label: 'Design' },
                { value: 'engineering', label: 'Engineering' },
              ],
            },
            {
              name: 'reason',
              type: 'textarea',
              label: 'Why do you need access?',
              maxLength: 500,
              when: {
                require: {
                  op: 'eq',
                  left: { op: 'field', name: 'team' },
                  right: { op: 'str', value: 'engineering' },
                },
              },
            },
          ],
        },
      },
    },
  ],
  related: ['action-form', 'form-field', 'layout-wizard'],
});

export const SCHEMA_FORMS_MANIFESTS: readonly CatalogManifest[] = /* @__PURE__ */ Object.freeze([
  schemaFormManifest,
]);

/** A schema form is a form landmark of its own. */
export const SCHEMA_FORMS_GRAMMAR_ROLES: readonly GrammarComponentMeta[] =
  /* @__PURE__ */ Object.freeze([
    { id: SCHEMA_FORM_CATALOG_ID, role: 'interactive', landmark: 'form' },
  ]);
