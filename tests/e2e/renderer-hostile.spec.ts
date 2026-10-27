/// <reference types="node" />
/**
 * Hostile corpus browser check: sink-free render output must not execute
 * scripts. The corpus is processed in Node (its inertness is unit-tested in
 * packages/catalog/tests/render-hostile.test.ts); the page only receives
 * inert text (textContent / createElement). Axe stays clean.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { resetArtifactFrameIds } from '../../packages/catalog/src/render/frame/index.ts';
import {
  HOSTILE_SAMPLES,
  runHostileCorpus,
} from '../../packages/catalog/src/render/hostile/index.ts';
import {
  type RenderComponentSpec,
  type RenderNode,
  renderCatalogFromSpecs,
} from '../../packages/catalog/src/render/renderer/index.ts';

const card: RenderComponentSpec = {
  id: 'card',
  label: 'Card',
  agentEmittable: true,
  emit: ['developer', 'untrusted'],
  props: [
    { name: 'variant', kind: 'enum', enumValues: ['elevated', 'flat'], default: 'elevated' },
    { name: 'title', kind: 'string' },
    { name: 'href', kind: 'string', trust: 'untrusted' },
    { name: 'src', kind: 'string', trust: 'untrusted' },
  ],
};

const dialog: RenderComponentSpec = {
  id: 'dialog',
  label: 'Dialog',
  agentEmittable: false,
  emit: ['developer'],
  props: [{ name: 'title', kind: 'string', required: true }],
};

const alertDialog: RenderComponentSpec = {
  id: 'alert-dialog',
  label: 'AlertDialog',
  agentEmittable: false,
  emit: ['developer'],
  props: [
    { name: 'title', kind: 'string', required: true },
    { name: 'confirmLabel', kind: 'string' },
  ],
};

const catalog = renderCatalogFromSpecs([card, dialog, alertDialog]);

function escapeText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nodeToHtml(node: RenderNode): string {
  if (node.kind === 'placeholder') {
    return `<div data-kind="placeholder" data-reason="${escapeText(node.reason)}"><strong>${escapeText(node.label)}</strong></div>`;
  }
  const props = Object.entries(node.props)
    .map(([k, v]) => `<li><code>${escapeText(k)}</code>: ${escapeText(String(v))}</li>`)
    .join('');
  const kids = node.children.map(nodeToHtml).join('');
  return `<article data-kind="component" data-id="${escapeText(node.id)}"><h3>${escapeText(node.id)}</h3><ul>${props}</ul>${kids}</article>`;
}

function buildHostilePageHtml(): string {
  resetArtifactFrameIds();
  const report = runHostileCorpus({ catalog });
  if (!report.ok) {
    const detail = report.results
      .filter((r) => !r.inert)
      .map((r) => `${r.sample.id}: ${r.failures.join('; ')}`)
      .join('\n');
    throw new Error(`Corpus not inert before e2e:\n${detail}`);
  }

  const sections = report.results
    .map((result) => {
      const roots = result.frame?.roots ?? result.render?.roots ?? [];
      const body =
        roots.length === 0
          ? '<p data-empty="true">Dropped or limit-rejected (inert).</p>'
          : roots.map(nodeToHtml).join('');
      const rich =
        result.richtext != null
          ? `<pre data-richtext="true">${escapeText(JSON.stringify(result.richtext.document))}</pre>`
          : '';
      return `<section data-sample="${escapeText(result.sample.id)}" data-category="${escapeText(result.sample.category)}" aria-label="${escapeText(result.sample.title)}"><h2>${escapeText(result.sample.title)}</h2>${body}${rich}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Hostile corpus (inert)</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 1rem; background: #fff; color: #111; }
    section { border: 1px solid #ccc; border-radius: 0.5rem; padding: 0.75rem; margin-block: 0.75rem; }
    h1, h2, h3 { color: #111; }
    code { font-size: 0.9em; }
    [data-kind="placeholder"] { background: #f4f4f5; padding: 0.5rem; }
  </style>
</head>
<body>
  <main id="main">
    <h1>Hostile corpus — sink-free render</h1>
    <p>All samples processed by @texuli/catalog/render/hostile. No raw agent HTML.</p>
    ${sections}
  </main>
  <script>
    // Instrumentation only (test harness). Corpus output is not executed as script.
    window.__hostileScriptRan = false;
    window.__hostileProbe = 'ok';
    document.addEventListener('securitypolicyviolation', function () {
      window.__hostileCsp = (window.__hostileCsp || 0) + 1;
    });
  </script>
</body>
</html>`;
}

test.describe('renderer hostile corpus (browser)', () => {
  test.beforeEach(() => {
    resetArtifactFrameIds();
  });

  test('inert HTML paints with zero corpus script execution and axe clean', async ({ page }) => {
    const html = buildHostilePageHtml();
    // Block any navigation that a surviving javascript: link might try.
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith('javascript:') || url.startsWith('vbscript:')) {
        throw new Error(`Blocked executable navigation: ${url}`);
      }
      return route.continue();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Harness probe is allowed; corpus must not flip a different flag.
    expect(
      await page.evaluate(() => (window as unknown as { __hostileProbe?: string }).__hostileProbe)
    ).toBe('ok');
    expect(
      await page.evaluate(
        () => (window as unknown as { __hostileScriptRan?: boolean }).__hostileScriptRan
      )
    ).toBe(false);
    expect(
      await page.evaluate(() => (window as unknown as { __hostileRun?: boolean }).__hostileRun)
    ).toBeFalsy();
    expect(
      await page.evaluate(() => (window as unknown as { __hostile?: number }).__hostile)
    ).toBeFalsy();

    // No script tags inside sample sections (only the harness script in body).
    const sampleScripts = await page.locator('[data-sample] script').count();
    expect(sampleScripts).toBe(0);

    // No javascript: anchors.
    const badHrefs = await page.locator('a[href^="javascript:"], a[href^="vbscript:"]').count();
    expect(badHrefs).toBe(0);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hostile corpus — sink-free render'
    );
    expect(await page.locator('[data-sample]').count()).toBe(HOSTILE_SAMPLES.length);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
