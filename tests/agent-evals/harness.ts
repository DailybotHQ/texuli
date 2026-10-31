/**
 * The agent-evals harness (T-agent-evals, architecture A.7): scripted MCP
 * sessions replayed against the real doors, with no model in the loop. A
 * session is a list of JSON-RPC steps (method, params, assertions on the
 * result) and a final assertion; a step's params may read earlier results,
 * the way an agent reads one answer before it sends the next call.
 *
 * Two doors run every session:
 * - `stdio`: `createMcpHandler` in `stateful` mode with the runtimes the
 *   stdio server serves (`edge` and `node`), one handler per session, each
 *   message and answer round-tripped through JSON as on the wire;
 * - `remote`: the Pages Function itself (`functions/mcp.ts` `onRequest`,
 *   which calls `handleMcpHttp` with the Function's own deps), driven with
 *   real `Request` objects, so the headers, the limits and the stateless
 *   path all run, with a fake `env.ASSETS` (the fixture site of
 *   `packages/tools/tests/fixtures/site-assets.ts`) for the `site`
 *   operations. Every answer's transport is checked before its body.
 *
 * Nothing here calls a model or the network.
 */
import { expect } from 'vitest';
import { onRequest } from '../../functions/mcp.ts';
import { localFiles } from '../../packages/tools/src/internal/local-write.ts';
import { createMcpHandler } from '../../packages/tools/src/mcp/handler.ts';
import { MCP_PROTOCOL_VERSION } from '../../packages/tools/src/mcp/protocol.ts';
import {
  LOCAL_RUNTIMES,
  type OperationRuntime,
  REMOTE_RUNTIMES as REMOTE_DOOR_RUNTIMES,
  texuliOps,
} from '../../packages/tools/src/ops/index.ts';
import { fakeSiteAssets } from '../../packages/tools/tests/fixtures/site-assets.ts';

// biome-ignore lint/suspicious/noExplicitAny: JSON-RPC results are untyped JSON an eval inspects.
export type Json = any;

export type DoorName = 'stdio' | 'remote';

/** One JSON-RPC exchange as the harness recorded it. */
export interface Exchange {
  label: string;
  method: string;
  params: Json;
  /** The JSON-RPC response (undefined for a notification). */
  response: Json;
}

/** What a step's params and assertions can read. */
export interface SessionContext {
  door: DoorName;
  /** The runtime classes this door serves. */
  runtimes: readonly OperationRuntime[];
  /** The `initialize` result of the handshake. */
  initialize: Json;
  /** The JSON-RPC result of an earlier step, by label. */
  result(label: string): Json;
  /** The `structuredContent` of an earlier `tools/call` step, by label. */
  data(label: string): Json;
  /** Every exchange so far, in order. */
  transcript: readonly Exchange[];
}

export interface Step {
  /** Unique within the session; later steps read results by it. */
  label: string;
  method: string;
  params?: Record<string, unknown> | ((ctx: SessionContext) => Json);
  /** Assert on the JSON-RPC result. A `tools/call` result must not be `isError` unless `toolError` is set. */
  expect?: (result: Json, ctx: SessionContext) => void | Promise<void>;
  /** The step expects a tool failure (`isError`); assert on its parsed `{ error, code, issues }`. */
  toolError?: (failure: Json, ctx: SessionContext) => void;
  /** The step expects a JSON-RPC error; assert on it. */
  rpcError?: (error: Json, ctx: SessionContext) => void;
}

/** A step, or a function that decides the next steps from what came back so far. */
export type Script = Step | ((ctx: SessionContext) => Script[]);

export interface Session {
  /** The job, in a few words: the test name. */
  name: string;
  steps: Script[];
  /** Runs after every step: the job's outcome. */
  final: (ctx: SessionContext) => void | Promise<void>;
  /** Present when the session cannot run yet: the reason it is skipped. */
  skip?: string;
  /** The doors that serve the job (default both); `site` jobs run on the remote door only. */
  doors?: readonly DoorName[];
}

/** A transport the harness can talk JSON-RPC through. */
interface Door {
  name: DoorName;
  runtimes: readonly OperationRuntime[];
  send(message: Json, protocolVersion?: string): Promise<Json>;
}

/** The runtimes the stdio server serves (`packages/tools/src/mcp/stdio.ts`). */
export const STDIO_RUNTIMES: readonly OperationRuntime[] = LOCAL_RUNTIMES;
/** The runtimes the remote Function serves (`functions/_lib/mcp-server.ts`). */
export const REMOTE_RUNTIMES: readonly OperationRuntime[] = REMOTE_DOOR_RUNTIMES;

const SECURITY_HEADERS: Record<string, string> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
};

/**
 * The local door: one stateful handler per session, as `texuli-mcp` builds
 * it, with the local writer `ds.save` uses (the sessions only dry-run it).
 */
function stdioDoor(): Door {
  const handle = createMcpHandler({
    mode: 'stateful',
    runtimes: STDIO_RUNTIMES,
    files: localFiles(),
  });
  return {
    name: 'stdio',
    runtimes: STDIO_RUNTIMES,
    async send(message) {
      const wire = JSON.parse(JSON.stringify(message)) as unknown;
      const answer = await handle(wire);
      return answer === undefined ? undefined : JSON.parse(JSON.stringify(answer));
    },
  };
}

// Each remote session is its own client, so the per-isolate token bucket
// (60 messages per client per minute) never couples two sessions.
let clients = 0;

/** The remote door: the Pages Function with real `Request` objects. */
function remoteDoor(): Door {
  const ip = `203.0.113.${(clients++ % 250) + 1}`;
  const assets = fakeSiteAssets();
  return {
    name: 'remote',
    runtimes: REMOTE_RUNTIMES,
    async send(message, protocolVersion) {
      const request = new Request('https://texuli.com/mcp', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'cf-connecting-ip': ip,
          ...(protocolVersion ? { 'mcp-protocol-version': protocolVersion } : {}),
        },
        body: JSON.stringify(message),
      });
      const response = await onRequest({ request, env: { ASSETS: assets } });
      const label = `remote ${String((message as { method?: unknown }).method)}`;
      for (const [name, value] of Object.entries(SECURITY_HEADERS))
        expect(response.headers.get(name), `${label}: ${name}`).toBe(value);
      expect(response.headers.get('mcp-session-id'), `${label}: stateless`).toBeNull();
      expect(response.headers.get('ratelimit-policy'), `${label}: rate policy`).toMatch(
        /^"mcp";q=\d+;w=\d+$/u
      );
      expect(response.headers.get('ratelimit'), `${label}: rate state`).toMatch(
        /^"mcp";r=\d+;t=\d+$/u
      );
      const notification = typeof message === 'object' && message !== null && !('id' in message);
      if (notification) {
        expect(response.status, `${label}: notification`).toBe(202);
        expect(await response.text(), `${label}: empty body`).toBe('');
        return undefined;
      }
      expect(response.status, label).toBe(200);
      expect(response.headers.get('content-type'), label).toBe('application/json');
      return response.json();
    },
  };
}

export const DOORS: Record<DoorName, () => Door> = { stdio: stdioDoor, remote: remoteDoor };

/** The handshake every MCP client sends first. */
const INITIALIZE = {
  protocolVersion: MCP_PROTOCOL_VERSION,
  capabilities: {},
  clientInfo: { name: 'texuli-agent-evals', version: '0.0.0' },
};

/** Parse the failure an `isError` tool result carries in its text content. */
export function toolFailure(result: Json): Json {
  return JSON.parse(result.content[0].text);
}

/**
 * Replay one session on one door: the handshake, then every step with its
 * assertions, then the final assertion. Returns the transcript.
 */
export async function runSession(session: Session, doorName: DoorName): Promise<Exchange[]> {
  const door = DOORS[doorName]();
  const transcript: Exchange[] = [];
  const results = new Map<string, Json>();
  let nextId = 1;

  const initResponse = await door.send({
    jsonrpc: '2.0',
    id: nextId++,
    method: 'initialize',
    params: INITIALIZE,
  });
  expect(initResponse.error, `${doorName}: initialize`).toBeUndefined();
  const initialize = initResponse.result;
  const version: string = initialize.protocolVersion;
  expect(
    await door.send({ jsonrpc: '2.0', method: 'notifications/initialized' }, version)
  ).toBeUndefined();
  transcript.push({
    label: 'initialize',
    method: 'initialize',
    params: INITIALIZE,
    response: initResponse,
  });

  const ctx: SessionContext = {
    door: doorName,
    runtimes: door.runtimes,
    initialize,
    transcript,
    result(label) {
      if (!results.has(label)) throw new Error(`No result for step "${label}" yet.`);
      return results.get(label);
    },
    data(label) {
      const result = ctx.result(label);
      if (result.structuredContent === undefined)
        throw new Error(`Step "${label}" has no structuredContent.`);
      return result.structuredContent;
    },
  };

  const queue: Script[] = [...session.steps];
  while (queue.length > 0) {
    const script = queue.shift() as Script;
    if (typeof script === 'function') {
      queue.unshift(...script(ctx));
      continue;
    }
    const step = script;
    const where = `[${session.name} · ${doorName} · ${step.label}]`;
    if (results.has(step.label)) throw new Error(`${where} duplicate step label.`);
    const params = typeof step.params === 'function' ? step.params(ctx) : step.params;
    const message = {
      jsonrpc: '2.0',
      id: nextId++,
      method: step.method,
      ...(params === undefined ? {} : { params }),
    };
    const response = await door.send(message, version);
    transcript.push({ label: step.label, method: step.method, params, response });

    if (step.rpcError) {
      expect(response.error, `${where} expected a JSON-RPC error`).toBeDefined();
      step.rpcError(response.error, ctx);
      results.set(step.label, response.error);
      continue;
    }
    expect(response.error, `${where} JSON-RPC error`).toBeUndefined();
    const result = response.result;
    results.set(step.label, result);
    if (step.method === 'tools/call') {
      if (step.toolError) {
        expect(result.isError, `${where} expected isError`).toBe(true);
        step.toolError(toolFailure(result), ctx);
        continue;
      }
      expect(result.isError, `${where} ${result.isError ? result.content[0].text : ''}`).not.toBe(
        true
      );
      expect(result.structuredContent, `${where} structuredContent`).toBeDefined();
      expect(JSON.parse(result.content[0].text), `${where} text mirrors structuredContent`).toEqual(
        result.structuredContent
      );
    }
    try {
      await step.expect?.(result, ctx);
    } catch (error) {
      if (error instanceof Error) error.message = `${where} ${error.message}`;
      throw error;
    }
  }
  try {
    await session.final(ctx);
  } catch (error) {
    if (error instanceof Error)
      error.message = `[${session.name} · ${doorName} · final] ${error.message}`;
    throw error;
  }
  return transcript;
}

/** The operation a tool name runs (an alias resolves through its targets), or undefined. */
function runtimesOf(toolName: string): OperationRuntime[] {
  const operation = texuliOps.get(toolName);
  if (operation) return [operation.runtime];
  const alias = texuliOps.aliases().find((item) => item.name === toolName);
  return alias
    ? alias.targets.map((target) => texuliOps.get(target)?.runtime as OperationRuntime)
    : [];
}

/** True when every operation the tool can reach runs at the edge. */
export function isEdgeTool(toolName: string): boolean {
  const runtimes = runtimesOf(toolName);
  return runtimes.length > 0 && runtimes.every((runtime) => runtime === 'edge');
}

/**
 * Compare two transcripts of one session: every `tools/call` of an edge
 * operation must return the identical result (structured content, text and
 * isError) on both doors. Returns how many calls were compared.
 */
export function assertEdgeParity(
  session: string,
  stdio: readonly Exchange[],
  remote: readonly Exchange[]
): number {
  expect(
    remote.map((item) => item.label),
    `${session}: same script on both doors`
  ).toEqual(stdio.map((item) => item.label));
  let compared = 0;
  stdio.forEach((local, index) => {
    const other = remote[index] as Exchange;
    if (local.method !== 'tools/call' || !isEdgeTool(local.params.name)) return;
    expect(other.params, `${session} · ${local.label}: same call`).toEqual(local.params);
    expect(other.response, `${session} · ${local.label}: identical edge result`).toEqual(
      local.response
    );
    compared += 1;
  });
  return compared;
}

/** Every tool name a prompt or instruction text names in backticks (`group.verb`). */
export function backtickedTools(text: string): string[] {
  return [...text.matchAll(/`([a-z][a-z0-9]*\.[a-z][a-z0-9-]*)`/gu)].map(
    (match) => match[1] as string
  );
}

/** Every `texuli://` URI or URI template a text names. */
export function texuliUris(text: string): string[] {
  return [...text.matchAll(/texuli:\/\/[a-z0-9/{}-]+/gu)].map((match) =>
    match[0].replace(/[.]$/u, '')
  );
}
