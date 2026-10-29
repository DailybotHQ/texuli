/**
 * Static copy for /forms-page/: the status, the pieces of `@texuli/forms`,
 * the sections, the keyboard table, the rules and the docs. Plain data, so
 * the page and its tests share one source (labels are text, never HTML).
 */
import type { FormFieldType } from '@texuli/forms/model';

/** The release `@texuli/forms` is planned for. It is not on npm. */
export const FORMS_RELEASE = '0.8.0';

/** The status line every surface of this page repeats. */
export const FORMS_STATUS = `In development, coming in ${FORMS_RELEASE}: not published to npm yet.`;

export interface FormsPiece {
  readonly name: string;
  readonly role: string;
}

export const FORMS_PIECES: readonly FormsPiece[] = [
  { name: 'forms', role: 'SchemaForm, texuli controls' },
  { name: 'forms/model', role: 'schema, logic, rules, drafts' },
  { name: 'forms/host', role: 'agent forms in the player' },
  { name: 'core/expression', role: 'bounded conditions and rules' },
  { name: 'core/data-source', role: 'host data behind fields' },
];

export interface FormsSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const FORMS_SECTIONS: readonly FormsSection[] = [
  {
    id: 'fields',
    title: 'Every field type',
    summary:
      'One schema, fifteen field types, each painted by the texuli control for it and named by its label. Values are typed: numbers stay numbers, dates are YYYY-MM-DD, multiple choices are lists. Change anything and watch the values; submit to see what a host receives.',
  },
  {
    id: 'formats',
    title: 'Named formats, never patterns',
    summary:
      'A schema names a format; it never carries a regular expression. Each format is owned code that runs in linear time on input capped at 1,000 characters, so an agent cannot ship a pattern that backtracks. Try any value, or a sample from the table.',
  },
  {
    id: 'validation',
    title: 'Validation with announced errors',
    summary:
      'Every closed rule, a host validator that checks the handle asynchronously, and a cross-field rule. Submit the form empty: an error summary takes focus, says how many answers need attention and links to each one, and every error is linked to its control. Errors clear as you fix them. Turn on the server refusal to see server errors land on their fields.',
  },
  {
    id: 'flow',
    title: 'Multi-step flows and conditional logic',
    summary:
      'Steps with a progress Stepper; Next validates the current step, and each new step heading takes focus and is announced. Conditions are expressions over earlier answers: a field shows when you pick Something else, a section appears for Enterprise, a field becomes editable when single sign-on is on, and a whole step runs only for teams of more than 50.',
  },
  {
    id: 'drafts',
    title: 'Drafts and autosave',
    summary:
      'Every change schedules a save to the host storage, here an in-page adapter you can read. Remount the form and the draft comes back, announced once. A restored draft is untrusted input: each value is coerced to its field, unknown fields are dropped, and a choice outside the options is refused on submit.',
  },
  {
    id: 'sources',
    title: 'Fields backed by host data',
    summary:
      'The team choices are rows of a host data source, and the handle is checked against another. The page declares both with @texuli/core/data-source and answers from memory; the loader validates each query, shares identical reads, caches pages and retries a rate-limited read. The log shows exactly what each adapter received.',
  },
  {
    id: 'agents',
    title: 'Forms as agent data',
    summary:
      'An agent sends a whole form as one schema-form node of a blueprint (spec 0.8.0). The player validates it at the untrusted tier and paints it through the form host of @texuli/forms; submitting proposes the node’s action to the host with the answers. A schema that smuggles a pattern is refused before anything paints.',
  },
  {
    id: 'keyboard',
    title: 'Keyboard and screen readers',
    summary:
      'Every form on this page works without a pointer, in the native tab order, with every control labelled.',
  },
  {
    id: 'safety',
    title: 'What keeps it safe',
    summary: 'Forms are data. These hold by construction in the validator and the view.',
  },
];

/** The value each field type holds (`FormValue`). Keyed by type: exhaustive. */
export const FIELD_VALUE_TYPES: Readonly<Record<FormFieldType, string>> = {
  text: 'string',
  textarea: 'string',
  number: 'number or null',
  email: 'string',
  url: 'string (https)',
  date: 'YYYY-MM-DD or null',
  time: 'HH:MM or null',
  select: 'string',
  multiselect: 'string list',
  checkbox: 'boolean',
  radio: 'string',
  switch: 'boolean',
  slider: 'number',
  file: 'file metadata list (the host uploads)',
  tags: 'string list',
};

export interface FormsKey {
  readonly where: string;
  readonly keys: string;
  readonly effect: string;
}

export const FORMS_KEYS: readonly FormsKey[] = [
  {
    where: 'Any field',
    keys: 'Tab, Shift+Tab',
    effect: 'Next or previous control, in document order',
  },
  { where: 'Text field', keys: 'Enter', effect: 'Next step, or submit on the last one' },
  { where: 'Radio group', keys: 'Arrow keys', effect: 'Move and select a choice' },
  { where: 'Select', keys: 'Space, Enter, arrows, type to find', effect: 'Open, move, pick' },
  { where: 'Slider', keys: 'Arrows, Page Up, Page Down, Home, End', effect: 'Change the value' },
  {
    where: 'Tags',
    keys: 'Enter; Backspace in the empty input',
    effect: 'Add the typed tag; move to the tags already added',
  },
  {
    where: 'Date picker',
    keys: 'Up and Down in a segment; the calendar button',
    effect: 'Change day, month or year; open the calendar dialog',
  },
  { where: 'Error summary', keys: 'Enter on a link', effect: 'Focus that answer' },
];

/** What screen reader users hear, as the view implements it (packages/forms/docs/schema-form.md). */
export const FORMS_A11Y: readonly string[] = [
  'A named form landmark, its description linked.',
  'Each control’s label, description and error reach the focusable element (the Field rule).',
  'The error summary takes focus and counts the answers that need attention.',
  'Each new step heading takes focus; “Step 2 of 4: Your team” is announced.',
  '“Checking…” is linked to a field while its host validator runs.',
  'A restored draft is announced once; autosaves stay quiet.',
  'Step transitions fade through texuli/motion and are instant under reduced motion.',
];

export const FORMS_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Closed schemas',
    body: 'Unknown members, a pattern included, are refused. Members that do not fit the field type, duplicate names and defaults outside the options are refused too, with a JSON path.',
  },
  {
    title: 'Bounded logic',
    body: 'Conditions and rules are expressions of one closed language, evaluated within fixed step limits. A condition reads only earlier fields, so visibility resolves in one pass with no cycles.',
  },
  {
    title: 'Names, not code',
    body: 'Formats and host validators are names. A validator the host did not register fails closed, and the schema can never bring its own.',
  },
  {
    title: 'Text is text',
    body: 'Labels, descriptions and messages render as text, never markup. Help links pass the URL policy at the schema’s tier.',
  },
  {
    title: 'Hidden means not sent',
    body: 'A hidden or disabled field is neither validated nor submitted, and reads as empty to the conditions after it.',
  },
  {
    title: 'Untrusted drafts',
    body: 'Restored drafts are coerced field by field like any outside input; storage failures set a status and never throw.',
  },
];

export interface FormsDoc {
  readonly label: string;
  readonly path: string;
}

export const FORMS_DOCS: readonly FormsDoc[] = [
  { label: '@texuli/forms', path: 'packages/forms/README.md' },
  { label: 'SchemaForm', path: 'packages/forms/docs/schema-form.md' },
  { label: 'Model', path: 'packages/forms/docs/model.md' },
  { label: 'Host', path: 'packages/forms/docs/host.md' },
  { label: 'The expression language', path: 'packages/core/docs/core-expression.md' },
  { label: 'Data sources', path: 'packages/core/docs/core-data-source.md' },
  { label: 'ADR-015: one bounded expression language', path: 'docs/DECISIONS.md' },
];
