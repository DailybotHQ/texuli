// @vitest-environment node
import { expect, it } from 'vitest';
import { parseDeckCliArgs } from '../src/cli/deck.ts';
import { DECK_COMMANDS, runDeckCommand } from '../src/deck/index.ts';
import { createTexuliMcpServer, MCP_PROTOCOL_VERSION } from '../src/mcp/index.ts';

const fixture = {
  formatVersion: 2,
  meta: { title: 'Fictional deck', locale: 'en' },
  slides: [
    {
      id: 'opening',
      title: 'Opening',
      notes: 'Presenter guidance: introduce the topic and invite questions from the room.',
      layout: 'title-hero',
      props: { title: 'A clear opening', subtitle: 'A fictional example', meta: 'Example team' },
    },
  ],
};

it('serves every CLI command from the shared deck model and codecs', () => {
  expect(DECK_COMMANDS).toEqual([
    'capabilities',
    'schema',
    'layouts',
    'lint',
    'inspect',
    'from-markdown',
    'to-markdown',
  ]);
  expect(runDeckCommand('capabilities')).toMatchObject({
    formatVersion: 2,
    commands: DECK_COMMANDS,
  });
  expect(runDeckCommand('schema')).toMatchObject({
    $schema: expect.stringContaining('2020-12'),
    $defs: expect.any(Object),
  });
  expect((runDeckCommand('layouts') as { layouts: unknown[] }).layouts.length).toBeGreaterThan(10);
  expect(runDeckCommand('lint', { deck: fixture })).toMatchObject({
    ok: true,
    errors: 0,
    warnings: 0,
  });
  expect(runDeckCommand('inspect', { deck: fixture })).toMatchObject({
    ok: true,
    slideCount: 1,
    slideRefs: { opening: { index: 0 } },
  });

  const markdown = runDeckCommand('to-markdown', { deck: fixture }) as {
    ok: boolean;
    markdown: string;
  };
  expect(markdown.ok).toBe(true);
  const imported = runDeckCommand('from-markdown', { markdown: markdown.markdown }) as {
    ok: boolean;
    deck: unknown;
  };
  expect(imported).toMatchObject({ ok: true, deck: fixture });
});

it('returns actionable failures and parses the texuli-deck CLI surface strictly', () => {
  expect(runDeckCommand('from-markdown', { markdown: '<script>alert(1)</script>' })).toMatchObject({
    ok: false,
  });
  expect(runDeckCommand('to-markdown', { deck: { bad: true } })).toMatchObject({ ok: false });
  expect(parseDeckCliArgs(['lint', '--file', 'deck.json'])).toMatchObject({
    command: 'lint',
    file: 'deck.json',
  });
  expect(parseDeckCliArgs(['from-markdown', '--text', '---'])).toMatchObject({
    command: 'from-markdown',
    text: '---',
  });
  expect(() => parseDeckCliArgs(['lint', '--unknown'])).toThrow(/Unknown deck flag/u);
  expect(() => parseDeckCliArgs(['lint', '--text', 'x', '--file', 'y'])).toThrow(
    /either --file or --text/u
  );
  expect(() => parseDeckCliArgs(['lint', '--file'])).toThrow(/needs a path/u);
});

it('registers a closed, read-only MCP deck tool with CLI command parity', async () => {
  const handle = createTexuliMcpServer();
  await handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: MCP_PROTOCOL_VERSION },
  });
  await handle({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const listed = (await handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })) as unknown as {
    result: {
      tools: {
        name: string;
        inputSchema: { additionalProperties: boolean; properties: { command: { enum: string[] } } };
        annotations: { readOnlyHint: boolean };
      }[];
    };
  };
  const tool = listed.result.tools.find((item) => item.name === 'deck');
  expect(tool?.inputSchema.additionalProperties).toBe(false);
  expect(tool?.inputSchema.properties.command.enum).toEqual(DECK_COMMANDS);
  expect(tool?.annotations.readOnlyHint).toBe(true);
  const result = (await handle({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'deck', arguments: { command: 'inspect', deck: fixture } },
  })) as unknown as { result: { content: { text: string }[] } };
  expect(JSON.parse(result.result.content[0]!.text)).toMatchObject({
    result: { ok: true, slideCount: 1 },
  });
  const invalid = (await handle({
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: { name: 'deck', arguments: { command: 'lint', filepath: '/tmp/deck.json' } },
  })) as { result: { isError?: boolean } };
  expect(invalid.result.isError).toBe(true);
});
