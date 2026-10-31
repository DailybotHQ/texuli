// @vitest-environment node
import { readFileSync } from 'node:fs';
import { validateBlueprint } from '@texuli/spec';
import { describe, expect, it } from 'vitest';
import { checkFormDraft } from '../../forms/src/model/index.ts';
import { buildCatalog } from '../src/build/build.ts';
import { discoverManifestGroups } from '../src/build/node.ts';
import { SCHEMA_FORM_CATALOG_ID, schemaFormManifest } from '../src/manifests/schema-forms/index.ts';
import { renderCatalogFromBuild } from '../src/render/renderer/index.ts';
import {
  type DraftValidation,
  SCHEMA_FORM_ID,
  schemaFormNodes,
  validateDraft,
} from '../src/validate/index.ts';

/**
 * Forms in blueprints (spec 0.8.0, ADR-015): a `schema-form` node's schema
 * is checked with the forms validator at the draft's tier, after the
 * structural checks. Agents name formats and validators; patterns, code and
 * unsafe links never pass.
 */

const build = await buildCatalog(await discoverManifestGroups());
const catalog = renderCatalogFromBuild(build.catalog);
const spec = (path: string) =>
  JSON.parse(readFileSync(new URL(`../../spec/${path}`, import.meta.url), 'utf8')) as Record<
    string,
    unknown
  >;
const golden = spec('fixtures/golden/form-registration.json');
const codes = (result: DraftValidation) =>
  result.diagnostics.filter((d) => d.severity === 'error').map((d) => `${d.check}:${d.code}`);

const formNode = (schema: unknown) => ({
  id: 'layout-page',
  props: { title: 'Request' },
  children: [{ id: 'schema-form', props: { action: 'request-access', schema } }],
});
const field = (extra: Record<string, unknown> = {}) => ({
  name: 'email',
  type: 'email',
  label: 'Work email',
  required: true,
  ...extra,
});
const schema = (...fields: unknown[]) => ({ title: 'Request access', fields });

describe('schema-form in validateDraft', () => {
  it('accepts the form-registration golden at the untrusted tier and finds its form node', () => {
    const result = validateDraft(golden, { catalog, checkForm: checkFormDraft });
    expect(codes(result)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks.forms).toBe('pass');
    const nodes = schemaFormNodes(result.roots);
    expect(nodes.map((entry) => [entry.node.id, entry.path])).toEqual([
      [SCHEMA_FORM_ID, '0.children.0'],
    ]);
    expect(SCHEMA_FORM_CATALOG_ID).toBe(SCHEMA_FORM_ID);
    expect(schemaFormManifest.agentEmittable).toBe(true);
  });

  it('agrees with the spec validator on the golden and on every form invalid fixture', () => {
    const documents = {
      blueprintSchema: spec('schemas/blueprint.schema.json'),
      catalog: spec('catalog/components.json'),
      workflowSchema: spec('schemas/workflow.schema.json'),
    } as unknown as Parameters<typeof validateBlueprint>[1];
    expect(validateBlueprint(golden, documents).ok).toBe(true);
    for (const name of ['form-pattern', 'form-field-type', 'form-format', 'form-expression-op']) {
      const fixture = spec(`fixtures/invalid/${name}.json`) as { blueprint: unknown };
      expect(validateBlueprint(fixture.blueprint, documents).ok, name).toBe(false);
      const draft = validateDraft(fixture.blueprint, {
        catalog,
        checkForm: checkFormDraft,
        frameRoots: false,
      });
      expect(draft.ok, name).toBe(false);
      expect(codes(draft), name).toContain('forms:form-schema');
    }
  });

  it('refuses each unsafe or inconsistent schema under the forms check, with a path into the schema', () => {
    const cases: [unknown, string][] = [
      [schema(field({ pattern: '^(a+)+$' })), '0.children.0.props.schema.fields[0].pattern'],
      [
        schema(field({ type: 'text', format: '^\\d+$' })),
        '0.children.0.props.schema.fields[0].format',
      ],
      [
        schema(field({ link: { label: 'Help', href: 'javascript:alert(1)' } })),
        '0.children.0.props.schema.fields[0].link.href',
      ],
      [
        schema(field({ when: { show: { op: 'field', name: 'later' } } }), {
          name: 'later',
          type: 'checkbox',
          label: 'Later',
        }),
        '0.children.0.props.schema.fields[0].when.show.name',
      ],
      [
        schema(
          field({
            when: {
              show: {
                op: 'call',
                fn: 'fetch',
                args: [{ op: 'str', value: 'https://example.com' }],
              },
            },
          })
        ),
        '0.children.0.props.schema.fields[0].when.show.fn',
      ],
      [schema(field(), field()), '0.children.0.props.schema.fields[1].name'],
      // Object.prototype members match the name pattern but are reserved.
      [schema(field({ name: 'toString' })), '0.children.0.props.schema.fields[0].name'],
      [schema(field({ name: 'constructor' })), '0.children.0.props.schema.fields[0].name'],
      [{ title: 'Empty' }, '0.children.0.props.schema'],
    ];
    for (const [input, path] of cases) {
      const result = validateDraft(formNode(input), { catalog, checkForm: checkFormDraft });
      expect(result.ok, JSON.stringify(input).slice(0, 120)).toBe(false);
      const finding = result.diagnostics.find((d) => d.check === 'forms');
      expect(
        finding?.path,
        JSON.stringify(result.diagnostics.map((d) => [d.check, d.code, d.path]))
      ).toBe(path);
      expect(finding?.id).toBe('schema-form');
    }
  });

  it('refuses every schema-form without the host form validator (form-unchecked)', () => {
    const result = validateDraft(golden, { catalog });
    expect(codes(result)).toEqual(['forms:form-unchecked']);
    expect(result.checks.forms).toBe('fail');
    const throwing = validateDraft(golden, {
      catalog,
      checkForm: () => {
        throw new Error('boom');
      },
    });
    expect(codes(throwing)).toEqual(['forms:form-schema']);
  });

  it('checks help links at the host tier and validator names against the host list', () => {
    const local = formNode(schema(field({ link: { label: 'Help', href: '/help' } })));
    expect(validateDraft(local, { catalog, checkForm: checkFormDraft }).ok).toBe(false);
    expect(validateDraft(local, { catalog, checkForm: checkFormDraft, tier: 'developer' }).ok).toBe(
      true
    );
    const named = formNode(schema(field({ validator: 'uniqueEmail' })));
    expect(validateDraft(named, { catalog, checkForm: checkFormDraft }).ok).toBe(true);
    expect(
      validateDraft(named, { catalog, checkForm: checkFormDraft, formValidators: ['uniqueEmail'] })
        .ok
    ).toBe(true);
    expect(
      codes(validateDraft(named, { catalog, checkForm: checkFormDraft, formValidators: [] }))
    ).toEqual(['forms:form-schema']);
  });

  it('lets a draft declare a custom field only for a kind the host registered (G113)', () => {
    const ticket = formNode(
      schema(field(), {
        name: 'customer',
        type: 'custom',
        kind: 'relation',
        label: 'Customer',
        required: true,
      })
    );
    const refused = validateDraft(ticket, { catalog, checkForm: checkFormDraft });
    expect(codes(refused)).toEqual(['forms:form-schema']);
    const finding = refused.diagnostics.find((d) => d.check === 'forms');
    expect(finding?.path).toBe('0.children.0.props.schema.fields[1].kind');
    expect(finding?.message.startsWith('kind:')).toBe(true);
    expect(
      validateDraft(ticket, { catalog, checkForm: checkFormDraft, formKinds: ['address'] }).ok
    ).toBe(false);
    const accepted = validateDraft(ticket, {
      catalog,
      checkForm: checkFormDraft,
      formKinds: ['relation'],
    });
    expect(codes(accepted)).toEqual([]);
  });

  it('accepts the 0.10.0 field members and refuses credential fields in agent output (G117, G118, G121)', () => {
    const fields = formNode(
      schema(
        field({ type: 'url', name: 'site', protocols: ['http', 'https'] }),
        { name: 'tint', type: 'color', label: 'Accent' },
        { name: 'starts', type: 'datetime', label: 'Starts', min: '2026-11-01T09:00' },
        {
          name: 'plan',
          type: 'select',
          label: 'Plan',
          clearable: false,
          options: [{ value: 'a', label: 'A' }],
        }
      )
    );
    expect(codes(validateDraft(fields, { catalog, checkForm: checkFormDraft }))).toEqual([]);
    const login = formNode(schema({ name: 'pw', type: 'password', label: 'Password' }));
    expect(codes(validateDraft(login, { catalog, checkForm: checkFormDraft }))).toEqual([
      'forms:form-schema',
    ]);
    expect(
      codes(validateDraft(login, { catalog, checkForm: checkFormDraft, tier: 'developer' }))
    ).toEqual([]);
  });

  it('stays bounded on a hostile schema at the size limits', () => {
    const big = (depth: number): unknown =>
      depth === 0 ? { op: 'field', name: 'f0' } : { op: 'not', value: big(depth - 1) };
    const fields = Array.from({ length: 200 }, (_, i) => ({
      name: `f${i}`,
      type: 'checkbox',
      label: `Option ${i}`,
      ...(i > 0 ? { when: { show: big(30) } } : {}),
    }));
    const start = performance.now();
    const result = validateDraft(formNode({ title: 'Many', fields }), {
      catalog,
      checkForm: checkFormDraft,
    });
    expect(result.checks.forms).toBe('pass');
    expect(performance.now() - start).toBeLessThan(3000);
  });
});
