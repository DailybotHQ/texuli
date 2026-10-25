/**
 * Framework-free model for text (`string`) inspector fields. Whether a value
 * is acceptable is decided by the renderer (`sanitizeProps`), plus the rules
 * the painting code or a schema applies to that one prop (`STRING_RULES`):
 * each names its source, and nothing here invents a rule. Imports only
 * `@texuli/catalog`, the chart schemas and the player's region rule.
 */
import type { CatalogPropSchema } from '@texuli/catalog';
import { sanitizeProps } from '@texuli/catalog/render/renderer';
import { chartPropSchemas } from '@texuli/charts/schemas';
import { HOST_REGION_NAME } from '@texuli/player';

export type StringProp = CatalogPropSchema & { kind: 'string' };

export function isStringProp(prop: CatalogPropSchema): prop is StringProp {
  return prop.kind === 'string';
}

export interface StringIssue {
  severity: 'error' | 'warning';
  message: string;
}

/** A rule one prop's text must follow, from the code that applies it. */
export interface StringRule {
  /** The problem with `value`, or `undefined` when it passes. */
  check: (value: string) => StringIssue | undefined;
  /** What the rule is, for the field's hint. */
  describe: string;
  source: string;
}

/** `packages/player/src/layouts/ContentLayout.svelte`: only a bounded length reaches the style. */
export const GRID_GAP = /^(?:0|\d{1,2}(?:\.\d{1,2})?(?:rem|em)|\d{1,3}px)$/;
/** The player's own rule for a region name a host can claim. */
export const REGION_NAME = HOST_REGION_NAME;

export function isLocaleTag(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

const gapRule: StringRule = {
  check: (value) =>
    GRID_GAP.test(value)
      ? undefined
      : {
          severity: 'warning',
          message: 'The player ignores this gap and keeps the default spacing.',
        },
  describe: 'A length such as 1rem, 0.5em or 12px (up to 99rem or 999px), or 0.',
  source: 'player grid layout',
};

const regionRule: StringRule = {
  check: (value) =>
    REGION_NAME.test(value)
      ? undefined
      : {
          severity: 'warning',
          message:
            'No host can claim this name, so the region always paints its label as a placeholder.',
        },
  describe: 'Lowercase letters, digits and hyphens, starting with a letter, up to 32 characters.',
  source: 'player host region',
};

const localeRule: StringRule = {
  check: (value) =>
    isLocaleTag(value)
      ? undefined
      : {
          severity: 'error',
          message: 'Not a valid language tag; number formatting cannot use it.',
        },
  describe: 'A BCP 47 language tag such as en, en-GB or pt-BR.',
  source: 'map block number formatting (Intl)',
};

const nonEmptyRule = (component: string): StringRule => ({
  check: (value) =>
    value.trim() === ''
      ? { severity: 'error', message: 'Must not be blank: enter some text or clear it.' }
      : undefined,
  describe: 'Text that is not blank.',
  source: `${component} chart schema`,
});

const RULES: Readonly<Record<string, Readonly<Record<string, StringRule>>>> = Object.freeze({
  'layout-grid': { gap: gapRule },
  'host-region': { name: regionRule },
  'blocks-map': { locale: localeRule },
});

/** The rule for one prop: a painting rule, else the chart schema's `nonEmpty`. */
export function stringRule(id: string, name: string): StringRule | undefined {
  const rule = RULES[id]?.[name];
  if (rule) return rule;
  if (!Object.hasOwn(chartPropSchemas, id)) return undefined;
  const component = chartPropSchemas[id as keyof typeof chartPropSchemas];
  const prop = component.props.find((candidate) => candidate.name === name);
  const constraints = (prop as { constraints?: { nonEmpty?: boolean } } | undefined)?.constraints;
  return prop?.kind === 'string' && constraints?.nonEmpty
    ? nonEmptyRule(component.component)
    : undefined;
}

export type StringReading =
  | { state: 'unset' }
  | { state: 'set'; value: string }
  | { state: 'invalid'; raw: unknown; message: string };

/** Read a value the way the renderer will: unset, accepted, or refused with its reason. */
export function readString(prop: StringProp, value: unknown): StringReading {
  if (value === undefined) return { state: 'unset' };
  const result = sanitizeProps({ [prop.name]: value }, [prop], '', 'inspector');
  if (result.props && Object.hasOwn(result.props, prop.name)) {
    return { state: 'set', value: value as string };
  }
  const reason = result.diagnostics.find((diagnostic) => diagnostic.message)?.message;
  return { state: 'invalid', raw: value, message: reason ?? `Prop "${prop.name}" was refused.` };
}

/** What the inspector shows under the field. */
export function stringIssues(prop: StringProp, value: unknown, rule?: StringRule): StringIssue[] {
  const reading = readString(prop, value);
  if (reading.state === 'invalid') {
    return [{ severity: 'error', message: `${reading.message} It will be refused at paint.` }];
  }
  if (reading.state === 'unset') {
    return prop.required === true ? [{ severity: 'error', message: 'Required: enter text.' }] : [];
  }
  const issue = rule?.check(reading.value);
  return issue ? [issue] : [];
}

/** Text from the box → the value to store: an empty box clears the prop. */
export function stringInput(raw: string): string | undefined {
  return raw === '' ? undefined : raw;
}
