# Texuli skill — route by intent

Canonical map for the router in [`../SKILL.md`](../SKILL.md). Prefer this table
when several intents appear in one request: pick the **narrowest** matching row.

| Intent keywords | Guide | Notes |
| --- | --- | --- |
| install skill, setup.sh, host folder, checksums, verify skill | [`../setup.sh`](../setup.sh), [hosts.md](hosts.md) | Consent required before write; dry-run first |
| trust, permissions, no network, consent | [`../TRUST.md`](../TRUST.md) | Always offline |
| button, input, dialog, layout, shell, component, dashboard, landing, form flow, slide deck, deck export, rich text editor, build UI | [`../build-ui/SKILL.md`](../build-ui/SKILL.md) | Catalog → pick → compose → validate → render |
| theme, palette, dark mode, forced-colors, contrast, AA gate, theme CLI, theme MCP | [`../themes/SKILL.md`](../themes/SKILL.md) | Offline themes and color path |
| image, video, audio, captions, waveform, gallery, composition, export, generator slot | [`../media/SKILL.md`](../media/SKILL.md) | Offline media build path |
| primitive, texel, roving, focus scope, behavior scenario, catalog entry, contribute | [`../contribute/SKILL.md`](../contribute/SKILL.md) | Full contributor path A–F |
| consumer app, install, `@next`, texuli add, copy source, customize, tokens override, provenance, texuli update, vite, astro, `@texuli/astro`, site model, sitemap, sveltekit | [`../components/SKILL.md`](../components/SKILL.md) | Packages or copied source; update keeps local edits |
| eval, golden tasks, score a model run, skill quality, report-only | [`../evals/SKILL.md`](../evals/SKILL.md) | Offline golden scorer; model runs never gate |
| blueprint, envelope, validateDraft, draft lifecycle, activation, edit ops, undo, player, agent service, chat island, builder, spec, Kotlin projection | [`../blueprints/SKILL.md`](../blueprints/SKILL.md) | Agents draft, validation gates, the owner activates |
| which package, subpath, export, layer | [packages.md](packages.md) | Derived from package.json exports |

## Rules

1. If the developer names a file or package, stay there.
2. Do not start a Deep Work Plan unless asked.
3. Do not invent npm package names or deploy URLs.
4. Validation stays local: `pnpm exec tsx scripts/check-skill.ts`.
