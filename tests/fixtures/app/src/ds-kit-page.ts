import '@texuli/tokens/base.css';
import { applyTheme } from '@texuli/tokens';
import { compileDesignSystem, resolveDesignSystem } from '@texuli/tokens/design-system/compile';
import type { DesignSystem } from '@texuli/tokens/design-system/validate';
import { loadLibraryTheme } from '@texuli/tokens/library';
import { mount } from 'svelte';
import type { KitAllowManifest, KitCatalog, KitCompiled } from 'texuli/ds-kit';
import catalog from '../../../../packages/spec/catalog/components.json';
import acme from '../../../../packages/spec/fixtures/design-systems/acme.json';
import DsKitFixture from './DsKitFixture.svelte';

/*
 * tests/e2e/ds-kit.spec.ts (PLAN_016 T-t4-e2e, kit API §8): the whole design-system kit
 * (`texuli/ds-kit`) over the fictional acme document, locked to a small allow set, with one
 * library entry previewed live and a previous version for the Changes section. Everything
 * compiles in the page from bundled data: no request leaves the origin. `?mode=light|dark`
 * sets the page mode; `?view=both|light|dark` the kit's starting mode view.
 */

type Doc = DesignSystem;

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'dark' ? 'dark' : 'light';
const view = params.get('view');
const modeView = view === 'light' || view === 'dark' ? view : 'both';

const library: NonNullable<DesignSystem['library']> = [
  {
    id: 'pricing-card',
    name: 'Pricing card',
    purpose: 'One plan of Example Co. with its price and a call to action.',
    version: '0.3.0',
    status: 'draft',
    composes: ['card', 'button', 'badge'],
  },
  {
    id: 'stat-tile',
    name: 'Stat tile',
    purpose: 'A metric with its trend.',
    version: '1.0.0',
    status: 'draft',
    composes: ['card'],
  },
];

const allow: NonNullable<KitAllowManifest['allow']> = {
  button: {
    variants: ['default', 'outline'],
    sizes: ['sm', 'md'],
    states: ['hover', 'focus-visible', 'disabled', 'loading'],
  },
  badge: { variants: ['default', 'success'] },
  chip: { states: ['selected', 'disabled'] },
  checkbox: {},
  switch: {},
  input: {},
  card: {},
  alert: { tones: ['info', 'warning'] },
};

const current: Doc = {
  ...(acme as unknown as Doc),
  version: '2.2.0',
  allow,
  library,
  approval: { status: 'draft', version: '2.2.0' },
};
const previous: Doc = {
  ...(acme as unknown as Doc),
  library: library.slice(1),
  approval: { status: 'draft', version: '2.1.0' },
};

async function compile(doc: Doc): Promise<KitCompiled & { allowManifest?: unknown }> {
  const resolved = await resolveDesignSystem(doc, { trust: 'developer' });
  if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
  const result = compileDesignSystem(resolved.document);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

const [theme, compiled, previousCompiled] = await Promise.all([
  loadLibraryTheme('enterprise-neutral'),
  compile(current),
  compile(previous),
]);
applyTheme(document.documentElement, { theme, mode });

const manifest: KitAllowManifest = { version: current.version, allow };

const target = document.getElementById('app');
if (!target) throw new Error('missing #app');
mount(DsKitFixture, {
  target,
  props: {
    document: current,
    compiled,
    allow: manifest,
    catalog: catalog as KitCatalog,
    previous: { document: previous, compiled: previousCompiled },
    modeView,
  },
});
document.documentElement.dataset.dsKitReady = 'true';
