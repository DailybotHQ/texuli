/**
 * The Texuli MCP prompts: the agent skill's loops (`skills/texuli`,
 * build-ui, themes and the deck reference) written as MCP prompts, so a
 * host without skills gets the same workflow. Every tool a prompt names in
 * backticks is a registry operation, and every `texuli://` URI is a served
 * resource or template (checked by `tests/mcp-protocol.test.ts`).
 */
import { MAX_SOURCE as DECK_SOURCE_MAX } from '../ops/deck.ts';
import type { McpPrompt, McpPromptMessage } from './protocol.ts';
import { themeIds } from './resources.ts';

const user = (text: string): McpPromptMessage => ({
  role: 'user',
  content: { type: 'text', text },
});

const RULES = `Rules that always apply:
- Use only component ids from the catalog, and honour each entry's useWhen and dontUseWhen: never use a component for a case its dontUseWhen names.
- Data only: never write HTML, scripts, style attributes or event handlers. Links and media are https URLs; the host checks them again with the untrusted URL policy.
- Use fictional data (example.com, Example Co.), never real people, keys or secrets.
- Nothing here publishes, activates or writes files: you draft, validation gates, the owner activates.`;

export const buildUiPrompt: McpPrompt = {
  name: 'build-ui',
  title: 'Build an interface from a brief',
  description:
    'Turn a brief into a validated Texuli catalog tree (a blueprint draft): read the component catalog, pick components by useWhen and dontUseWhen, compose from worked examples, and validate with blueprint.validate until it passes. Returns the step-by-step loop with the brief filled in.',
  arguments: [
    {
      name: 'brief',
      description:
        'What to build, in plain words: audience, the primary action, the data on screen.',
      required: true,
    },
    {
      name: 'tier',
      description:
        'Who writes the tree: untrusted (agent output, the default; content components only) or developer (app-authored).',
      enum: ['untrusted', 'developer'],
    },
    {
      name: 'theme',
      description: 'A library theme id to style the result, e.g. violet (complete it, or omit).',
      maxLength: 64,
      complete: themeIds,
    },
  ],
  render(args) {
    const tier = args.tier ?? 'untrusted';
    const theme = args.theme
      ? `Style it with the library theme "${args.theme}": read it with \`theme.preview\` (both modes must pass AA) or texuli://theme/{id}.`
      : 'For styling, run the theme-blueprint prompt, or pick a theme with `theme.search` and check it with `theme.preview`.';
    return {
      description: `Build a Texuli interface for: ${args.brief}`,
      messages: [
        user(`Build a Texuli interface for this brief:

${args.brief}

Emit tier: ${tier}.

Follow this loop and show your work at each step.

1. Catalog. Call \`catalog.search\` with words from the brief and tier "${tier}" (limit 20). Search several times with different words; each result has an id, a summary and the tiers that may emit it. texuli://catalog is the whole catalog in one read.
2. Pick. For each candidate, call \`component.get\` (or read texuli://component/{id}) and keep it only when its useWhen fits the brief and no dontUseWhen matches. Prefer one layout host and a short list of leaf components over many nested one-offs. If the brief needs something the catalog does not have, say so instead of inventing an id.
3. Compose. Call \`example.search\` with each picked componentId and copy the example props as a starting point. Write one catalog tree: { "id": "<component id>", "props": { … }, "children": [ … ] }. Every prop name and value must match the manifest props (names, kinds, required, enums).
4. Validate. Call \`blueprint.validate\` with { "draft": <your tree>, "tier": "${tier}" }. The root must be one frame (layout-page, layout-doc, layout-deck, document, canvas or data-dashboard); pass "fragment": true only for a partial tree. Read every diagnostic: its code, check and path say what to fix (an unknown or tier-denied id, an undeclared prop, a sink such as a javascript: link, a block schema, the grammar). Fix them and call \`blueprint.validate\` again until valid is true with no error diagnostics. Never deliver a tree that has not passed.
5. Style. ${theme}
6. Deliver the validated tree as JSON, the component ids you used with the reason for each, and the theme id. The host validates it again before painting; nothing activates it but the owner.

${RULES}`),
      ],
    };
  },
};

export const themeBlueprintPrompt: McpPrompt = {
  name: 'theme-blueprint',
  title: 'Pick and check a theme for an interface',
  description:
    'Choose a library theme for a blueprint or screen from its brief (brand, mood, audience), check WCAG 2.x AA contrast in light and dark, and hand back the theme id, its key tokens and how the host applies it. Returns the step-by-step loop with the brief filled in.',
  arguments: [
    {
      name: 'brief',
      description:
        'The interface and its brand: product, audience, mood words or colors, e.g. "a calm analytics dashboard".',
      required: true,
    },
    {
      name: 'mode',
      description: 'The mode the interface opens in: light (default) or dark.',
      enum: ['light', 'dark'],
    },
    {
      name: 'theme',
      description: 'A theme id to start from, e.g. ocean (complete it, or omit to search).',
      maxLength: 64,
      complete: themeIds,
    },
  ],
  render(args) {
    const mode = args.mode ?? 'light';
    const start = args.theme
      ? `Start from the theme "${args.theme}"; still compare it with two or three alternatives.`
      : 'Start by searching.';
    return {
      description: `Theme an interface for: ${args.brief}`,
      messages: [
        user(`Pick and check a Texuli library theme for this interface:

${args.brief}

It opens in ${mode} mode. ${start}

1. Search. Call \`theme.search\` with mood or brand words from the brief (all words must match, so try single words too), and narrow with category, collection or mood. Every result has an id, a description, moods and tags.
2. Shortlist three themes whose description and mood fit the brief.
3. Check. Call \`theme.preview\` for each with mode "${mode}". Keep only themes whose aa.pass is true (the AA report covers light and dark: text pairs at 4.5:1, non-text UI at 3:1). WCAG 2.x only; APCA is out of scope.
4. Read the winner with \`theme.get\`, or texuli://theme/{id}, which also returns its compiled CSS.
5. Deliver: the theme id, why it fits, its key tokens in ${mode} mode (background, foreground, primary, border, radius, font), and how the host applies it: \`texuli-init theme apply <id> --dry-run\` in a project, or compileThemeCss and applyTheme from @texuli/tokens in code. Do not hard-code hex colors in components; they read the --tx-* tokens.

Rules: no network, no file writes from this server, and never claim a theme passes AA without a \`theme.preview\` result that says so.`),
      ],
    };
  },
};

export const convertDeckPrompt: McpPrompt = {
  name: 'convert-deck',
  title: 'Convert a deck between Markdown and JSON',
  description:
    'Convert a Texuli deck from Markdown to the JSON model (from-markdown) or back (to-markdown), lint it until it has no errors, and return the result. Paste the source as an argument or provide it when asked. Returns the step-by-step loop.',
  arguments: [
    {
      name: 'direction',
      description:
        'from-markdown (deck Markdown to the JSON model) or to-markdown (a JSON deck to canonical Markdown).',
      required: true,
      enum: ['from-markdown', 'to-markdown'],
    },
    {
      name: 'source',
      description:
        'The deck: Markdown for from-markdown, JSON text for to-markdown. Omit it to be asked for it.',
      maxLength: DECK_SOURCE_MAX,
    },
  ],
  render(args) {
    const fromMarkdown = args.direction === 'from-markdown';
    const source = args.source
      ? `The source:\n\n~~~${fromMarkdown ? 'markdown' : 'json'}\n${args.source}\n~~~`
      : `Ask me for the deck ${fromMarkdown ? 'Markdown' : 'JSON'} first.`;
    const steps = fromMarkdown
      ? `1. Call \`deck.run\` with command "capabilities" to learn the format version, layout ids and outlines; "layouts" lists each layout's props, useWhen and dontUseWhen.
2. Call \`deck.run\` with command "from-markdown" and the Markdown. The dialect is Texuli's own (front matter with closed keys, --- between slides, <!-- .slide: layout=… --> comments, Note: for speaker notes, ::: regions); raw HTML is refused with a diagnostic.
3. If ok is false, fix the Markdown at each issue's line and column and convert again.
4. Call \`deck.run\` with command "lint" and the deck. Fix every error, and fix warnings (missing notes, repeated layouts, too many words) where the content allows. Lint again until there are no errors.
5. Deliver the deck JSON and a one-line summary per slide (\`deck.run\` "inspect" gives the outline).`
      : `1. Call \`deck.run\` with command "lint" and the deck JSON (texuli://schema/deck is its JSON Schema). Fix every error first.
2. Call \`deck.run\` with command "to-markdown" and the deck.
3. Check the round trip: \`deck.run\` "from-markdown" on the result must give ok true; report any feature the Markdown could not carry.
4. Deliver the canonical Markdown.`;
    return {
      description: `Convert a deck (${args.direction})`,
      messages: [
        user(`Convert a Texuli deck (${args.direction}).

${source}

${steps}

Rules: decks are data; never add HTML, scripts or remote iframes, and keep data fictional. The developer presents the result with DeckStage at the untrusted tier.`),
      ],
    };
  },
};

/** The prompts every Texuli MCP door offers. `create-design-system` comes with design systems (planned). */
export const TEXULI_PROMPTS: readonly McpPrompt[] = Object.freeze([
  buildUiPrompt,
  themeBlueprintPrompt,
  convertDeckPrompt,
]);
