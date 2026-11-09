import catalog from '../../../../../../../packages/spec/catalog/components.json';
import { NATIVE_COMPATIBILITY } from '../../../../data/native/compatibility.ts';

export const NATIVE_COMPONENT_SOURCE = 'packages/spec/catalog/components.json';
export const NATIVE_PARITY_SOURCE = 'native/docs/parity.json';

const COMPONENT_IDS = ['layout-doc', 'blocks-text', 'blocks-data'] as const;
const nativeById = new Map(
  NATIVE_COMPATIBILITY.components.map((component) => [component.id, component])
);
const catalogById = new Map(catalog.components.map((component) => [component.id, component]));

export const NATIVE_COMPONENT_TRAVEL = COMPONENT_IDS.map((id) => {
  const component = nativeById.get(id);
  const entry = catalogById.get(id);
  if (!component || !entry) throw new Error(`Native component evidence is missing for ${id}`);
  if (component.evidence.traces.length === 0) {
    throw new Error(`Native component trace evidence is missing for ${id}`);
  }
  return {
    id,
    label: entry.label,
    summary: entry.summary,
    group: component.group,
    web: component.web,
    composeDesktop: component.composeDesktop,
    conformance: component.conformance,
    traces: component.evidence.traces,
  };
});

export const NATIVE_TRAVEL_STEPS = [
  {
    title: 'Catalog',
    detail: 'A closed catalog names each node and its validated props.',
    path: NATIVE_COMPONENT_SOURCE,
  },
  {
    title: '@texuli/spec',
    detail: 'The shared blueprint contract validates the tree and its component data.',
    path: 'packages/spec/README.md',
  },
  {
    title: 'Web player',
    detail: 'The web player paints the blueprint with the registered web renderers.',
    path: 'packages/player/README.md',
  },
  {
    title: 'Kotlin twin',
    detail:
      'texuli-spec validates the same contract; texuli-compose paints supported nodes and uses visible placeholders for the rest.',
    path: 'native/README.md',
  },
] as const;

export const NATIVE_SHARED_SOLUTIONS = [
  {
    title: 'Presentations',
    sharedIntent:
      'Keep the deck structure and slide sequence; choose a stage suited to each screen.',
    package: '@texuli/slides',
    path: 'packages/slides/README.md',
  },
  {
    title: 'Documents',
    sharedIntent:
      'Keep the document and its structured blocks; adapt editing and reading interactions to the target.',
    package: '@texuli/document',
    path: 'packages/document/README.md',
  },
  {
    title: 'Workflows',
    sharedIntent:
      'Keep the workflow graph and its connections; adapt graph editing and navigation to the target.',
    package: '@texuli/workflows',
    path: 'packages/workflows/README.md',
  },
  {
    title: 'Canvas',
    sharedIntent:
      'Keep the spatial objects and their relationships; use target-appropriate selection and navigation.',
    package: '@texuli/canvas',
    path: 'packages/canvas/README.md',
  },
  {
    title: 'Sheets',
    sharedIntent:
      'Keep the workbook data and formulas; adapt cell navigation and editing to the target.',
    package: '@texuli/sheets',
    path: 'packages/sheets/README.md',
  },
] as const;
