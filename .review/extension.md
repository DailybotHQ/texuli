# Review overrides for texuli

Texuli is a pre-1.0 pnpm monorepo for a Svelte 5 component library that
owns every primitive. The framework-free L0 texels live in `packages/core`
(`@texuli/core`: the overlay engine, roving focus, positioning, the editor
model and the two-tier URL policy, among others); the layers above it
(primitives, tokens, styled components, domain packages, blocks, catalog,
slides, player, tools, astro) are in `packages/`, the Astro 7 +
`@astrojs/svelte` website in `apps/website`, and its Cloudflare Pages
Functions in `functions/`. A good review
here protects four promises: no borrowed primitives at runtime, no way for
content to become code, dependencies that point down only, and docs that
never claim more than exists.

## Severity overrides for this codebase

- **Always `critical`:** another component library in any package's
  `dependencies` or `peerDependencies`, or imported from shipped source under
  `packages/*/src` or `apps/website/src`. Texuli owns its primitives.
- **Always `critical`:** an HTML sink fed by props, content or agent output:
  `{@html}`, Astro `set:html`, `innerHTML`, `outerHTML`,
  `insertAdjacentHTML`, `srcdoc`, `eval`, `new Function`, or a string-built
  `<script>`.
- **Always `critical`:** a URL policy bypass. Every rendered `href` or `src`
  must pass `safeHref` from `packages/core/src/url/safe-href.ts`, and content
  from an agent or end user must use the `untrusted` tier (the default).
  Passing `'developer'` for such content, rendering a URL that skipped the
  policy, or loosening the policy (allowing `javascript:`, `vbscript:`,
  `data:`, `//host` or `\host` in any tier, or anything beyond `https:`,
  `mailto:` and `#fragment` for `untrusted`) is critical. A policy change
  without a hostile-input test in `packages/core/tests/url-policy.test.ts`
  is critical too.
- **Always `critical`:** a push, `git remote add`, a writing `gh` command,
  an npm publish or a deploy step added to any script, command or skill.
  The repository is local only until the developer says otherwise.
- **Escalate to `warning`:** an upward import between layers. `packages/core`
  (L0) imports nothing from the workspace and nothing from Svelte or another
  UI framework; a lower layer never imports a higher one; no package
  deep-imports another package's `src/` instead of its `exports` entry.
- **Escalate to `warning`:** an accessibility regression: focus not returned
  to the trigger when a layer closes, Escape closing more than the topmost
  layer, missing `inert` on the outside of a modal, missing or
  never-released scroll lock, focus order differing from visual order, an
  interactive element without an accessible name, or decorative graphics
  without `aria-hidden` (see `apps/website/src/components/TexelsDiagram.astro`).
- **Escalate to `warning`:** physical CSS properties where a logical one
  belongs (`width` vs `inline-size` in direction-sensitive layout,
  `margin-left`/`padding-right`/`left`/`right`/`border-left`, `text-align:
  left`). The website already uses `max-inline-size`, `margin-inline` and
  `margin-block-start`; new CSS follows suit.
- **Escalate to `warning`:** dishonest docs: a planned layer, package or
  texel described as existing, a claim that Texuli is released, on npm or
  deployed at texuli.com, a benchmark or size without the command that
  measured it, or a documented command that does not run.
- **Escalate to `warning`:** non-erasable TypeScript (enums, parameter
  properties, namespaces) or a relative import without its `.ts`
  extension; `tsconfig.base.json` sets `erasableSyntaxOnly` and
  `allowImportingTsExtensions`.
- **Escalate to `warning`:** an edit to an owner-held file (`package.json`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `biome.json`,
  `tsconfig.base.json`, `vitest.config.ts`) that weakens a rule or was not
  agreed with the owner, or a new runtime dependency in `@texuli/core`.

## Don't comment on

- Formatting. Biome 2.5.15 (`biome.json`) is the formatter of record.
- Non-null assertions in `**/tests/**` and `**/*.test.ts`; an explicit Biome
  override allows them.
- The `biome-ignore lint/suspicious/noControlCharactersInRegex` in
  `safe-href.ts`; stripping control characters is the point.
- Unused variables or imports in `.svelte` and `.astro` files; Biome
  relaxes those rules there because the compiler sees template usage.
- Vendored skills under `.agents/skills/deepworkplan/` and
  `.agents/skills/ai-diff-reviewer/`; they are pinned in `skills-lock.json`
  and upgraded through their own flows.

## Repo-specific conventions

- **Texels fail closed.** Policy functions return a safe empty value
  (`safeHref` returns `undefined`) instead of throwing, and document their
  contract in JSDoc above the export.
- **Public API is the barrel.** Only what `packages/<pkg>/src/index.ts`
  exports is public; packages export TypeScript source (`"." →
  ./src/index.ts`).
- **Svelte 5 runes only** (`$props`, `$state`, `$derived`, `$effect`,
  `onclick`, snippets); no `export let`, `on:` directives or slots.
- **Website pages are static by default.** A page ships client JavaScript
  only for an interactive example; colors come from the `:root` tokens in
  `apps/website/src/pages/index.astro` with a `prefers-color-scheme: dark`
  variant.
- **Primitives come from the pattern.** Each primitive is written from the
  WAI-ARIA APG pattern and the texels; code and prose are never copied from
  another library.
- **Commits:** Conventional Commits with the scopes in `AGENTS.md` rule 2,
  staged by exact path.

## Test-strategy expectations

- A new or changed texel needs tests in `packages/<pkg>/tests/<name>.test.ts`
  that import through `../src/index.ts`. Vitest collects
  `packages/*/tests/**/*.test.ts`, `apps/website/tests/**/*.test.ts`,
  `scripts/tests/**/*.test.ts` and `tests/agent-evals/**/*.test.ts` (the
  agent sessions and door parity, added to `vitest.config.ts` on 2026-10-30;
  plus `tests/perf/**` only with
  `TEXULI_PERF=1` or an explicit path); a test anywhere else never runs. The
  `apps/website/tests` entry was added to the owner-held `vitest.config.ts`
  in commit `e6c5d205`; the owner's acknowledgement is pending.
- Anything that guards a sink needs one hostile input per bypass class
  (mixed case, embedded tab or newline, leading control characters,
  protocol-relative and backslash URLs).
- Website changes need `pnpm build` (`astro check` + `astro build`) to pass,
  plus the website unit tests (`pnpm vitest run apps/website`) and the area's
  `tests/e2e/site-*.spec.ts`.
- Changes to `packages/core` or root configuration need
  `pnpm check && pnpm build`.
