# Multi-target output page (texuli.com)

**App:** `apps/website`
**Path:** `/output-page/` (Components group, "Email, PDF and i18n", after Dashboards)
**Packages:** `@texuli/tools/email`, `@texuli/tools/print`, `@texuli/player`
(print mode), `@texuli/core/i18n`, `texuli` and `@texuli/primitives`
labels; all unreleased and coming in `0.8.0` (not in the published `0.7.0`);
English is the only shipped language, translations beyond English are planned
**Tests:** `apps/website/tests/site-output.test.ts`, `tests/e2e/site-output.spec.ts`

## Goal

One blueprint, several targets, with no HTML sink in the site: the email
`renderEmail` writes, print mode and a PDF, and component labels from one
message catalog with a live locale switch.

## How the email is shown without a sink

- `src/pages/output-page/preview/index.html.ts` renders the digest with
  `renderEmail` at build time (escaped by construction in the package) and
  writes it to `dist/output-page/preview/index.html` with a fixed
  `noindex` meta. The CSP integration gives that file its own policy (hashes
  for its inline style attributes, nothing else). Like
  `/gallery-components/preview/`, it is a bare document without the site
  shell, so the shell checks skip `/preview/` routes.
- `EmailFrame.svelte` mounts it on request in `<iframe sandbox="">` (no
  scripts, no same origin). Mounting on request keeps static sweeps away
  from a frame axe cannot enter; the e2e spec checks the email document as a
  top-level page under the WCAG rules.
- `EmailLab.svelte` renders live (the renderer loads on the first request)
  and shows the HTML and plain text as text; the download is a Blob.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| `#email` | `EmailFrame.svelte`, `EmailLab.svelte` | The sandboxed preview; the lab with three drafts (`drafts.ts`: the digest, a `javascript:` link, raw markup and handlers), preheader and direction, diagnostics, source, plain text, download. Static: each draft's build-time outcome, `EMAIL_COMPONENT_IDS` and `EMAIL_BLOCK_TYPES`, the planned dark-mode rules. |
| `#print` | `PrintDemo.svelte` | The player with `print` on or off, the browser's print dialog, and `renderBlueprintPdf` (A4 or Letter, portrait or landscape) as a download; static: `blueprintToDocument`'s block counts. |
| `#i18n` | `I18nDemo.svelte` | `setI18nContext(createI18n(…))` over Rating, TagsInput and CopyButton: English, a Spanish catalog this page wrote (`locales/es.ts`, loaded lazily) and the `en-XA` pseudo-locale, plus a plural message; static: labels per namespace from `TEXULI_MESSAGES_EN` and `PRIMITIVES_MESSAGES_EN`, `parseCatalog` on a hostile file, pseudo-locale samples. |
| `#safety`, `#package-docs` | static | Rules, a code sample, doc paths. |
