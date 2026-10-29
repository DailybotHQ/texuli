/**
 * /forms-page/ (PLAN_010 T-site-features): honest status copy (in
 * development, coming in 0.8.0, not on npm), fictional data, no HTML sinks,
 * lazy islands, sections that match the page, and the demos' data checked
 * against @texuli/forms itself: every field type, every named format with a
 * sample it accepts and one it refuses, every closed rule shown by the
 * validation form, the flow's conditions, a tampered draft coerced field by
 * field, the in-page data sources (with a retried rate limit), and the agent
 * blueprint accepted by the player's checks while the hostile one is refused.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateDraft } from '@texuli/catalog/validate';
import {
  checkFormDraft,
  computeFormLogic,
  createFormController,
  FORM_FIELD_TYPES,
  FORM_FORMATS,
  FORM_RULE_NAMES,
  matchesFormat,
  validateFormSchema,
  validateFormValues,
} from '@texuli/forms/model';
import { createPlayerCatalog } from '@texuli/player';
import { describe, expect, it } from 'vitest';
import {
  AGENT_FORM_BLUEPRINT,
  FORM_SPEC,
  HOSTILE_FORM_BLUEPRINT,
} from '../src/components/forms-site/blueprint.ts';
import { FORMAT_SAMPLES } from '../src/components/forms-site/formats.ts';
import {
  FIELD_VALUE_TYPES,
  FORMS_DOCS,
  FORMS_RELEASE,
  FORMS_SECTIONS,
  FORMS_STATUS,
} from '../src/components/forms-site/page.ts';
import {
  DRAFT_SCHEMA,
  FIELD_ROWS,
  FIELDS_SCHEMA,
  FLOW_SCHEMA,
  HANDLE_VALIDATOR,
  RULE_COVERAGE,
  TAMPERED_DRAFT,
  VALIDATION_SCHEMA,
} from '../src/components/forms-site/schemas.ts';
import {
  createFormSourcesHost,
  type SourceLogEntry,
} from '../src/components/forms-site/sources.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/forms-page/index.astro');
const SHELL = read('components/feature-site/FeaturePage.astro');
const ISLANDS = [
  'AgentFormDemo',
  'DraftsDemo',
  'FieldGallery',
  'FlowDemo',
  'FormatLab',
  'SourceDemo',
  'ValidationDemo',
];
const SOURCES = [
  ...ISLANDS.map((name) => `components/forms-site/${name}.svelte`),
  'components/forms-site/blueprint.ts',
  'components/forms-site/formats.ts',
  'components/forms-site/page.ts',
  'components/forms-site/schemas.ts',
  'components/forms-site/sources.ts',
  'pages/forms-page/index.astro',
].map((path) => [path, read(path)] as const);

const errorsOf = (blueprint: unknown) =>
  validateDraft(blueprint, {
    catalog: createPlayerCatalog(),
    tier: 'untrusted',
    checkForm: checkFormDraft,
  }).diagnostics.filter((entry) => entry.severity === 'error');

const compile = (schema: unknown) => {
  const result = validateFormSchema(schema, { validators: [HANDLE_VALIDATOR, 'handle-free'] });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.form;
};

describe('forms page: copy and safety', () => {
  it('says @texuli/forms is in development and coming in 0.8.0, and never that it is on npm', () => {
    const pkg = JSON.parse(readFileSync(resolve('packages/forms/package.json'), 'utf8')) as {
      version: string;
      private?: boolean;
    };
    // The claim "not published to npm yet" holds only while the package is the private placeholder.
    expect(pkg.version).toBe('0.0.0');
    expect(pkg.private).toBe(true);
    expect(FORMS_RELEASE).toBe('0.8.0');
    expect(FORMS_STATUS).toBe('In development, coming in 0.8.0: not published to npm yet.');
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(copy).toMatch(
      /eyebrow=\{`@texuli\/forms · in development · coming in \$\{FORMS_RELEASE\}`\}/
    );
    expect(copy).toContain('it is not published to npm yet');
    expect(copy).toContain(
      'description="Texuli schema-driven forms (@texuli/forms, in development, coming in 0.8.0)'
    );
    expect(copy).toContain('<a href="/guides/forms/">forms guide</a>');
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(
        /on npm from|production[- ]ready|is released|available on npm|npm install @texuli\/forms/i
      );
    }
  });

  it('renders no HTML from data and uses only fictional example.com addresses', () => {
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
      for (const [email] of source.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
        expect(email, path).toMatch(/@example\.com$/);
      }
    }
  });

  it('mounts every island with client:visible and imports the player only lazily', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual(ISLANDS);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
    const agent = read('components/forms-site/AgentFormDemo.svelte');
    expect(agent).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+'@texuli\/(player|forms\/host)'/m);
    expect(agent).toMatch(/import\('@texuli\/player'\)/);
  });

  it('gives every section an anchor and a unique id, with one h1 from the shell', () => {
    const ids = FORMS_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE).not.toMatch(/<h1[\s>]/);
    expect(SHELL.match(/<h1[\s>]/g)).toHaveLength(1);
    for (const doc of FORMS_DOCS) expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
  });
});

describe('forms page: the demos cover everything the package has', () => {
  it('shows every field type once, with its value type', () => {
    expect(FIELD_ROWS.map((row) => row.type)).toEqual([...FORM_FIELD_TYPES]);
    expect(Object.keys(FIELD_VALUE_TYPES).sort()).toEqual([...FORM_FIELD_TYPES].sort());
    const form = compile(FIELDS_SCHEMA);
    expect(form.fields.map((field) => field.field.type).sort()).toEqual(
      [...FORM_FIELD_TYPES].sort()
    );
  });

  it('has an accepted and a refused sample for every named format', () => {
    expect(FORMAT_SAMPLES.map((sample) => sample.format)).toEqual([...FORM_FORMATS]);
    for (const sample of FORMAT_SAMPLES) {
      expect(matchesFormat(sample.format, sample.valid), `${sample.format} ${sample.valid}`).toBe(
        true
      );
      expect(
        matchesFormat(sample.format, sample.invalid),
        `${sample.format} ${sample.invalid}`
      ).toBe(false);
    }
  });

  it('exercises every closed rule in the validation form, and its cross-field rule', () => {
    expect(RULE_COVERAGE.map((row) => row.rule)).toEqual([...FORM_RULE_NAMES]);
    const json = JSON.stringify(VALIDATION_SCHEMA);
    for (const member of [
      'required',
      'minLength',
      'maxLength',
      'min',
      'max',
      'step',
      'format',
      'minItems',
      'maxItems',
      'options',
      'accept',
      'maxSize',
      'validator',
    ]) {
      expect(json, member).toContain(`"${member}":`);
    }
    const form = compile(VALIDATION_SCHEMA);
    const empty = validateFormValues(form, {});
    for (const name of ['handle', 'owner', 'seats', 'trialStart', 'trialEnd'])
      expect(empty.errors[name], name).toBeTruthy();
    const checked = validateFormValues(form, {
      handle: 'Harbor Notes',
      owner: 'ada@example.com',
      seats: 7,
      topics: ['design', 'engineering', 'support', 'sales'],
      trialStart: '2026-11-10',
      trialEnd: '2026-11-01',
    });
    expect(checked.errors.handle).toBeTruthy(); // not a slug
    expect(checked.errors.seats).toBeTruthy(); // not a multiple of five
    expect(checked.errors.topics).toBeTruthy(); // more than three
    expect(checked.errors.trialEnd).toBe('The trial must end after it starts.');
  });

  it('shows, requires and enables fields, a section and a step from earlier answers', () => {
    const form = compile(FLOW_SCHEMA);
    const logic = (values: Record<string, unknown>) => computeFormLogic(form, values as never);
    expect(logic({ role: 'engineer' }).fields.roleOther?.visible).toBe(false);
    expect(logic({ role: 'other' }).fields.roleOther).toMatchObject({
      visible: true,
      required: true,
    });
    const reviewStep = form.steps.findIndex((step) => step.id === 'review');
    expect(logic({ people: 10 }).steps[reviewStep]).toBe(false);
    expect(logic({ people: 80 }).steps[reviewStep]).toBe(true);
    expect(logic({ plan: 'team' }).fields.sso?.visible).toBe(false);
    expect(logic({ plan: 'enterprise' }).fields.sso?.visible).toBe(true);
    expect(logic({ plan: 'enterprise', sso: false }).fields.ssoDomain?.enabled).toBe(false);
    expect(logic({ plan: 'enterprise', sso: true }).fields.ssoDomain).toMatchObject({
      enabled: true,
      required: true,
    });
    const tooMany = validateFormValues(form, { plan: 'free', people: 6 } as never);
    expect(tooMany.errors.people).toBe('The free plan covers up to five people.');
  });

  it('coerces a tampered draft field by field, and refuses its choice outside the options on submit', async () => {
    const form = compile(DRAFT_SCHEMA);
    const controller = createFormController(form, {
      drafts: {
        storage: { load: () => TAMPERED_DRAFT, save: () => undefined, remove: () => undefined },
        key: 'test',
      },
    });
    expect(await controller.restoreDraft()).toBe(true);
    const { values } = controller.getState();
    expect(values).not.toHaveProperty('isAdmin');
    expect(values.score).toBe(7);
    expect(values.headline).toBe('Restored from a tampered draft');
    const outcome = await controller.submit();
    expect(outcome.ok).toBe(false);
    const { errors } = controller.getState();
    expect(errors.mood).toBeTruthy();
    expect(errors.details).toBeTruthy();
    controller.destroy();
  });

  it('serves the team choices and the handle check from in-page sources, retrying a rate limit', async () => {
    const log: Omit<SourceLogEntry, 'id'>[] = [];
    const host = createFormSourcesHost((entry) => log.push(entry));
    host.latencyMs = 0;
    const teams = await host.loader.list('example.teams', {
      fields: ['id', 'name', 'members'],
      sort: [{ field: 'name', direction: 'asc' }],
    });
    expect(teams.ok && teams.value.rows.map((row) => row.name)).toEqual([
      'Design',
      'Platform',
      'Research',
      'Support',
    ]);
    const handles = await host.loader.list('example.handles', { search: 'harbor', pageSize: 20 });
    expect(handles.ok && handles.value.rows.map((row) => row.handle)).toEqual([
      'harbor',
      'harbor-notes',
    ]);
    host.failNextRead();
    const retried = await host.loader.list(
      'example.teams',
      { fields: ['id', 'name'] },
      { fresh: true }
    );
    expect(retried.ok).toBe(true);
    expect(log.map((entry) => entry.outcome)).toContain('rate-limited (the loader retries)');
    // A query outside the declaration never reaches an adapter.
    const before = log.length;
    const refused = await host.loader.list('example.handles', {
      sort: [{ field: 'handle', direction: 'asc' }],
    });
    expect(refused.ok).toBe(false);
    expect(log.length).toBe(before);
  });

  it('writes an agent schema-form blueprint (spec 0.8.0) the player accepts, and refuses the hostile pattern', () => {
    expect(FORM_SPEC).toBe('0.8.0');
    expect(errorsOf(AGENT_FORM_BLUEPRINT)).toEqual([]);
    const hostile = errorsOf(HOSTILE_FORM_BLUEPRINT);
    expect(hostile.length).toBeGreaterThan(0);
    expect(JSON.stringify(hostile)).toMatch(/pattern/);
    // Without a form host the node is refused, never painted unchecked.
    const unchecked = validateDraft(AGENT_FORM_BLUEPRINT, {
      catalog: createPlayerCatalog(),
      tier: 'untrusted',
    });
    expect(unchecked.diagnostics.map((entry) => entry.code)).toContain('form-unchecked');
  });
});
