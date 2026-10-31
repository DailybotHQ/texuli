// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createMcpHandler } from '../../packages/tools/src/mcp/handler.ts';
import {
  MCP_STATELESS_PROTOCOL_VERSIONS,
  MCP_SUPPORTED_PROTOCOL_VERSIONS,
} from '../../packages/tools/src/mcp/protocol.ts';
import { REMOTE_RUNTIMES, TOOLS_VERSION, texuliOps } from '../../packages/tools/src/ops/index.ts';
import {
  buildMcpPageData,
  buildOpsTables,
  buildServerCard,
  OPS_MARKER_END,
  OPS_MARKER_START,
  REMOTE_MCP_URL,
  spliceOpsDoc,
  toolNames,
  toolsLlmsSection,
} from '../agent-surfaces.ts';
import { buildSurfaces, ROOT, SURFACE_PATHS, surfaceDrift } from '../generate-surfaces.ts';

let temp: string | undefined;
afterEach(() => {
  if (temp) rmSync(temp, { recursive: true, force: true });
  temp = undefined;
});

async function remoteToolNames(): Promise<string[]> {
  const handler = createMcpHandler({ mode: 'stateless', runtimes: REMOTE_RUNTIMES });
  const response = (await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as {
    result: { tools: { name: string }[]; nextCursor?: string };
  };
  expect(response.result.nextCursor).toBeUndefined();
  return response.result.tools.map((tool) => tool.name);
}

describe('generated agent surfaces', () => {
  it('the server card names every operation with its title, summary and runtime, both transports, the protocol versions, the package version and flat capabilities; its remote flags equal what the edge handler lists', async () => {
    const card = await buildServerCard();
    expect(card.serverInfo.version).toBe(TOOLS_VERSION);
    expect(card.protocolVersions).toEqual([...MCP_SUPPORTED_PROTOCOL_VERSIONS]);
    // The 2026-07-28 revision: per request through params._meta, no initialize (G124).
    expect(card.statelessProtocolVersions).toEqual(['2026-07-28']);
    expect(card.statelessProtocolVersions).toEqual([...MCP_STATELESS_PROTOCOL_VERSIONS]);
    expect(card.transport.streamableHttp.url).toBe(REMOTE_MCP_URL);
    expect(card.transport.stdio.launch).toBe('npx -y @texuli/mcp');
    expect(card.capabilities.every((name) => typeof name === 'string')).toBe(true);
    expect(card.capabilities).toContain('tools');
    expect(card.tools.map((tool) => tool.name)).toEqual(texuliOps.list().map((op) => op.name));
    for (const tool of card.tools) {
      const operation = texuliOps.get(tool.name);
      expect(tool).toMatchObject({
        title: operation?.title,
        description: operation?.summary,
        runtime: operation?.runtime,
      });
    }
    expect(card.deprecatedTools.map((alias) => alias.name)).toEqual(
      texuliOps.aliases().map((alias) => alias.name)
    );
    // The 0.8 names removed in 0.10.0, with what to call instead.
    expect(card.removedTools).toEqual(
      texuliOps.removed().map((entry) => ({
        name: entry.name,
        replacedBy: [...entry.replacedBy],
        removedIn: entry.removedIn,
      }))
    );
    expect(card.removedTools.map((entry) => entry.name)).toEqual([
      'deck',
      'document',
      'catalog',
      'component',
      'validate',
      'example',
      'theme',
    ]);
    const remote = [
      ...card.tools.filter((tool) => tool.remote).map((tool) => tool.name),
      ...card.deprecatedTools.filter((alias) => alias.remote).map((alias) => alias.name),
    ];
    expect(remote).toEqual(await remoteToolNames());
    expect(toolNames(texuliOps, REMOTE_RUNTIMES)).toEqual(await remoteToolNames());
    expect(remote).not.toContain('document.export');
    // The site operations are remote-only on the card (T-ar-site-mcp).
    const site = card.tools.filter((tool) => tool.runtime === 'site');
    expect(site.map((tool) => tool.name)).toEqual(['site.pages', 'site.read', 'site.search']);
    for (const tool of site) expect(tool).toMatchObject({ remote: true, local: false });
    expect(card.tools.filter((tool) => !tool.local).map((tool) => tool.runtime)).toEqual([
      'site',
      'site',
      'site',
    ]);
    expect(card.transport.stdio.operations).toBe('edge, node');
    expect(card.transport.streamableHttp.operations).toBe('edge, site');
    expect(buildOpsTables()).toContain('| site | remote MCP only | — |');
  });

  it('the llms Tools section, the ops.md tables and the /mcp-server/ data list every operation', async () => {
    const names = texuliOps.list().map((op) => op.name);
    const section = toolsLlmsSection('https://texuli.com');
    expect(section.links.slice(1).map((link) => link.title)).toEqual(names);
    // No parenthesized link to the Function: the AEO audit resolves llms links against dist.
    expect(section.links.map((link) => link.href)).not.toContain(REMOTE_MCP_URL);
    const tables = buildOpsTables();
    for (const name of names) expect(tables).toContain(`| \`${name}\` |`);
    for (const alias of texuliOps.aliases()) expect(tables).toContain(`| \`${alias.name}\` |`);
    for (const entry of texuliOps.removed()) expect(tables).toContain(`| \`${entry.name}\` |`);
    const data = await buildMcpPageData();
    expect(data.tools.map((tool) => tool.name)).toEqual(names);
    expect(data.prompts.map((prompt) => prompt.name)).toContain('build-ui');
    expect(data.resourceTemplates.map((t) => t.uriTemplate)).toContain('texuli://component/{id}');
    // Per-item resources stay out of the page data; the templates cover them.
    expect(data.resources.every((r) => !/texuli:\/\/(component|docs|theme)\//u.test(r.uri))).toBe(
      true
    );
  });

  it('splices only between the markers and refuses a doc without them', () => {
    const doc = `# Ops\n\nkept\n\n${OPS_MARKER_START}\nstale\n${OPS_MARKER_END}\n\nafter\n`;
    expect(spliceOpsDoc(doc, 'TABLE')).toBe(
      `# Ops\n\nkept\n\n${OPS_MARKER_START}\n\nTABLE\n\n${OPS_MARKER_END}\n\nafter\n`
    );
    expect(() => spliceOpsDoc('# Ops\n', 'TABLE')).toThrow(/no surfaces:operations markers/u);
  });

  it('surfaceDrift names a changed, a truncated and a missing file with the first differing line', () => {
    temp = mkdtempSync(join(tmpdir(), 'texuli-surfaces-test-'));
    const root = join(temp, 'root');
    const generated = join(temp, 'generated');
    for (const dir of [root, generated]) mkdirSync(dir, { recursive: true });
    writeFileSync(join(generated, 'a.txt'), 'one\ntwo\n');
    writeFileSync(join(root, 'a.txt'), 'one\ntwo\n');
    writeFileSync(join(generated, 'b.txt'), 'one\ntwo\n');
    writeFileSync(join(root, 'b.txt'), 'one\nTWO\n');
    writeFileSync(join(generated, 'c.txt'), 'one\ntwo\n');
    writeFileSync(join(root, 'c.txt'), 'one\n');
    writeFileSync(join(generated, 'd.txt'), 'x\n');
    const drift = surfaceDrift(root, generated, ['a.txt', 'b.txt', 'c.txt', 'd.txt']);
    expect(drift).toHaveLength(3);
    expect(drift[0]).toMatch(/^b\.txt:2 differs.*\n.*"TWO"\n.*"two"/u);
    expect(drift[1]).toMatch(/^c\.txt:2 differs/u);
    expect(drift[2]).toMatch(/^d\.txt: missing/u);
  });

  it('the committed surfaces are exactly what the registry generates (pnpm check:surfaces)', async () => {
    const files = await buildSurfaces();
    expect([...files.keys()].sort()).toEqual(Object.values(SURFACE_PATHS).sort());
    for (const [path, text] of files)
      expect(readFileSync(join(ROOT, path), 'utf8'), path).toBe(text);
  }, 60_000);
});
