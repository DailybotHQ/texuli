/**
 * The scripted agent jobs (T-agent-evals). Each session is what an agent
 * that knows nothing but the MCP would send: it searches, reads what came
 * back, builds its next call from it, and checks its own output with the
 * server's validators. Data is fictional (example.com, Example Co.).
 */
import { expect } from 'vitest';
import { texuliOps } from '../../packages/tools/src/ops/index.ts';
import {
  backtickedTools,
  type Json,
  type Script,
  type Session,
  type SessionContext,
  type Step,
  texuliUris,
} from './harness.ts';

const call = (name: string, args: Json) => ({ name, arguments: args });

/** The tool names the door's `tools/list` returned (the discovery step of each session). */
function listedTools(ctx: SessionContext): string[] {
  return ctx.result('tools').tools.map((tool: Json) => tool.name);
}

/** The tools this door must serve: its operations, then the aliases whose targets it serves. */
function expectedTools(ctx: SessionContext): string[] {
  const served = texuliOps.list({ runtimes: ctx.runtimes }).map((operation) => operation.name);
  const aliases = texuliOps
    .aliases()
    .filter((alias) => alias.targets.every((target) => served.includes(target)))
    .map((alias) => alias.name);
  return [...served, ...aliases];
}

const toolsStep: Script = {
  label: 'tools',
  method: 'tools/list',
  expect(result, ctx) {
    expect(result.nextCursor).toBeUndefined();
    expect(result.tools.map((tool: Json) => tool.name)).toEqual(expectedTools(ctx));
  },
};

// ---------------------------------------------------------------------------
// Job 1: a pricing page, from catalog search to a validated blueprint.
// ---------------------------------------------------------------------------

/** The words a person would use for a pricing page. */
const PRICING_WORDS = ['pricing', 'card', 'button', 'table'] as const;
/** The words the agent searches again at the untrusted tier, and the id it keeps for each. */
const UNTRUSTED_PICKS = {
  page: 'layout-page',
  heading: 'blocks-text',
  grid: 'layout-grid',
  card: 'layout-card',
  action: 'blocks-structure',
  table: 'blocks-data',
} as const;

const PLANS = [
  { name: 'Free', price: '$0 per month' },
  { name: 'Team', price: '$12 per seat' },
  { name: 'Business', price: '$29 per seat' },
] as const;

/** The first example's props of a component the agent read with component.get. */
function exampleProps(ctx: SessionContext, id: string): Json {
  const component = ctx.data(`get ${id}`).component;
  expect(component.examples.length, `${id} has a worked example`).toBeGreaterThan(0);
  return structuredClone(component.examples[0].props);
}

interface PricingOptions {
  cardId?: string;
  cardProps?: Json;
  href?: string;
  table?: Json;
}

/** Assemble the pricing tree from the manifests' examples (and, for variants, a mistake). */
function pricingTree(ctx: SessionContext, options: PricingOptions = {}): Json {
  const page = exampleProps(ctx, 'layout-page');
  const heading = exampleProps(ctx, 'blocks-text');
  const grid = exampleProps(ctx, 'layout-grid');
  const card = exampleProps(ctx, 'layout-card');
  const cta = exampleProps(ctx, 'blocks-structure');
  const data = exampleProps(ctx, 'blocks-data');
  const action = cta.block.actions[0];
  return {
    id: 'layout-page',
    props: { ...page, title: 'Pricing', description: 'Plans for teams of every size.' },
    children: [
      {
        id: 'blocks-text',
        props: { block: { ...heading.block, text: 'Simple plans for Example Co. teams' } },
      },
      {
        id: 'layout-grid',
        props: { ...grid, columns: PLANS.length },
        children: PLANS.map((plan) => ({
          id: options.cardId ?? 'layout-card',
          props: options.cardProps ?? { ...card, title: plan.name },
          children: [
            {
              id: 'blocks-text',
              props: { block: { ...heading.block, level: 3, text: plan.price } },
            },
            {
              id: 'blocks-structure',
              props: {
                block: {
                  ...cta.block,
                  actions: [
                    {
                      ...action,
                      label: `Choose ${plan.name}`,
                      href:
                        options.href ??
                        `https://example.com/signup?plan=${plan.name.toLowerCase()}`,
                    },
                  ],
                },
              },
            },
          ],
        })),
      },
      {
        id: 'blocks-data',
        props: {
          ...data,
          block: options.table ?? protocolTable(ctx),
        },
      },
    ],
  };
}

/**
 * The comparison table, written only from what block.list and block.schema
 * returned: the type blocks-data renders, the required column fields, the
 * cell types a row accepts and the optional caption.
 */
function protocolTable(ctx: SessionContext): Json {
  const types = ctx.data('blocks of blocks-data').blocks.map((block: Json) => block.type);
  expect(types).toContain('table');
  const { schema, shape } = ctx.data('block table');
  const column = schema.properties.columns.items;
  expect(column.required, shape).toEqual(['id', 'label']);
  const row = schema.properties.rows.items;
  expect(row.$comment, shape).toMatch(/ids declared elsewhere/u);
  expect(row.additionalProperties.type).toEqual(expect.arrayContaining(['string', 'number']));
  expect(schema.required).toEqual(expect.arrayContaining(['type', 'columns', 'rows']));
  const columns = [
    { id: 'feature', label: 'Feature' },
    ...PLANS.map((plan) => ({ id: plan.name.toLowerCase(), label: plan.name })),
  ];
  const rows = [
    ['Boards', 3, 'Unlimited', 'Unlimited'],
    ['Weekly digests', 'No', 'Yes', 'Yes'],
  ].map((cells) => Object.fromEntries(columns.map((item, index) => [item.id, cells[index]])));
  return {
    type: 'table',
    ...(schema.properties.caption ? { caption: 'Compare plans' } : {}),
    columns,
    rows,
  };
}

/** Every node of a catalog tree, depth first. */
function nodes(tree: Json): Json[] {
  return [tree, ...(tree.children ?? []).flatMap(nodes)];
}

const validateStep = (
  label: string,
  draft: (ctx: SessionContext) => Json,
  check: (output: Json) => void
): Script => ({
  label,
  method: 'tools/call',
  params: (ctx) => call('blueprint.validate', { draft: draft(ctx), tier: 'untrusted' }),
  expect: (result) => check(result.structuredContent),
});

/** The error codes of a validation, in order. */
const codes = (output: Json) => output.diagnostics.map((item: Json) => item.code);

const pricingPage: Session = {
  name: 'pricing page: catalog.search → component.get → blueprint.validate',
  steps: [
    toolsStep,
    ...PRICING_WORDS.map(
      (word): Script => ({
        label: `search ${word}`,
        method: 'tools/call',
        params: call('catalog.search', { query: word, limit: 10 }),
        expect(result) {
          expect(result.structuredContent.total, word).toBeGreaterThan(0);
          expect(result.structuredContent.hash).toMatch(/^[0-9a-f]{64}$/u);
        },
      })
    ),
    // Read the best hit of each word: the exact id when there is one.
    (ctx) =>
      PRICING_WORDS.map((word): Script => {
        const entries = ctx.data(`search ${word}`).entries;
        const best = entries.find((entry: Json) => entry.id === word) ?? entries[0];
        return {
          label: `first look ${word}`,
          method: 'tools/call',
          params: call('component.get', { id: best.id }),
        };
      }),
    // The first hits are app-authored components: their emit list says agent output may not place them.
    (ctx) => {
      const firstLooks = PRICING_WORDS.map((word) => ctx.data(`first look ${word}`).component);
      const refused = firstLooks.filter((component) => !component.emit.includes('untrusted'));
      expect(refused.map((component) => component.id)).toEqual(
        expect.arrayContaining(['layout-pricing', 'card', 'button'])
      );
      return Object.keys(UNTRUSTED_PICKS).map(
        (word): Script => ({
          label: `untrusted search ${word}`,
          method: 'tools/call',
          params: call('catalog.search', { query: word, tier: 'untrusted', limit: 20 }),
          expect(result) {
            const ids = result.structuredContent.entries.map((entry: Json) => entry.id);
            expect(ids, word).toContain(UNTRUSTED_PICKS[word as keyof typeof UNTRUSTED_PICKS]);
            for (const entry of result.structuredContent.entries)
              expect(entry.emit, entry.id).toContain('untrusted');
          },
        })
      );
    },
    ...Object.values(UNTRUSTED_PICKS).map(
      (id): Script => ({
        label: `get ${id}`,
        method: 'tools/call',
        params: call('component.get', { id }),
        expect(result) {
          const component = result.structuredContent.component;
          expect(component.id).toBe(id);
          expect(component.emit).toContain('untrusted');
          expect(component.useWhen.length, `${id} useWhen`).toBeGreaterThan(0);
        },
      })
    ),
    // The table block's shape comes from the protocol, not from guessing.
    {
      label: 'blocks of blocks-data',
      method: 'tools/call',
      params: call('block.list', { component: 'blocks-data' }),
    },
    {
      label: 'block table',
      method: 'tools/call',
      params: call('block.schema', { type: 'table' }),
      expect(result) {
        expect(result.structuredContent).toMatchObject({
          type: 'table',
          component: 'blocks-data',
          usableInBlueprint: true,
        });
      },
    },
    validateStep('validate', pricingTree, (output) => {
      expect(output.diagnostics).toEqual([]);
      expect(output).toMatchObject({ valid: true, status: 'valid', tier: 'untrusted' });
    }),
    // Variants an agent gets wrong, each refused with the diagnostic that says why.
    validateStep(
      'invalid: first-hit card',
      (ctx) =>
        pricingTree(ctx, {
          cardId: 'card',
          cardProps: structuredClone(ctx.data('first look card').component.examples[0].props),
        }),
      (output) => {
        expect(output.valid).toBe(false);
        expect(output.diagnostics).toHaveLength(PLANS.length);
        for (const diagnostic of output.diagnostics)
          expect(diagnostic).toMatchObject({
            check: 'render',
            code: 'tier-denied',
            severity: 'error',
            id: 'card',
          });
        expect(output.diagnostics.map((item: Json) => item.path)).toEqual([
          '0.children.1.children.0',
          '0.children.1.children.1',
          '0.children.1.children.2',
        ]);
      }
    ),
    validateStep(
      'invalid: prop from another manifest',
      (ctx) => pricingTree(ctx, { cardProps: { title: 'Team', variant: 'elevated' } }),
      (output) => {
        expect(output.valid).toBe(false);
        expect(new Set(codes(output))).toEqual(new Set(['invalid-prop']));
        expect(output.diagnostics[0].message).toMatch(/Unknown prop "variant"/u);
      }
    ),
    validateStep(
      'invalid: script link',
      (ctx) => pricingTree(ctx, { href: 'javascript:alert(document.domain)' }),
      (output) => {
        expect(output.valid).toBe(false);
        expect(codes(output)).toEqual(expect.arrayContaining(['sink', 'block-schema']));
        const sink = output.diagnostics.find((item: Json) => item.code === 'sink');
        expect(sink.path).toMatch(/props\.block\.actions\[0\]\.href$/u);
      }
    ),
    validateStep(
      'invalid: guessed table shape',
      (ctx) =>
        pricingTree(ctx, {
          table: { type: 'table', columns: ['Feature', 'Free'], rows: [['Boards', '3']] },
        }),
      (output) => {
        expect(output.valid).toBe(false);
        expect(codes(output)).toEqual(['block-schema']);
        expect(output.diagnostics[0]).toMatchObject({ id: 'blocks-data', path: '0.children.2' });
        // The diagnostic names the expected shape, so the agent can repair it from the message.
        expect(output.diagnostics[0].message).toMatch(/columns\.0/u);
        expect(output.diagnostics[0].message).toContain('{ id: string, label: string }');
        expect(output.diagnostics[0].message).toContain('block.schema');
      }
    ),
  ],
  final(ctx) {
    expect(ctx.data('validate').valid).toBe(true);
    // The agent only used ids and prop names the manifests it read declare.
    const tree = pricingTree(ctx);
    for (const node of nodes(tree)) {
      const manifest = ctx.data(`get ${node.id}`).component;
      const declared = manifest.props.map((prop: Json) => prop.name);
      for (const prop of Object.keys(node.props ?? {}))
        expect(declared, `${node.id}.${prop}`).toContain(prop);
    }
    // Every search ran against the same content-addressed catalog.
    const hashes = new Set(
      ctx.transcript
        .filter((item) => item.params?.name === 'catalog.search')
        .map((item) => item.response.result.structuredContent.hash)
    );
    expect(hashes.size).toBe(1);
  },
};

// ---------------------------------------------------------------------------
// Job 2: theme a blueprint.
// ---------------------------------------------------------------------------

const MOOD = 'calm';
const MODE = 'dark';

const themeBlueprint: Session = {
  name: 'theme a blueprint: prompts/get theme-blueprint → theme.search → theme.get → theme.preview',
  steps: [
    toolsStep,
    {
      label: 'prompt',
      method: 'prompts/get',
      params: {
        name: 'theme-blueprint',
        arguments: { brief: 'A calm analytics dashboard for Example Co.', mode: MODE },
      },
      expect(result, ctx) {
        const text: string = result.messages
          .map((message: Json) => message.content.text)
          .join('\n');
        expect(text).toContain('A calm analytics dashboard for Example Co.');
        expect(text).toContain(`mode "${MODE}"`);
        const named = backtickedTools(text);
        expect(named).toEqual(
          expect.arrayContaining(['theme.search', 'theme.preview', 'theme.get'])
        );
        for (const tool of named) expect(listedTools(ctx), tool).toContain(tool);
      },
    },
    { label: 'templates', method: 'resources/templates/list' },
    {
      label: 'search',
      method: 'tools/call',
      params: call('theme.search', { mood: MOOD, limit: 5 }),
      expect(result) {
        const { themes, total } = result.structuredContent;
        expect(total).toBeGreaterThan(themes.length - 1);
        expect(themes.length).toBeGreaterThanOrEqual(3);
        for (const theme of themes) expect(theme.mood, theme.id).toContain(MOOD);
      },
    },
    // Shortlist three and preview each, as the prompt says.
    (ctx) =>
      ctx
        .data('search')
        .themes.slice(0, 3)
        .map(
          (theme: Json): Script => ({
            label: `preview ${theme.id}`,
            method: 'tools/call',
            params: call('theme.preview', { id: theme.id, mode: MODE }),
            expect(result) {
              expect(result.structuredContent).toMatchObject({ id: theme.id, mode: MODE });
              expect(result.structuredContent.aa.modes.map((item: Json) => item.mode)).toEqual([
                'light',
                'dark',
              ]);
            },
          })
        ),
    (ctx) => {
      const winner = ctx
        .data('search')
        .themes.slice(0, 3)
        .find((theme: Json) => ctx.data(`preview ${theme.id}`).aa.pass === true);
      expect(winner, 'a shortlisted theme passes AA').toBeDefined();
      return [
        {
          label: 'get',
          method: 'tools/call',
          params: call('theme.get', { id: winner.id }),
        },
        {
          label: 'read',
          method: 'resources/read',
          params: { uri: `texuli://theme/${winner.id}` },
          expect(result) {
            expect(result.contents.map((item: Json) => item.mimeType)).toEqual([
              'application/json',
              'text/css',
            ]);
          },
        },
        validateStep(
          'validate themed blueprint',
          () => ({
            id: 'layout-page',
            props: { title: 'Weekly analytics', description: 'Example Co. dashboard' },
            children: [
              {
                id: 'blocks-data',
                props: {
                  mode: MODE,
                  block: { type: 'stat', items: [{ label: 'Active boards', value: '128' }] },
                },
              },
            ],
          }),
          (output) => expect(output).toMatchObject({ valid: true, diagnostics: [] })
        ),
      ];
    },
  ],
  final(ctx) {
    const theme = ctx.data('get').theme;
    const preview = ctx.data(`preview ${theme.id}`);
    expect(preview.aa.pass).toBe(true);
    // The preview's tokens are the theme the agent read, not a second implementation.
    expect(preview.tokens['--tx-radius']).toBe(theme.radius);
    expect(JSON.parse(ctx.result('read').contents[0].text)).toEqual(theme);
    expect(ctx.result('read').contents[1].text).toContain('--tx-primary');
    // Every texuli:// URI the prompt names is a served template.
    const templates = ctx
      .result('templates')
      .resourceTemplates.map((item: Json) => item.uriTemplate);
    const prompt = ctx.result('prompt').messages[0].content.text as string;
    for (const uri of texuliUris(prompt)) expect(templates, uri).toContain(uri);
  },
};

// ---------------------------------------------------------------------------
// Job 3: convert a Markdown deck and validate it.
// ---------------------------------------------------------------------------

const DECK_FRONT = '---\ntitle: Fictional quarterly review\nlocale: en\n---\n\n';
const DECK_OPENING =
  '<!-- .slide: layout=title-hero title=Opening -->\n\n# Quarterly review\n\nExample Co. planning team\n\nNote: Welcome everyone, set the agenda and say when questions are welcome.\n\n---\n\n';
const deckHighlights = (layout: string) =>
  `<!-- .slide: layout=${layout} title=Highlights -->\n\n## Highlights\n\n- Shipped the fictional board view\n- Cut response time by a third\n- Hired two example engineers\n\nNote: Walk through each highlight and the team behind it.\n\n---\n\n`;
const DECK_CLOSING =
  '<!-- .slide: layout=section-divider title=Next -->\n\n# What comes next\n\nNote: Close with the plan for the next quarter and the open questions.\n';
/** The first draft guesses a layout name; the second uses one from the diagnostic's fix. */
const deckMarkdown = (layout: string) =>
  `${DECK_FRONT}${DECK_OPENING}${deckHighlights(layout)}${DECK_CLOSING}`;

const markdownDeck: Session = {
  name: 'markdown deck: deck.run from-markdown → lint → to-markdown round trip',
  steps: [
    toolsStep,
    {
      label: 'prompt',
      method: 'prompts/get',
      params: { name: 'convert-deck', arguments: { direction: 'from-markdown' } },
      expect(result, ctx) {
        const text = result.messages[0].content.text as string;
        const named = backtickedTools(text);
        expect(named).toContain('deck.run');
        for (const tool of named) expect(listedTools(ctx), tool).toContain(tool);
      },
    },
    {
      label: 'capabilities',
      method: 'tools/call',
      params: call('deck.run', { command: 'capabilities' }),
      expect(result) {
        expect(result.structuredContent.result.commands).toEqual(
          expect.arrayContaining(['from-markdown', 'lint', 'to-markdown'])
        );
      },
    },
    {
      label: 'first draft',
      method: 'tools/call',
      params: call('deck.run', { command: 'from-markdown', markdown: deckMarkdown('bullets') }),
      expect(result, ctx) {
        const { ok, issues } = result.structuredContent.result;
        expect(ok).toBe(false);
        const unknown = issues.find((issue: Json) => issue.code === 'md-layout-unknown');
        expect(unknown).toMatchObject({ severity: 'error', source: { line: 16 } });
        // The fix names real layouts: every one capabilities lists is offered.
        for (const layout of ctx.data('capabilities').result.layouts)
          expect(unknown.fix, layout).toContain(layout);
      },
    },
    {
      label: 'convert',
      method: 'tools/call',
      params: call('deck.run', { command: 'from-markdown', markdown: deckMarkdown('free') }),
      expect(result) {
        expect(result.structuredContent.result).toMatchObject({ ok: true, issues: [] });
      },
    },
    {
      label: 'lint',
      method: 'tools/call',
      params: (ctx) => call('deck.run', { command: 'lint', deck: ctx.data('convert').result.deck }),
    },
    {
      label: 'inspect',
      method: 'tools/call',
      params: (ctx) =>
        call('deck.run', { command: 'inspect', deck: ctx.data('convert').result.deck }),
    },
    {
      label: 'to markdown',
      method: 'tools/call',
      params: (ctx) =>
        call('deck.run', { command: 'to-markdown', deck: ctx.data('convert').result.deck }),
    },
    {
      label: 'round trip',
      method: 'tools/call',
      params: (ctx) =>
        call('deck.run', {
          command: 'from-markdown',
          markdown: ctx.data('to markdown').result.markdown,
        }),
    },
    {
      label: 'schema',
      method: 'resources/read',
      params: { uri: 'texuli://schema/deck' },
    },
    {
      label: 'schema op',
      method: 'tools/call',
      params: call('deck.run', { command: 'schema' }),
    },
  ],
  final(ctx) {
    const deck = ctx.data('convert').result.deck;
    expect(deck.formatVersion).toBe(2);
    expect(deck.slides.map((slide: Json) => slide.layout)).toEqual([
      'title-hero',
      'free',
      'section-divider',
    ]);
    const lint = ctx.data('lint').result;
    expect(lint).toMatchObject({ ok: true, errors: 0 });
    for (const issue of lint.issues) expect(issue.severity, issue.code).toBe('warning');
    expect(ctx.data('inspect').result.slideCount).toBe(3);
    // Markdown → JSON → Markdown → JSON gives the same deck.
    expect(ctx.data('round trip').result).toMatchObject({ ok: true, deck });
    // The schema resource is the schema deck.run serves.
    expect(JSON.parse(ctx.result('schema').contents[0].text)).toEqual(ctx.data('schema op').result);
  },
};

// ---------------------------------------------------------------------------
// Job 4: discovery from cold.
// ---------------------------------------------------------------------------

/** Page through a list method until it has no nextCursor. */
function pages(method: string, key: string, label: string, cursor?: string, page = 1): Script {
  return {
    label: `${label} page ${page}`,
    method,
    ...(cursor ? { params: { cursor } } : {}),
    expect(result) {
      expect(Array.isArray(result[key]), key).toBe(true);
    },
  };
}

function allPages(method: string, key: string, label: string): Script[] {
  const step = (cursor: string | undefined, page: number): Script[] => [
    pages(method, key, label, cursor, page),
    (ctx) => {
      const next = ctx.result(`${label} page ${page}`).nextCursor;
      return next ? step(next, page + 1) : [];
    },
  ];
  return step(undefined, 1);
}

/** Every item of a paged list the session read. */
function collected(ctx: SessionContext, label: string, key: string): Json[] {
  return ctx.transcript
    .filter((item) => item.label.startsWith(`${label} page `))
    .flatMap((item) => item.response.result[key]);
}

const discovery: Session = {
  name: 'discovery from cold: initialize → tools, resources, prompts, completion',
  steps: [
    toolsStep,
    ...allPages('resources/list', 'resources', 'resources'),
    { label: 'templates', method: 'resources/templates/list' },
    {
      label: 'catalog',
      method: 'resources/read',
      params: { uri: 'texuli://catalog' },
      expect(result) {
        const [content] = result.contents;
        expect(content.mimeType).toBe('application/json');
        expect(JSON.parse(content.text).entries.length).toBeGreaterThan(100);
      },
    },
    {
      label: 'catalog hash',
      method: 'tools/call',
      params: call('catalog.search', { limit: 1 }),
    },
    {
      label: 'block types',
      method: 'tools/call',
      params: call('block.list', {}),
    },
    { label: 'prompts', method: 'prompts/list' },
    {
      label: 'build-ui',
      method: 'prompts/get',
      params: { name: 'build-ui', arguments: { brief: 'A pricing page for Example Co.' } },
    },
    {
      label: 'complete component',
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/resource', uri: 'texuli://component/{id}' },
        argument: { name: 'id', value: 'layout-' },
      },
      expect(result) {
        const { values, total, hasMore } = result.completion;
        expect(values).toContain('layout-page');
        expect(values.length).toBe(total);
        expect(hasMore).toBe(false);
        for (const value of values) expect(value).toMatch(/^layout-/u);
      },
    },
    {
      label: 'complete theme',
      method: 'completion/complete',
      params: {
        ref: { type: 'ref/prompt', name: 'build-ui' },
        argument: { name: 'theme', value: 'vio' },
      },
      expect(result) {
        expect(result.completion.values).toContain('violet');
      },
    },
    // A completed id is readable straight away.
    (ctx) => [
      {
        label: 'read completed',
        method: 'resources/read',
        params: {
          uri: `texuli://component/${ctx.result('complete component').completion.values[0]}`,
        },
      },
    ],
    {
      label: 'unknown resource',
      method: 'resources/read',
      params: { uri: 'texuli://component/no-such-component' },
      rpcError(error) {
        expect(error.code).toBe(-32002);
        expect(error.message).toMatch(/resources\/list/u);
      },
    },
  ],
  async final(ctx) {
    const init = ctx.initialize;
    expect(init.serverInfo.name).toBe('texuli');
    expect(Object.keys(init.capabilities).sort()).toEqual(
      ['completions', 'prompts', 'resources', 'tools'].sort()
    );
    expect(init.capabilities).not.toHaveProperty('logging');
    // The instructions name real tools and real resources.
    for (const tool of backtickedTools(init.instructions)) expect(listedTools(ctx)).toContain(tool);
    for (const name of ['catalog.search', 'component.get', 'blueprint.validate'])
      expect(init.instructions, name).toContain(name);

    // Every tool is self-described: a description with its limits, closed input, output schema.
    for (const tool of ctx.result('tools').tools) {
      expect(tool.description, tool.name).toMatch(/\S/u);
      expect(tool.inputSchema.type, tool.name).toBe('object');
      // The one writer is ds.save, local only (an explicit path inside the working directory).
      expect(tool.annotations.readOnlyHint, tool.name).toBe(tool.name !== 'ds.save');
      if (texuliOps.get(tool.name)) {
        expect(tool.description, tool.name).toMatch(/Limits: input up to \d+ bytes/u);
        expect(tool.outputSchema.type, tool.name).toBe('object');
      }
    }

    const resources = collected(ctx, 'resources', 'resources');
    const uris = resources.map((item) => item.uri);
    expect(new Set(uris).size).toBe(uris.length);
    for (const uri of ['texuli://catalog', 'texuli://llms/full', 'texuli://component/layout-page'])
      expect(uris, uri).toContain(uri);
    const catalog = JSON.parse(ctx.result('catalog').contents[0].text);
    const ids = catalog.entries.map((entry: Json) => entry.id);
    // The catalog resource, catalog.search and resources/list agree on the components.
    expect(ctx.data('catalog hash').total).toBe(ids.length);
    for (const id of ids) expect(uris, id).toContain(`texuli://component/${id}`);
    // Content-addressed: the resource's bytes hash to the id catalog.search reports.
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(ctx.result('catalog').contents[0].text)
    );
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    expect(hash).toBe(ctx.data('catalog hash').hash);

    expect(ctx.result('prompts').prompts.map((prompt: Json) => prompt.name)).toEqual([
      'build-ui',
      'theme-blueprint',
      'create-design-system',
      'convert-deck',
    ]);
    const buildUi = ctx.result('build-ui').messages[0].content.text as string;
    const named = backtickedTools(buildUi);
    expect(named).toEqual(
      expect.arrayContaining([
        'catalog.search',
        'component.get',
        'example.search',
        'blueprint.validate',
      ])
    );
    for (const tool of named) expect(listedTools(ctx), tool).toContain(tool);
    const templates = ctx
      .result('templates')
      .resourceTemplates.map((item: Json) => item.uriTemplate);
    for (const uri of texuliUris(buildUi)) expect([...templates, ...uris], uri).toContain(uri);

    // Every blocks-* component in the catalog has block types an agent can read shapes for.
    const blockTypes = ctx.data('block types').blocks;
    expect(ctx.data('block types').total).toBe(blockTypes.length);
    const blockComponents = ids.filter((id: string) => id.startsWith('blocks-'));
    expect(blockComponents.length).toBeGreaterThan(0);
    for (const id of blockComponents)
      expect(
        blockTypes.some((block: Json) => block.component === id),
        id
      ).toBe(true);
    expect(named).toEqual(expect.arrayContaining(['block.list', 'block.schema']));

    const component = JSON.parse(ctx.result('read completed').contents[0].text);
    expect(ids).toContain(component.id);
  },
};

// ---------------------------------------------------------------------------
// Job 5: read the site (remote only): search texuli.com, read the best hit
// as Markdown, then list its section, against the fixture `env.ASSETS`.
// ---------------------------------------------------------------------------

const readTheSite: Session = {
  name: 'read the site: site.search → site.read → site.pages (remote only)',
  doors: ['remote'],
  steps: [
    toolsStep,
    {
      label: 'search',
      method: 'tools/call',
      params: call('site.search', { query: 'dark mode', limit: 3 }),
      expect(result) {
        const hits = result.structuredContent.results;
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].path).toBe('/guides/dark-mode/');
        expect(hits[0].url).toBe('https://texuli.com/guides/dark-mode/');
      },
    },
    {
      label: 'read best hit',
      method: 'tools/call',
      // The agent reads the path the search returned, not one it made up.
      params: (ctx) => call('site.read', { path: ctx.data('search').results[0].path }),
      expect(result) {
        expect(result.structuredContent.truncated).toBe(false);
        expect(result.structuredContent.markdown).toContain('## The no-flash script');
      },
    },
    {
      label: 'section',
      method: 'tools/call',
      params: (ctx) => {
        const path: string = ctx.data('read best hit').path;
        return call('site.pages', { prefix: path.slice(0, path.indexOf('/', 1) + 1) });
      },
      expect(result) {
        expect(result.structuredContent.pages.map((page: Json) => page.path)).toContain(
          '/guides/dark-mode/'
        );
      },
    },
    {
      label: 'traversal',
      method: 'tools/call',
      params: call('site.read', { path: '/guides/../_headers' }),
      toolError(failure) {
        expect(failure.code).toBe('invalid-input');
        expect(failure.error).toMatch(/traversal/u);
      },
    },
  ],
  final(ctx) {
    expect(ctx.data('read best hit').title).toBe(ctx.data('search').results[0].title);
    expect(ctx.data('section').total).toBe(3);
  },
};

// ---------------------------------------------------------------------------
// Design-system jobs (T-ds-agent-tools): brand a dashboard, import DTCG
// tokens, and repair a refused document from its error codes alone.
// ---------------------------------------------------------------------------

const BRAND = {
  id: 'example-co',
  name: 'Example Co.',
  seed: '#0e7490',
  brief: 'Example Co. analytics: teal #0e7490, Inter, rounded, calm',
} as const;

/** The first worked example's props of a component, read with component.get. */
function firstExample(ctx: SessionContext, label: string): Json {
  const component = ctx.data(label).component;
  expect(component.examples.length, `${component.id} has a worked example`).toBeGreaterThan(0);
  return structuredClone(component.examples[0].props);
}

/** A data dashboard built from the catalog examples: one widget holding a stat block. */
function dashboardTree(ctx: SessionContext): Json {
  return {
    id: 'data-dashboard',
    props: { ...firstExample(ctx, 'get dashboard'), label: 'Example Co. operations' },
    children: [
      {
        id: 'data-dashboard-widget',
        props: firstExample(ctx, 'get widget'),
        children: [{ id: 'blocks-data', props: firstExample(ctx, 'get stat') }],
      },
    ],
  };
}

const getComponent = (label: string, id: string): Step => ({
  label,
  method: 'tools/call',
  params: call('component.get', { id }),
});

/** The brand document the agent writes on top of the suggestion. */
function brandDocument(ctx: SessionContext): Json {
  const suggested = ctx.data('suggest').document;
  return {
    ...suggested,
    extends: 'texuli:ocean',
    typography: { families: { sans: { stack: ['Inter', 'system-ui', 'sans-serif'] } } },
    shape: { radius: 12 },
    motion: { personality: 'subtle' },
    accessibility: { contrast: 'AA' },
  };
}

const designSystemDashboard: Session = {
  name: 'brand a dashboard with a design system: create-design-system → ds.suggest → ds.validate → blueprint.theme',
  steps: [
    toolsStep,
    {
      label: 'prompt',
      method: 'prompts/get',
      params: {
        name: 'create-design-system',
        arguments: { brief: BRAND.brief, base: 'ocean' },
      },
      expect(result, ctx) {
        const text = result.messages[0].content.text as string;
        expect(text).toContain(BRAND.brief);
        // Every named tool is served here, except ds.save on the remote door (the prompt says local only).
        for (const tool of backtickedTools(text)) {
          expect(texuliOps.get(tool), tool).toBeDefined();
          if (ctx.door === 'stdio' || texuliOps.get(tool)?.runtime !== 'node')
            expect(listedTools(ctx), tool).toContain(tool);
        }
      },
    },
    {
      label: 'example',
      method: 'resources/read',
      params: { uri: 'texuli://design-system/acme' },
      expect(result) {
        expect(JSON.parse(result.contents[0].text).format).toBe('texuli/design-system');
      },
    },
    {
      label: 'suggest',
      method: 'tools/call',
      params: call('ds.suggest', { seed: BRAND.seed, id: BRAND.id, name: BRAND.name }),
      expect(result) {
        const data = result.structuredContent;
        expect(data.valid).toBe(true);
        expect(data.document.color.brand.seed).toBe(BRAND.seed);
        expect(Object.keys(data.roles)).toEqual(['light', 'dark']);
      },
    },
    (ctx) => [
      {
        label: 'validate',
        method: 'tools/call',
        params: call('ds.validate', { document: brandDocument(ctx) }),
        expect(result) {
          expect(result.structuredContent).toMatchObject({ valid: true, codes: [], errors: [] });
        },
      },
      {
        label: 'contrast',
        method: 'tools/call',
        params: call('ds.contrast', { document: brandDocument(ctx) }),
        expect(result) {
          const { modes } = result.structuredContent;
          expect(modes.map((mode: Json) => mode.mode)).toEqual(['light', 'dark']);
          for (const mode of modes) {
            expect(mode.total, mode.mode).toBeGreaterThan(0);
            expect(mode.failing, mode.mode).toBe(0);
          }
        },
      },
      {
        label: 'preview',
        method: 'tools/call',
        params: call('ds.preview', { document: brandDocument(ctx) }),
        expect(result) {
          const { content, mediaType } = result.structuredContent;
          expect(mediaType).toBe('image/svg+xml');
          expect(content).toMatch(/^<svg /u);
          expect(content).not.toMatch(/<script|<foreignObject|javascript:|on[a-z]+=/iu);
        },
      },
    ],
    getComponent('get dashboard', 'data-dashboard'),
    getComponent('get widget', 'data-dashboard-widget'),
    getComponent('get stat', 'blocks-data'),
    (ctx) => [
      {
        label: 'theme',
        method: 'tools/call',
        params: call('blueprint.theme', {
          blueprint: dashboardTree(ctx),
          designSystem: { inline: brandDocument(ctx) },
        }),
        expect(result) {
          const data = result.structuredContent;
          expect(data.diagnostics.filter((d: Json) => d.severity === 'error')).toEqual([]);
          expect(data.valid).toBe(true);
          expect(data.blueprint).toMatchObject({
            format: 'texuli-blueprint',
            spec: '0.10.0',
            status: 'draft',
          });
          expect(data.blueprint.tree.id).toBe('data-dashboard');
        },
      },
    ],
    // The host re-validates what the agent hands over, and compiles the stylesheet.
    (ctx) => [
      {
        label: 'revalidate',
        method: 'tools/call',
        params: call('blueprint.validate', { draft: ctx.data('theme').blueprint }),
        expect(result) {
          expect(result.structuredContent.valid).toBe(true);
        },
      },
      {
        label: 'css',
        method: 'tools/call',
        params: call('ds.compile', { document: brandDocument(ctx), format: 'css' }),
        expect(result) {
          expect(result.structuredContent.content).toContain(`[data-tx-ds="${BRAND.id}"]`);
        },
      },
    ],
  ],
  final(ctx) {
    const inline = ctx.data('theme').blueprint.designSystem.inline;
    expect(inline).toEqual(brandDocument(ctx));
    // One document, one hash: validation, compile and preview agree.
    const hash = ctx.data('validate').hash;
    expect(ctx.data('css').hash).toBe(hash);
    expect(ctx.data('preview').hash).toBe(hash);
  },
};

/** A DTCG file from a fictional design tool: a brand color, a radius, fonts and a stray token. */
const DTCG_FILE = {
  brand: { $type: 'color', $value: '#7c2d92' },
  font: {
    body: { $type: 'fontFamily', $value: ['Inter', 'sans-serif'] },
    code: { $type: 'fontFamily', $value: ['JetBrains Mono', 'monospace'] },
  },
  shape: { radius: { $type: 'dimension', $value: { value: 6, unit: 'px' } } },
  legacy: { shadowGlow: { $type: 'shadow', $value: '0 0 8px #000' } },
};

const dtcgImport: Session = {
  name: 'import DTCG tokens into a design system: ds.import → ds.validate → ds.compile dtcg round trip → ds.diff → blueprint.theme',
  steps: [
    toolsStep,
    {
      label: 'import',
      method: 'tools/call',
      params: call('ds.import', {
        from: 'dtcg',
        input: DTCG_FILE,
        id: 'example-tokens',
        name: 'Example tokens',
      }),
      expect(result) {
        const data = result.structuredContent;
        expect(data.valid).toBe(true);
        expect(data.document.color.brand.seed).toBe('#7c2d92');
        // The token no document field takes is named, not silently dropped.
        expect(data.warnings.map((w: Json) => w.code)).toContain('unmapped');
      },
    },
    (ctx) => [
      {
        label: 'validate',
        method: 'tools/call',
        params: call('ds.validate', { document: ctx.data('import').document }),
        expect(result) {
          expect(result.structuredContent.valid).toBe(true);
        },
      },
      {
        label: 'to dtcg',
        method: 'tools/call',
        params: call('ds.compile', { document: ctx.data('import').document, format: 'dtcg' }),
      },
    ],
    (ctx) => [
      {
        label: 'round trip',
        method: 'tools/call',
        params: call('ds.import', { from: 'dtcg', input: ctx.data('to dtcg').content }),
      },
      {
        label: 'diff',
        method: 'tools/call',
        params: call('ds.diff', {
          before: ctx.data('import').document,
          after: {
            ...ctx.data('import').document,
            version: '1.1.0',
            color: { brand: { seed: '#0e7490' } },
          },
        }),
        expect(result) {
          const data = result.structuredContent;
          expect(data.valid).toBe(true);
          expect(data.identical).toBe(false);
          expect(data.summary.changed).toBeGreaterThan(0);
          expect(data.tokens.some((t: Json) => t.variable === '--tx-primary')).toBe(true);
        },
      },
      {
        label: 'apply',
        method: 'tools/call',
        params: call('blueprint.theme', {
          blueprint: {
            id: 'layout-page',
            props: { title: 'Example tokens' },
            children: [
              { id: 'blocks-text', props: { block: { type: 'heading', level: 2, text: 'Hi' } } },
            ],
          },
          designSystem: { inline: ctx.data('import').document },
        }),
        expect(result) {
          expect(result.structuredContent.valid).toBe(true);
        },
      },
    ],
  ],
  final(ctx) {
    // document → DTCG → document is lossless.
    expect(ctx.data('round trip').document).toEqual(ctx.data('import').document);
    expect(ctx.data('round trip').warnings).toEqual([]);
  },
};

/** A document with one mistake per class an agent makes. */
const REFUSED_DOCUMENT = {
  format: 'texuli/design-system',
  formatVersion: 1,
  id: 'example-broken',
  version: '1.0.0',
  extends: 'texuli-base@^1.0.0',
  color: {
    brand: { seed: '#4f46e5' },
    roles: { light: { background: '#ffffff', foreground: '#f1f1f1' } },
  },
  colour: { primary: '#4f46e5' },
  shape: { radius: 99 },
  assets: { logo: { light: 'https://example.com/logo.svg' } },
};

/** Split a design-system JSON path (`$.a.b["c-d"]`) into keys. */
function pathKeys(path: string): string[] {
  return [...path.slice(1).matchAll(/\.([A-Za-z_$][\w$]*)|\["((?:[^"\\]|\\.)*)"\]/gu)].map(
    (match) => (match[1] ?? JSON.parse(`"${match[2]}"`)) as string
  );
}

/** Remove the value at a path (and an object it leaves empty). */
function removeAt(doc: Json, path: string): void {
  const keys = pathKeys(path);
  const parents: Json[] = [doc];
  for (const key of keys.slice(0, -1)) parents.push(parents[parents.length - 1]?.[key]);
  delete parents[parents.length - 1]?.[keys[keys.length - 1] as string];
  for (let at = parents.length - 1; at > 0; at--)
    if (Object.keys(parents[at] ?? {}).length === 0) delete parents[at - 1][keys[at - 1] as string];
}

/**
 * The repair an agent applies from a code and a path alone (no knowledge
 * of the document): drop what is unknown or refused, supply what is
 * required, unpin what fails contrast, clamp what is out of range.
 */
function repair(doc: Json, errors: readonly Json[]): Json {
  const next = structuredClone(doc);
  for (const error of errors) {
    switch (error.code) {
      case 'required':
        if (error.path === '$.name') next.name = 'Example broken';
        break;
      case 'invalid-value':
        if (error.path === '$.shape.radius') next.shape.radius = 12;
        else removeAt(next, error.path);
        break;
      case 'unknown-key':
      case 'url-refused':
      case 'extends-range':
      case 'aa-text':
        // aa-text names the pinned roles that fail: unpinning lets the solver pick.
        removeAt(next, error.path);
        break;
      default:
        throw new Error(`No repair for ${error.code} at ${error.path}.`);
    }
  }
  return next;
}

const ROUNDS = 4;

/** Validate, and when refused, repair from the codes and validate again (at most ROUNDS). */
function repairLoop(round: number, doc: Json): Script[] {
  return [
    {
      label: `validate ${round}`,
      method: 'tools/call',
      params: call('ds.validate', { document: doc }),
    },
    (ctx) => {
      const result = ctx.data(`validate ${round}`);
      if (result.valid || round >= ROUNDS) return [];
      return repairLoop(round + 1, repair(doc, result.errors));
    },
  ];
}

const repairRefused: Session = {
  name: 'fix a refused design system from its error codes: ds.validate → repair by code and path → ds.validate',
  steps: [toolsStep, ...repairLoop(1, REFUSED_DOCUMENT)],
  final(ctx) {
    const rounds = ctx.transcript.filter((item) => item.label.startsWith('validate '));
    const first = ctx.data('validate 1');
    expect(first.valid).toBe(false);
    // Every error says what is wrong and where, with a stable code.
    for (const error of first.errors) {
      expect(error.path, error.code).toMatch(/^\$/u);
      expect(error.message, error.code).toMatch(/\w/u);
    }
    expect(first.codes).toEqual(
      expect.arrayContaining(['extends-range', 'invalid-value', 'unknown-key', 'url-refused'])
    );
    const last = ctx.data(`validate ${rounds.length}`);
    expect(last).toMatchObject({ valid: true, codes: [], errors: [] });
    expect(rounds.length).toBeLessThanOrEqual(ROUNDS);
    // Codes seen across the rounds: the spec's, then the compiler's guarantee.
    const seen = new Set(
      rounds.flatMap((_, at) => ctx.data(`validate ${at + 1}`).codes as string[])
    );
    expect([...seen]).toEqual(expect.arrayContaining(['required', 'aa-text']));
  },
};

/** Every scripted job, run on both doors by `sessions.test.ts`. */
export const SESSIONS: readonly Session[] = [
  discovery,
  pricingPage,
  themeBlueprint,
  markdownDeck,
  readTheSite,
  designSystemDashboard,
  dtcgImport,
  repairRefused,
];
