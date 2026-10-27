// @vitest-environment node
import { FIELD_PATTERN_NAMES } from '@texuli/catalog/manifests/state';
import {
  ACTION_FIELDS,
  DATA_BINDING_KEY,
  SPEC_ACTION_OPS,
  SPEC_LIMITS,
  SPEC_PATTERNS,
  STATE_BINDING_KEY as SPEC_STATE_BINDING_KEY,
  SPEC_STATE_TYPES,
} from '@texuli/spec';
import { describe, expect, it } from 'vitest';
import {
  ACTION_NAME,
  FIELD_PATTERNS,
  MAX_ACTION_FIELDS,
  MAX_ACTION_VALUE_LENGTH,
} from '../src/actions.ts';
import { STATE_BINDING_KEY } from '../src/state/bind.ts';
import { FLOW_NAME, MAX_FLOW_TRANSITIONS, MAX_FLOW_VIEWS } from '../src/state/flow.ts';
import { MAX_EMIT_VALUE_LENGTH, MAX_EMIT_VALUES, runActions } from '../src/state/reducers.ts';
import {
  DATA_SOURCE_NAME,
  DEFAULT_STRING_LENGTH,
  ITEM_KEY,
  LIST_TEXT,
  MAX_ENUM_VALUE_LENGTH,
  MAX_ENUM_VALUES,
  MAX_ITEM_FIELDS,
  MAX_LIST_ITEMS,
  MAX_STATE_VARS,
  MAX_STRING_LENGTH,
  parseStateDeclarations,
} from '../src/state/schema.ts';

/**
 * The player's runtime limits and vocabularies mirror the spec 0.3.0
 * contract (`@texuli/spec` `src/contract.ts`), so what the spec accepts the
 * player runs, and what it refuses the player refuses.
 */
describe('the player mirrors the spec contract', () => {
  it('limits', () => {
    expect({
      stateVars: MAX_STATE_VARS,
      enumValues: MAX_ENUM_VALUES,
      enumValueLength: MAX_ENUM_VALUE_LENGTH,
      stringLength: MAX_STRING_LENGTH,
      defaultStringLength: DEFAULT_STRING_LENGTH,
      flowViews: MAX_FLOW_VIEWS,
      flowTransitions: MAX_FLOW_TRANSITIONS,
      emitValues: MAX_EMIT_VALUES,
      emitValueLength: MAX_EMIT_VALUE_LENGTH,
      listItems: MAX_LIST_ITEMS,
      listItemFields: MAX_ITEM_FIELDS,
    }).toEqual({
      stateVars: SPEC_LIMITS.stateVars,
      enumValues: SPEC_LIMITS.enumValues,
      enumValueLength: SPEC_LIMITS.enumValueLength,
      stringLength: SPEC_LIMITS.stringLength,
      defaultStringLength: SPEC_LIMITS.defaultStringLength,
      flowViews: SPEC_LIMITS.flowViews,
      flowTransitions: SPEC_LIMITS.flowTransitions,
      emitValues: SPEC_LIMITS.emitValues,
      emitValueLength: SPEC_LIMITS.emitValueLength,
      listItems: SPEC_LIMITS.listItems,
      listItemFields: SPEC_LIMITS.listItemFields,
    });
    // The form intent limits match emit's.
    expect(MAX_ACTION_FIELDS).toBe(SPEC_LIMITS.emitValues);
    expect(MAX_ACTION_VALUE_LENGTH).toBe(SPEC_LIMITS.emitValueLength);
  });

  it('patterns and binding keys', () => {
    expect(STATE_BINDING_KEY).toBe(SPEC_STATE_BINDING_KEY);
    expect(DATA_BINDING_KEY).toBe('$data');
    expect(ITEM_KEY.source).toBe(SPEC_PATTERNS.itemKey);
    expect(LIST_TEXT.source).toBe(SPEC_PATTERNS.listText);
    expect(FLOW_NAME.source).toBe(SPEC_PATTERNS.flowName);
    expect(ACTION_NAME.source).toBe(SPEC_PATTERNS.intentName);
    const data = new RegExp(SPEC_PATTERNS.dataName);
    for (const name of ['tickets.open', 'a', 'Report_1.total', '1x', 'a..b', 'a.']) {
      expect(DATA_SOURCE_NAME.test(name), name).toBe(data.test(name) && name.length <= 64);
    }
  });

  it('state types: every spec type parses with its default initial value', () => {
    const declarations: Record<string, unknown> = {
      flag: { type: 'boolean' },
      count: { type: 'number', min: 0, max: 9 },
      choice: { type: 'enum', values: ['a', 'b'] },
      text: { type: 'string' },
      tasks: { type: 'list' },
      flowchart: {
        type: 'workflow',
        initial: {
          version: 1,
          nodeTypes: [{ id: 'step', label: 'Step', ports: [] }],
          nodes: [],
          edges: [],
        },
      },
    };
    expect(
      Object.values(declarations)
        .map((d) => (d as { type: string }).type)
        .sort()
    ).toEqual([...SPEC_STATE_TYPES].sort());
    const parsed = parseStateDeclarations(declarations);
    expect(parsed.ok).toBe(true);
  });

  it('actions: the reducer runs exactly the closed op set with its fields', () => {
    expect(Object.keys(ACTION_FIELDS).sort()).toEqual([...SPEC_ACTION_OPS].sort());
    const parsed = parseStateDeclarations({
      open: { type: 'boolean' },
      q: { type: 'string' },
      a: { type: 'list', initial: [{ id: 'x' }] },
      b: { type: 'list' },
    });
    if (!parsed.ok) throw new Error('declarations');
    const snapshot = { open: false, q: '', a: [{ id: 'x' }], b: [] };
    const run = (action: unknown, event = 'change', inForm = true) =>
      runActions([action], {
        snapshot,
        declarations: parsed.declarations,
        event,
        detail: { value: 'typed' },
        inForm,
      }).ok;
    const examples: Record<string, unknown> = {
      setState: { op: 'setState', state: 'q', fromEvent: 'value' },
      toggleState: { op: 'toggleState', state: 'open' },
      moveItem: { op: 'moveItem', from: 'a', item: 'x', to: 'b', index: 0 },
      flowGo: { op: 'flowGo', event: 'next' },
      emit: { op: 'emit', intent: 'notify-team', values: { text: { $state: 'q' }, urgent: true } },
      submit: { op: 'submit' },
    };
    for (const op of SPEC_ACTION_OPS) expect(run(examples[op]), op).toBe(true);
    expect(run({ op: 'fetch' })).toBe(false);
    expect(run({ op: 'submit' }, 'press', false)).toBe(false);
  });

  it('form-field patterns are exactly the names the catalog manifest offers', () => {
    expect(Object.keys(FIELD_PATTERNS)).toEqual([...FIELD_PATTERN_NAMES]);
  });
});
