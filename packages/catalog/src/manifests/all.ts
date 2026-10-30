/**
 * `@texuli/catalog/manifests/all`: every manifest group as a static,
 * edge-safe list (no `node:fs`, no dynamic import), for Workers, Pages
 * Functions and the operations registry of `@texuli/tools/ops`.
 *
 * The groups and names must match every folder of `src/manifests/` (what
 * `discoverManifestGroups()` in `@texuli/catalog/build/node` finds, sorted
 * by name), so `buildCatalog(ALL_MANIFEST_GROUPS)` has the same hash as the
 * site's `catalog-<sha256>.json`; `tests/manifests-all.test.ts` checks it.
 * This file is not a folder on purpose: discovery reads folders only.
 */
import type { ManifestGroup } from '../build/build.ts';
import { CANVAS_MANIFESTS } from './canvas/index.ts';
import { CHAT_MANIFESTS } from './chat/index.ts';
import { COMPOSITION_MANIFESTS } from './composition/index.ts';
import { CONTENT_MANIFESTS } from './content/index.ts';
import { DATA_MANIFESTS } from './data/index.ts';
import { DISPLAY_MANIFESTS } from './display/index.ts';
import { DOCUMENTS_MANIFESTS } from './documents/index.ts';
import { FORMS_MANIFESTS } from './forms/index.ts';
import { LAYOUTS_MANIFESTS } from './layouts/index.ts';
import { OVERLAYS_MANIFESTS } from './overlays/index.ts';
import { SCHEMA_FORMS_MANIFESTS } from './schema-forms/index.ts';
import { SPREADSHEET_MANIFESTS } from './sheets/index.ts';
import { STATE_MANIFESTS } from './state/index.ts';
import { WORKFLOWS_MANIFESTS } from './workflows/index.ts';

/** Every manifest group, sorted by name, frozen. */
export const ALL_MANIFEST_GROUPS: readonly ManifestGroup[] = Object.freeze([
  { name: 'canvas', manifests: CANVAS_MANIFESTS },
  { name: 'chat', manifests: CHAT_MANIFESTS },
  { name: 'composition', manifests: COMPOSITION_MANIFESTS },
  { name: 'content', manifests: CONTENT_MANIFESTS },
  { name: 'data', manifests: DATA_MANIFESTS },
  { name: 'display', manifests: DISPLAY_MANIFESTS },
  { name: 'documents', manifests: DOCUMENTS_MANIFESTS },
  { name: 'forms', manifests: FORMS_MANIFESTS },
  { name: 'layouts', manifests: LAYOUTS_MANIFESTS },
  { name: 'overlays', manifests: OVERLAYS_MANIFESTS },
  { name: 'schema-forms', manifests: SCHEMA_FORMS_MANIFESTS },
  { name: 'sheets', manifests: SPREADSHEET_MANIFESTS },
  { name: 'state', manifests: STATE_MANIFESTS },
  { name: 'workflows', manifests: WORKFLOWS_MANIFESTS },
]);
