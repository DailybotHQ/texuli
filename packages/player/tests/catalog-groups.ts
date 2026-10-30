import type { ManifestGroup } from '@texuli/catalog/build';
import { CANVAS_MANIFESTS } from '@texuli/catalog/manifests/canvas';
import { CHAT_MANIFESTS } from '@texuli/catalog/manifests/chat';
import { COMPOSITION_MANIFESTS } from '@texuli/catalog/manifests/composition';
import { CONTENT_MANIFESTS } from '@texuli/catalog/manifests/content';
import { DATA_MANIFESTS } from '@texuli/catalog/manifests/data';
import { DISPLAY_MANIFESTS } from '@texuli/catalog/manifests/display';
import { DOCUMENTS_MANIFESTS } from '@texuli/catalog/manifests/documents';
import { FORMS_MANIFESTS } from '@texuli/catalog/manifests/forms';
import { LAYOUTS_MANIFESTS } from '@texuli/catalog/manifests/layouts';
import { OVERLAYS_MANIFESTS } from '@texuli/catalog/manifests/overlays';
import { SCHEMA_FORMS_MANIFESTS } from '@texuli/catalog/manifests/schema-forms';
import { SPREADSHEET_MANIFESTS } from '@texuli/catalog/manifests/sheets';
import { STATE_MANIFESTS } from '@texuli/catalog/manifests/state';
import { WORKFLOWS_MANIFESTS } from '@texuli/catalog/manifests/workflows';

/**
 * Every catalog manifest group, imported by name so DOM tests can build the
 * catalog without Node file discovery. `loader-parity.test.ts` checks this
 * list against `discoverManifestGroups()`.
 */
export const CATALOG_GROUPS: readonly ManifestGroup[] = [
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
];
