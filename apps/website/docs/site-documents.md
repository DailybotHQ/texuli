# Documents page (texuli.com)

**App:** `apps/website`
**Path:** `/documents-page/` (Components group, after Motion)
**Packages:** `@texuli/document` (model, ops, sync, collab, paged, docx,
pdf), `@texuli/pages` (editor, reader, paged, export, collab, host),
`@texuli/player`, `@texuli/catalog/edit`; both document packages are in
development and on npm from `0.7.0`, their first release (pre-1.0); the
`document` catalog id, node keys and `patchDocument` are spec `0.7.0`, in
`@texuli/spec@0.7.0`
**Decisions:** ADR-010 (sync), ADR-011 (document packages), ADR-016 (static
outputs) in [DECISIONS](../../../docs/DECISIONS.md)
**Tests:** `apps/website/tests/site-documents.test.ts`,
`tests/e2e/site-documents.spec.ts`

## Goal

Show the document stack working end to end on one page: a live block
editor, the reader and the paged view of the same document, the three
exports, two collaborators on one draft, and a document an agent wrote,
painted by the player and edited by a bounded patch.

## Layout

| Section | Island | What it shows |
| --- | --- | --- |
| Hero | static | Status (in development, on npm from `0.7.0`; the previous release, `0.6.0`, is without them) and the subpaths as pieces. |
| `#workbench` | `DocumentWorkbench.svelte` | A fictional team handbook in `PageEditor`: slash menu, block drag and Alt+Arrow moves, resizable columns, a callout, a toggle, a quote, nested pages (`pages/onboarding`, `pages/rituals`, and new pages from the menu) with a breadcrumb, and a `charts-donut` embed painted by the player. A View radio group switches to `PageReader` or `PagedView` (A4, header with the title, footer "Page N of M", an explicit break), with Print. Export writes Markdown, DOCX or PDF with `exportDocument` and saves the Blob with `downloadBlob`; a status line names the file and its size. |
| `#collab` | `CollabDemo.svelte` | Ada's and Lin's `CollabEditor`s on two replicas of one draft, synced by `createMemorySyncHub` (the BroadcastChannel adapter is named in the copy): typing converges, comments, Suggesting with accept and reject, version history with restore, remote carets and the collaborator list. Start over opens two new sessions. |
| `#agents` | `AgentDocumentDemo.svelte` | The blueprint JSON, the patch and the hostile patch (static), and the real `<Player>` at the untrusted tier with `createDocumentPlayerHost()` as its `documentHost`. Apply runs `applyEditOps([patchDocument])` with the host patcher (validate, apply all or none, validate again at the untrusted tier); Undo applies the inverse; the hostile patch (`/__proto__/polluted`) is refused with `invalid-value` and nothing changes. |
| `#keyboard` | static | The editor keys that matter most (the full table is in the editor docs). |
| `#safety` | static | The rules the packages keep, and three code samples. |
| `#package-docs` | static | Repository paths of the package docs and the `document` llms entry. |

Copy lives in `src/components/documents-site/page.ts`, the documents in
`sample.ts` and the agent blueprint and patches in `blueprint.ts`
(fictional Harbor content, `example.com`; labels are text, never HTML).

## Headings

The page keeps one `h1`. The sample documents start at level 2, because
the paged view renders heading levels as written; the reader is offset by
one (`headingOffset={1}`), and the document host offsets agent documents by
one by default.

## Two collaborators on one page

`CollabEditor` names every landmark it owns for the person whose view it
is (`CollabLabels.landmark` with the session author: "Comments (Ada)",
"Collaboration (Lin)"), so two editors on one page never repeat a landmark
name (axe `landmark-unique`) without host labels; the demo passes only each
editor's `label` ("Ada’s copy of the draft").

## Performance

Every island mounts with `client:visible`, and each one imports its large
modules (`@texuli/pages/editor`, `reader`, `paged`, `export` and its
writers, `collab`, `@texuli/document/sync`, `@texuli/player`,
`@texuli/pages/host`, `@texuli/catalog/edit`) with `import()` after it
hydrates, so none of them is on the first paint; the unit test checks the
islands have no static import of them. The route's page-weight override
(the hoisted CSS of the lazily importable chunks) is in
`src/components/perf/budgets.ts`.

## Validation

```bash
pnpm vitest run apps/website/tests/site-documents.test.ts
pnpm build
pnpm --filter @texuli/website check:csp
TEXULI_E2E_PORT=4959 pnpm exec playwright test tests/e2e/site-documents.spec.ts --project chromium
```

## Limits

- Editing in the paged view is planned; Pages is a print preview.
- Sheet and canvas embeds stay typed references until their packages ship.
- Network sync transports and storage are host adapters; the page syncs
  two editors in memory.
- The demo's state lives in the page: a reload starts from the sample.
