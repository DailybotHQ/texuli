import { type JsonSchema, schemaKeywordIssues, validateJson } from './schema.ts';
import {
  type InvokeFailure,
  type InvokeOptions,
  type InvokeResult,
  type Operation,
  type OperationAlias,
  OperationError,
  type OperationErrorCode,
  type OperationRuntime,
  type RemovedOperationName,
} from './types.ts';

/** The registry every door (MCP, CLI, docs) reads. */
export interface OperationRegistry {
  /** Operations in declaration order, optionally only those a door serves. */
  list(options?: InvokeOptions): readonly Operation[];
  /** Deprecated aliases a door still serves (none in 0.10.0). */
  aliases(): readonly OperationAlias[];
  /** Names an earlier release served and this one removed: refused, never listed. */
  removed(): readonly RemovedOperationName[];
  /** The refusal for a removed name, or `undefined` when the name was never removed. */
  removedMessage(name: string): string | undefined;
  /** An operation by its name (not an alias). */
  get(name: string): Operation | undefined;
  /** The description a door shows for an operation or alias name. */
  describe(name: string): string | undefined;
  /** The input schema for an operation or alias name. */
  inputSchema(name: string): JsonSchema | undefined;
  /** Validate input, run the handler under its limits, validate output. Never throws. */
  invoke(name: string, input: unknown, options?: InvokeOptions): Promise<InvokeResult>;
}

const ALL_RUNTIMES: readonly OperationRuntime[] = ['edge', 'node', 'site'];

function fail(
  code: OperationErrorCode,
  message: string,
  operation?: string,
  issues?: InvokeFailure['error']['issues']
): InvokeFailure {
  return {
    ok: false,
    ...(operation ? { operation } : {}),
    error: { code, message, ...(issues && issues.length > 0 ? { issues } : {}) },
  };
}

/** The UTF-8 size of the input as JSON, or `undefined` when it is not JSON (cycles, BigInt). */
function jsonBytes(input: unknown): number | undefined {
  try {
    const text = JSON.stringify(input);
    return text === undefined ? undefined : new TextEncoder().encode(text).byteLength;
  } catch {
    return undefined;
  }
}

/** Type helper: declare an operation with its handler checked against the shape. */
export function defineOperation(operation: Operation): Operation {
  return operation;
}

/** The refusal a door gives for a removed name: when it went and what to call instead. */
export function removedNameMessage(removed: RemovedOperationName): string {
  return `The tool "${removed.name}" was removed in ${removed.removedIn}; call ${removed.replacedBy.join(' or ')} instead.`;
}

/** The text a door shows for an operation: the summary plus its stated limits. */
export function operationDescription(operation: Operation): string {
  const limits = [`input up to ${operation.limits.inputBytes} bytes`];
  if (operation.limits.items !== undefined) limits.push(`at most ${operation.limits.items} items`);
  limits.push(`${operation.limits.timeMs} ms budget`);
  return `${operation.summary} Limits: ${limits.join(', ')}.`;
}

/**
 * Build a registry. Refuses duplicate names, aliases that shadow an
 * operation or point nowhere, and schemas outside the supported subset.
 */
export function createOperationRegistry(
  operations: readonly Operation[],
  aliases: readonly OperationAlias[] = [],
  removed: readonly RemovedOperationName[] = []
): OperationRegistry {
  const byName = new Map<string, Operation>();
  for (const operation of operations) {
    if (byName.has(operation.name)) throw new Error(`Duplicate operation "${operation.name}".`);
    const issues = [
      ...schemaKeywordIssues(operation.input, `${operation.name} input`),
      ...schemaKeywordIssues(operation.output, `${operation.name} output`),
    ];
    if (issues.length > 0) throw new Error(issues.join('\n'));
    byName.set(operation.name, operation);
  }
  const byAlias = new Map<string, OperationAlias>();
  for (const alias of aliases) {
    if (byName.has(alias.name) || byAlias.has(alias.name))
      throw new Error(`Alias "${alias.name}" duplicates a name.`);
    for (const target of alias.targets)
      if (!byName.has(target)) throw new Error(`Alias "${alias.name}" targets "${target}".`);
    if (alias.input) {
      const issues = schemaKeywordIssues(alias.input, `${alias.name} input`);
      if (issues.length > 0) throw new Error(issues.join('\n'));
    }
    byAlias.set(alias.name, alias);
  }
  const byRemoved = new Map<string, RemovedOperationName>();
  for (const entry of removed) {
    if (byName.has(entry.name) || byAlias.has(entry.name) || byRemoved.has(entry.name))
      throw new Error(`Removed name "${entry.name}" duplicates a name.`);
    for (const target of entry.replacedBy)
      if (!byName.has(target))
        throw new Error(`Removed name "${entry.name}" points at "${target}".`);
    byRemoved.set(entry.name, entry);
  }

  async function run(
    operation: Operation,
    input: Record<string, unknown>,
    options: InvokeOptions
  ): Promise<InvokeResult> {
    const name = operation.name;
    if (!(options.runtimes ?? ALL_RUNTIMES).includes(operation.runtime))
      return fail(
        'runtime-unavailable',
        `${name} needs the ${operation.runtime} runtime, which this server does not provide.`,
        name
      );
    const issues = validateJson(operation.input, input);
    if (issues.length > 0)
      return fail(
        'invalid-input',
        `Invalid input for ${name}: ${issues.map((i) => i.message).join(' ')}`,
        name,
        issues
      );

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve('timeout');
      }, operation.limits.timeMs);
    });
    let output: unknown;
    try {
      const result = await Promise.race([
        Promise.resolve().then(() =>
          operation.handler(input, {
            signal: controller.signal,
            ...(options.site ? { site: options.site } : {}),
            ...(options.files ? { files: options.files } : {}),
          })
        ),
        timeout,
      ]);
      if (result === 'timeout' && controller.signal.aborted)
        return fail('timeout', `${name} ran past its ${operation.limits.timeMs} ms budget.`, name);
      output = result;
    } catch (error) {
      if (error instanceof OperationError) return fail(error.code, error.message, name);
      return fail(
        'operation-failed',
        `${name} failed: ${error instanceof Error ? error.message : String(error)}`,
        name
      );
    } finally {
      clearTimeout(timer);
    }
    const outputIssues = validateJson(operation.output, output);
    if (outputIssues.length > 0)
      return fail(
        'invalid-output',
        `${name} returned output outside its schema: ${outputIssues.map((i) => i.message).join(' ')}`,
        name,
        outputIssues
      );
    return { ok: true, operation: name, output };
  }

  const registry: OperationRegistry = {
    list(options = {}) {
      const runtimes = options.runtimes ?? ALL_RUNTIMES;
      return operations.filter((operation) => runtimes.includes(operation.runtime));
    },
    aliases() {
      return aliases;
    },
    removed() {
      return removed;
    },
    removedMessage(name) {
      const entry = byRemoved.get(name);
      return entry ? removedNameMessage(entry) : undefined;
    },
    get(name) {
      return byName.get(name);
    },
    describe(name) {
      const operation = byName.get(name);
      if (operation) return operationDescription(operation);
      const alias = byAlias.get(name);
      if (!alias) return undefined;
      const targets = alias.targets.map((target) => byName.get(target) as Operation);
      return `Deprecated alias of ${alias.targets.join(' and ')}; removed in ${alias.removeIn}. Call ${alias.targets.join(' or ')} instead. ${targets.map((target) => target.summary).join(' ')}`;
    },
    inputSchema(name) {
      const operation = byName.get(name);
      if (operation) return operation.input;
      const alias = byAlias.get(name);
      if (!alias) return undefined;
      return alias.input ?? byName.get(alias.targets[0] as string)?.input;
    },
    async invoke(name, input, options = {}) {
      if (typeof input !== 'object' || input === null || Array.isArray(input))
        return fail(
          'invalid-input',
          'Invalid input: $ must be an object.',
          byName.has(name) ? name : undefined
        );
      const operation = byName.get(name);
      const alias = operation ? undefined : byAlias.get(name);
      if (!operation && !alias) {
        const gone = byRemoved.get(name);
        return fail(
          'unknown-operation',
          gone
            ? removedNameMessage(gone)
            : `Unknown operation "${name}". Known: ${[...byName.keys()].join(', ')}.`
        );
      }
      const target = (operation ?? byName.get(alias?.targets[0] as string)) as Operation;
      const bytes = jsonBytes(input);
      if (bytes === undefined)
        return fail(
          'invalid-input',
          'Invalid input: it must be plain JSON (no cycles).',
          target.name
        );
      if (bytes > target.limits.inputBytes)
        return fail(
          'input-too-large',
          `Input is ${bytes} bytes; ${target.name} accepts at most ${target.limits.inputBytes}.`,
          target.name
        );
      const record = input as Record<string, unknown>;
      if (operation) return run(operation, record, options);

      const legacy = alias as OperationAlias;
      if (legacy.input) {
        const issues = validateJson(legacy.input, record);
        if (issues.length > 0)
          return fail(
            'invalid-input',
            `Invalid input for ${legacy.name}: ${issues.map((i) => i.message).join(' ')}`,
            target.name,
            issues
          );
      }
      const routed = legacy.route ? legacy.route(record) : { name: target.name, input: record };
      const resolved = byName.get(routed.name);
      if (!resolved || !legacy.targets.includes(routed.name))
        return fail('unknown-operation', `Alias ${legacy.name} has no route to "${routed.name}".`);
      return run(resolved, routed.input, options);
    },
  };
  return registry;
}
