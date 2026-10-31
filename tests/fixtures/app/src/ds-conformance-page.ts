import '@texuli/tokens/base.css';
import '@texuli/player/styles.css';
import { createCanvasPlayerHost } from '@texuli/canvas/host';
import { ALL_MANIFEST_GROUPS } from '@texuli/catalog/manifests/all';
import { createFormPlayerHost } from '@texuli/forms/host';
import { createDocumentPlayerHost } from '@texuli/pages/host';
import { mountPlayer } from '@texuli/player';
import { createSheetPlayerHost } from '@texuli/sheets/host';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { DS_CHECK_COMPONENT_ATTRIBUTE, installDsCheckHost } from '@texuli/tools/ds-check/host';

/*
 * The design-system conformance sheet (T-ds-conformance): every
 * agent-emittable catalog component, painted by the player from its first
 * manifest example, inside one scope (#ds-scope) that
 * `@texuli/tools/ds-check/host` themes. `texuli ds check --render` and
 * tests/e2e/ds-conformance.spec.ts drive it. The page itself stays on a
 * fixed library theme, so anything that reads a variable outside the scope
 * shows up as a color that does not follow the design system.
 *
 * App-tier components (overlays, navigation and app chrome: 93 of the 168
 * manifests) are not painted by the player and are not on this sheet.
 */

applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: 'light',
});

const scope = document.getElementById('ds-scope');
const status = document.getElementById('ds-status');
if (!scope || !status) throw new Error('missing #ds-scope');

/** `$state` names an example reads, declared as lists with two items. */
function stateNames(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const item of value) stateNames(item, out);
  else if (value && typeof value === 'object') {
    const bag = value as Record<string, unknown>;
    if (typeof bag.$state === 'string') out.add(bag.$state);
    for (const entry of Object.values(bag)) stateNames(entry, out);
  }
  return out;
}

/** What an example needs around it to be a valid blueprint (as packages/player/tests/examples-paint.test.ts). */
function blueprintFor(id: string, label: string, props: Readonly<Record<string, unknown>>) {
  const state: Record<string, unknown> = {};
  let flow: Record<string, unknown> | undefined;
  let tree: unknown = { id, props };
  const name = typeof props.state === 'string' ? props.state : undefined;
  const control: Record<string, unknown> = {
    'control-toggle': { type: 'boolean' },
    'control-choice': { type: 'enum', values: ['this-week', 'last-week'] },
    'control-slider': { type: 'number', min: 0, max: 10 },
    'control-filter': { type: 'string' },
    'form-field':
      props.kind === 'number' ? { type: 'number', min: 0, max: 100 } : { type: 'string' },
  };
  if (name && control[id]) state[name] = control[id];
  for (const list of stateNames(props))
    state[list] = {
      type: 'list',
      initial: [
        { id: 'one', label: 'One' },
        { id: 'two', label: 'Two' },
      ],
    };
  if (id === 'flow-view') flow = { views: [props.name], initial: props.name, transitions: [] };
  if (id === 'flow-action')
    flow = {
      views: ['start', 'end'],
      initial: 'start',
      transitions: [{ from: 'start', to: 'end', on: props.event }],
    };
  if (id === 'form-field' || id === 'form-submit')
    tree = { id: 'action-form', props: { action: 'request', label: 'Request' }, children: [tree] };
  if (id === 'data-dashboard-widget')
    tree = { id: 'data-dashboard', props: { label: 'Example' }, children: [tree] };
  return {
    format: 'texuli-blueprint',
    version: 1,
    id: `ds-check-${id}`,
    catalog: '0'.repeat(64),
    status: 'draft',
    createdAt: '2026-10-30T09:00:00Z',
    updatedAt: '2026-10-30T09:00:00Z',
    generator: { kind: 'tool', name: 'ds-check' },
    ...(Object.keys(state).length > 0 ? { state } : {}),
    ...(flow ? { flow } : {}),
    // A frame root keeps the draft valid (a frame paints as it is); a card
    // under it gives components that start at h3 their h2.
    tree: FRAMES.has(id)
      ? tree
      : {
          id: 'layout-page',
          props: { title: label },
          children: [
            id.startsWith('layout-')
              ? tree
              : { id: 'layout-card', props: { title: 'Example' }, children: [tree] },
          ],
        },
  };
}

const FRAMES = new Set(['layout-page', 'layout-doc', 'layout-deck']);

const manifests = ALL_MANIFEST_GROUPS.flatMap((group) => group.manifests)
  .filter((manifest) => manifest.agentEmittable === true && manifest.examples.length > 0)
  .sort((a, b) => a.id.localeCompare(b.id));

const documentHost = createDocumentPlayerHost({ anchorPrefix: 'ds-check' });
const canvasHost = createCanvasPlayerHost();
const formHost = createFormPlayerHost();
const sheetHost = createSheetPlayerHost();

/** Validation errors per component (read by tests/e2e/ds-conformance.spec.ts). */
const diagnostics: Record<string, string[]> = {};
(globalThis as Record<string, unknown>).dsCheckDiagnostics = diagnostics;

for (const manifest of manifests) {
  const section = document.createElement('section');
  section.setAttribute(DS_CHECK_COMPONENT_ATTRIBUTE, manifest.id);
  const heading = document.createElement('h2');
  heading.id = `ds-check-heading-${manifest.id}`;
  heading.textContent = manifest.id;
  section.setAttribute('aria-labelledby', heading.id);
  const target = document.createElement('div');
  section.append(heading, target);
  scope.append(section);
  const example = manifest.examples[0] as { props: Readonly<Record<string, unknown>> };
  mountPlayer(target, {
    blueprint: blueprintFor(manifest.id, manifest.label, example.props),
    label: `${manifest.label} example`,
    invalidPolicy: 'preview',
    onDiagnostics: (event: {
      diagnostics: readonly { severity: string; code: string; message: string }[];
    }) => {
      const errors = event.diagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0)
        diagnostics[manifest.id] = errors.map((d) => `${d.code}: ${d.message}`);
      else delete diagnostics[manifest.id];
    },
    motion: 'reduce',
    documentHost,
    canvasHost,
    formHost,
    sheetHost,
  });
}

/** Every player painted: no skeleton left in the scope. */
async function painted(): Promise<void> {
  const deadline = performance.now() + 45_000;
  while (performance.now() < deadline) {
    if (!scope?.querySelector('[data-tx-player-skeleton]')) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The sheet did not finish painting.');
}

installDsCheckHost(scope, { ready: painted });
await painted();
status.textContent = `Ready: ${manifests.length} components`;
