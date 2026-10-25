import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogTreeInput, RenderNode } from '@texuli/catalog/render/renderer';
import { renderCatalogTree } from '@texuli/catalog/render/renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runGoldenCli } from '../src/golden/cli.ts';
import {
  type AxeLike,
  createAxeRunner,
  formatGoldenReport,
  GOLDEN_CHECKS,
  GOLDEN_FRAME_IDS,
  GOLDEN_MANIFESTS,
  GOLDEN_TASKS,
  type GoldenCheckId,
  type GoldenTask,
  GUIDANCE_DETECTORS,
  goldenManifest,
  goldenRenderCatalog,
  goldenTask,
  paintGoldenTree,
  projectOutline,
  scoreGoldenRun,
  scoreGoldenTree,
} from '../src/golden/index.ts';

// axe-core comes with the root's @axe-core/playwright; resolve it from there.
const req = createRequire(import.meta.url);
const axe = req(createRequire(req.resolve('@axe-core/playwright')).resolve('axe-core')) as AxeLike;
const axeRunner = createAxeRunner(axe);

afterEach(() => {
  document.body.replaceChildren();
});

const task = (id: string): GoldenTask => {
  const found = goldenTask(id);
  if (!found) throw new Error(`no task ${id}`);
  return found;
};

/** A deep copy of a task's reference, edited by `edit`. */
function variant(
  id: string,
  edit: (tree: CatalogTreeInput & { children: CatalogTreeInput[] }) => void
) {
  const tree = structuredClone(task(id).reference) as CatalogTreeInput & {
    children: CatalogTreeInput[];
  };
  edit(tree);
  return tree;
}

const failing = async (taskId: string, tree: unknown, withAxe = false) => {
  const score = await scoreGoldenTree(
    task(taskId),
    tree,
    withAxe ? { axe: axeRunner, document } : {}
  );
  return {
    score,
    failed: score.checks.filter((check) => check.status === 'fail').map((check) => check.check),
    issues: (check: GoldenCheckId) => score.checks.find((c) => c.check === check)?.issues ?? [],
  };
};

const text = (markdown: string): CatalogTreeInput => ({
  id: 'blocks-text',
  props: { block: { type: 'text', markdown } },
});
const list = (items: string[]): CatalogTreeInput => ({
  id: 'blocks-text',
  props: { block: { type: 'list', items: items.map((item) => ({ text: item })) } },
});

describe('golden set: the tasks', () => {
  it('pre-registers 30 tasks with unique, stable ids and fictional briefs', () => {
    expect(GOLDEN_TASKS).toHaveLength(30);
    const ids = GOLDEN_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(30);
    GOLDEN_TASKS.forEach((t, index) => {
      expect(t.id).toMatch(
        new RegExp(`^g${String(index + 1).padStart(2, '0')}-[a-z0-9]+(?:-[a-z0-9]+)*$`)
      );
      expect(t.brief.length).toBeGreaterThan(40);
      expect(t.tier).toBe('untrusted');
      expect(Object.isFrozen(GOLDEN_TASKS)).toBe(true);
    });
  });

  it('asks only for components agents may emit, and starts every reference from a frame', () => {
    for (const t of GOLDEN_TASKS) {
      for (const id of t.mustInclude) {
        expect(goldenManifest(id)?.agentEmittable, `${t.id} needs ${id}`).toBe(true);
      }
      expect(GOLDEN_FRAME_IDS as readonly string[], t.id).toContain(t.reference.id);
    }
  });

  it('covers the agent surface broadly (every frame and most content families)', () => {
    const used = new Set<string>();
    const visit = (node: CatalogTreeInput) => {
      used.add(node.id);
      node.children?.forEach(visit);
    };
    for (const t of GOLDEN_TASKS) visit(t.reference);
    for (const id of ['layout-page', 'layout-doc', 'layout-deck', 'layout-card', 'layout-grid']) {
      expect(used, id).toContain(id);
    }
    expect([...used].filter((id) => id.startsWith('charts-')).length).toBeGreaterThanOrEqual(15);
  });

  it('cites only real manifest guidance as traps, each with a detector', () => {
    const lines = new Set(GOLDEN_MANIFESTS.flatMap((m) => m.dontUseWhen));
    const detected = new Set(GUIDANCE_DETECTORS.map((d) => d.line));
    const traps = GOLDEN_TASKS.flatMap((t) => t.traps);
    expect(traps.length).toBeGreaterThanOrEqual(5);
    for (const line of traps) {
      expect(lines, line).toContain(line);
      expect(detected, line).toContain(line);
    }
  });

  it('has a detector for every dontUseWhen line of the agent surface (no silent drift)', () => {
    const detected = new Set(GUIDANCE_DETECTORS.map((d) => d.line));
    for (const manifest of GOLDEN_MANIFESTS) {
      for (const line of manifest.dontUseWhen) {
        expect(detected, `${manifest.id}: "${line}"`).toContain(line);
        const detector = GUIDANCE_DETECTORS.find((d) => d.line === line);
        expect(detector?.appliesTo(manifest.id), `${manifest.id}: "${line}"`).toBe(true);
      }
    }
  });
});

describe('golden set: embed guidance detectors', () => {
  const sinkLine = 'Running untrusted app JSON with innerHTML, eval, or an unsandboxed iframe.';
  const sandboxLine =
    'Relaxing iframe sandbox (especially adding allow-same-origin) or skipping CSP frame-src / postMessage origin checks.';
  const detector = (line: string) => {
    const found = GUIDANCE_DETECTORS.find((d) => d.line === line);
    if (!found) throw new Error(`no detector for ${line}`);
    return found;
  };
  const embed = (app: Record<string, unknown>): CatalogTreeInput => ({
    id: 'blocks-embed',
    props: { block: { type: 'embed-app', title: 'Harbor widget', app } },
  });

  it('flags HTML sinks, code and unsandboxed iframes in app JSON, not plain data', () => {
    const sinks = detector(sinkLine);
    expect(sinks.appliesTo('blocks-embed')).toBe(true);
    expect(sinks.appliesTo('blocks-text')).toBe(false);
    expect(sinks.detect(embed({ view: { innerHTML: '<b>x</b>' } }))).toMatch(/HTML sink/);
    expect(sinks.detect(embed({ onLoad: 'eval(payload)' }))).toMatch(/code/);
    expect(sinks.detect(embed({ body: '<iframe src="https://widgets.example.com">' }))).toMatch(
      /without a sandbox/
    );
    expect(sinks.detect(embed({ title: 'Tide table', rows: [1, 2, 3] }))).toBeNull();
  });

  it('flags a widened sandbox and wildcard origins, not the default sandbox', () => {
    const sandbox = detector(sandboxLine);
    expect(sandbox.detect(embed({ sandbox: 'allow-scripts allow-same-origin' }))).toMatch(
      /allow-same-origin/
    );
    expect(sandbox.detect(embed({ targetOrigin: '*' }))).toMatch(/any origin/);
    expect(sandbox.detect(embed({ allowedOrigins: ['*'] }))).toMatch(/any origin/);
    expect(
      sandbox.detect(
        embed({
          sandbox: 'allow-scripts allow-forms',
          allowedOrigins: ['https://widgets.example.com'],
        })
      )
    ).toBeNull();
  });
});

describe('golden set: every reference passes the scorer', () => {
  for (const t of GOLDEN_TASKS) {
    it(`${t.id} passes all six checks, axe included`, async () => {
      const score = await scoreGoldenTree(t, t.reference, { axe: axeRunner, document });
      expect(score.checks.map((c) => c.check)).toEqual([...GOLDEN_CHECKS]);
      for (const check of score.checks) {
        expect(check.status, `${t.id} ${check.check}: ${check.issues.join(' | ')}`).toBe('pass');
      }
      expect(score.passed).toBe(true);
      expect(score.score).toBe(1);
    });
  }

  it('paints every content component for real, with the outline the grammar checked', async () => {
    const catalog = goldenRenderCatalog();
    for (const t of GOLDEN_TASKS) {
      const { roots } = renderCatalogTree(t.reference, { catalog, tier: 'untrusted' });
      const paint = await paintGoldenTree(roots, document, { title: t.title });
      try {
        expect(paint.issues, t.id).toEqual([]);
        const targets = [...document.querySelectorAll('[data-golden-component]')];
        expect(targets.length, t.id).toBeGreaterThan(0);
        for (const target of targets) {
          expect(
            target.querySelector('*'),
            `${t.id}: ${target.getAttribute('data-golden-component')} rendered nothing`
          ).not.toBeNull();
        }
        // The painted headings, in document order, are the projected outline.
        const painted = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) =>
          Number(h.tagName.slice(1))
        );
        const projected: number[] = [];
        const walk = (nodes: readonly RenderNode[]) => {
          for (const node of nodes) {
            if (node.kind !== 'component') continue;
            if (node.id === 'golden-heading') projected.push(node.props.level as number);
            walk(node.children);
          }
        };
        walk(projectOutline(roots));
        expect(painted, t.id).toEqual(projected);
      } finally {
        paint.destroy();
      }
    }
  }, 120_000);

  it('keeps the developer tier to emittable ids while retaining app chrome for tier-denied diagnostics', () => {
    const catalog = goldenRenderCatalog();
    expect(catalog.get('dialog')).toBeDefined();
    expect(catalog.allows?.('dialog', 'developer')).toBe(false);
    expect(catalog.allows?.('blocks-text', 'developer')).toBe(true);
    expect(catalog.allows?.('blocks-text', 'untrusted')).toBe(true);
  });
});

describe('golden scorer: each check fails on what it guards', () => {
  it('schema: accepts a valid family-owned diagram block in a golden tree', async () => {
    const tree = variant('g02-release-notes', (root) =>
      root.children.push({
        id: 'blocks-diagram',
        props: {
          block: {
            type: 'flow',
            nodes: [
              { id: 'start', label: 'Collect brief' },
              { id: 'ship', label: 'Ship prototype' },
            ],
          },
        },
      })
    );
    const score = await scoreGoldenTree(task('g02-release-notes'), tree);
    expect(score.checks.find((check) => check.check === 'schema')).toEqual({
      check: 'schema',
      status: 'pass',
      issues: [],
    });
  });

  it('schema: not a tree, unknown and tier-denied ids, bad blocks, a non-frame root', async () => {
    expect((await failing('g02-release-notes', 'just text')).failed).toContain('schema');
    expect(
      (await failing('g02-release-notes', [task('g02-release-notes').reference])).failed
    ).toContain('schema');
    const unknown = await failing(
      'g02-release-notes',
      variant('g02-release-notes', (t) => t.children.push({ id: 'marquee', props: {} }))
    );
    expect(unknown.failed).toEqual(['schema']);
    expect(unknown.issues('schema').join()).toContain('unknown-id');
    const denied = await failing(
      'g02-release-notes',
      variant('g02-release-notes', (t) => t.children.push({ id: 'dialog', props: { title: 'Hi' } }))
    );
    expect(denied.issues('schema').join()).toContain('tier-denied');
    const badBlock = await failing(
      'g02-release-notes',
      variant('g02-release-notes', (t) =>
        t.children.push({
          id: 'blocks-text',
          props: { block: { type: 'heading', level: 9, text: 'x' } },
        })
      )
    );
    expect(badBlock.failed).toContain('schema');
    expect(badBlock.issues('schema').join()).toMatch(/blocks-text: block/);
    const bareRoot = await failing('g02-release-notes', text('Only a paragraph.'));
    expect(bareRoot.issues('schema').join()).toContain('the root must be one of');
    const deep: { id: string; props: Record<string, unknown>; children: CatalogTreeInput[] } = {
      id: 'layout-page',
      props: { title: 'Deep' },
      children: [],
    };
    let cursor = deep;
    for (let i = 0; i < 20; i += 1) {
      const next: typeof deep = { id: 'layout-card', props: {}, children: [] };
      cursor.children.push(next);
      cursor = next;
    }
    expect((await failing('g02-release-notes', deep)).issues('schema').join()).toContain(
      'depth-exceeded'
    );
  });

  it('dontUseWhen: a link menu, account links, call-to-action buttons and chrome layouts', async () => {
    const menu = await failing(
      'g03-onboarding-handbook',
      variant('g03-onboarding-handbook', (t) =>
        t.children.unshift(list(['[Home](/)', '[Docs](/docs)', '[Team](/team)']))
      )
    );
    expect(menu.failed).toEqual(['dontUseWhen']);
    expect(menu.issues('dontUseWhen').join()).toContain('application navigation');
    const account = await failing(
      'g17-service-status',
      variant('g17-service-status', (t) =>
        t.children.push(text('[Sign in](https://example.com/login) to subscribe.'))
      )
    );
    expect(account.failed).toEqual(['dontUseWhen']);
    expect(account.issues('dontUseWhen').join()).toContain('account control');
    const buy = await failing(
      'g06-plan-comparison',
      variant('g06-plan-comparison', (t) =>
        t.children.push(text('[Buy the Team plan](https://example.com/buy)'))
      )
    );
    expect(buy.issues('dontUseWhen').join()).toContain('mutation');
    const chrome = await failing(
      'g30-feature-announcement',
      variant('g30-feature-announcement', (t) =>
        t.children.push({
          id: 'layout-card',
          props: { title: 'Sidebar' },
          children: [text('Links')],
        })
      )
    );
    expect(chrome.failed).toEqual(['dontUseWhen']);
    expect(chrome.issues('dontUseWhen').join()).toContain('app chrome');
    // Every trap task has a baited variant its detectors catch.
    for (const t of GOLDEN_TASKS.filter((g) => g.traps.length > 0)) {
      const baited = variant(t.id, (tree) =>
        tree.children.push(list(['[Home](/)', '[Pricing](/pricing)', '[Sign in](/login)']))
      );
      expect((await failing(t.id, baited)).failed, t.id).toContain('dontUseWhen');
    }
  });

  it('sinks: script URLs, HTML strings, style and class keys, handlers and bidi controls', async () => {
    const cases: [
      string,
      (t: CatalogTreeInput & { children: CatalogTreeInput[] }) => void,
      RegExp,
    ][] = [
      ['script link', (t) => t.children.push(text('[Open](javascript:alert(1))')), /executable/],
      ['html', (t) => t.children.push(text('<img src=x onerror=alert(1)>')), /executable|HTML/],
      [
        'style',
        (t) => Object.assign(t.props as object, { style: 'color: red' }),
        /forbidden "style"/,
      ],
      ['class', (t) => Object.assign(t.props as object, { class: 'hero' }), /forbidden "class"/],
      ['handler', (t) => Object.assign(t.props as object, { onClick: 'go()' }), /event handler/],
      [
        'bidi',
        (t) => t.children.push(text(`Total ${String.fromCharCode(0x202e)}001$`)),
        /bidi control/,
      ],
      [
        'unsafe src',
        (t) =>
          t.children.push({ id: 'media-image', props: { src: 'data:text/html,hi', alt: 'x' } }),
        /executable|URL policy/,
      ],
    ];
    for (const [name, edit, pattern] of cases) {
      const result = await failing('g11-team-photos', variant('g11-team-photos', edit));
      expect(result.failed, name).toContain('sinks');
      expect(result.issues('sinks').join(' '), name).toMatch(pattern);
    }
    // The raw output is judged, not the cleaned render: a script URL deep in a
    // chart's data passes the renderer's top-level prop checks, not this one.
    const hidden = variant('g09-hiring-funnel', (t) => {
      const funnel = t.children[0]?.children?.[0] as unknown as {
        props: { steps: { label: string }[] };
      };
      (funnel.props.steps[0] as { label: string }).label = 'javascript:alert(1)';
    });
    expect((await failing('g09-hiring-funnel', hidden)).failed).toEqual(['sinks']);
  });

  it('grammar: skipped heading ranks, a second h1 and a second main', async () => {
    const skip = await failing(
      'g02-release-notes',
      variant('g02-release-notes', (t) =>
        t.children.unshift({
          id: 'blocks-text',
          props: { block: { type: 'heading', level: 4, text: 'Deep' } },
        })
      )
    );
    expect(skip.failed).toEqual(['grammar']);
    expect(skip.issues('grammar').join()).toContain('heading-skip');
    const twoH1 = await failing(
      'g02-release-notes',
      variant('g02-release-notes', (t) =>
        t.children.push({
          id: 'blocks-text',
          props: { block: { type: 'heading', level: 1, text: 'Again' } },
        })
      )
    );
    expect(twoH1.issues('grammar').join()).toContain('heading-multiple-h1');
    const twoMains = await failing(
      'g02-release-notes',
      variant('g02-release-notes', (t) =>
        t.children.push({ id: 'layout-doc', props: { title: 'Nested' }, children: [text('x')] })
      )
    );
    expect(twoMains.issues('grammar').join()).toMatch(/landmark/);
  });

  it('axe: a painted heading-order break fails, and is skipped without a DOM runner', async () => {
    // A part-whole chart renders an h3 title; directly under the page h1 that skips a rank.
    const tree = variant('g19-survey-results', (t) => {
      const pie = t.children[1]?.children?.[0] as CatalogTreeInput;
      t.children = [pie];
    });
    const withAxe = await failing('g19-survey-results', tree, true);
    expect(withAxe.failed).toContain('axe');
    expect(withAxe.issues('axe').join()).toContain('heading-order');
    expect(withAxe.failed).toContain('grammar');
    const offline = await scoreGoldenTree(
      task('g19-survey-results'),
      task('g19-survey-results').reference
    );
    expect(offline.checks.find((c) => c.check === 'axe')?.status).toBe('skipped');
    expect(offline.passed).toBe(true);
    expect(offline.score).toBe(1);
  });

  it('axe: a component that refuses its props is a paint failure', async () => {
    const tree = variant('g01-weekly-support-digest', (t) => {
      t.children.push({
        id: 'layout-card',
        props: { title: 'Broken' },
        children: [
          {
            id: 'charts-bar',
            props: {
              title: 'Bad',
              description: 'Bad series',
              series: [{ id: 'a', points: 'oops' }],
            },
          },
        ],
      });
    });
    const result = await failing('g01-weekly-support-digest', tree, true);
    expect(result.failed).toContain('axe');
  });

  it('coverage: an interface missing a required component', async () => {
    const result = await failing(
      'g04-quarterly-revenue',
      variant('g04-quarterly-revenue', (t) => {
        t.children = t.children.slice(0, 2);
      })
    );
    expect(result.failed).toEqual(['coverage']);
    expect(result.issues('coverage')).toEqual(['missing a charts-donut component']);
  });
});

describe('golden runs are report-only', () => {
  it('scores a model run, counts missing and unknown outputs, and never throws', async () => {
    const outputs: Record<string, unknown> = {};
    for (const t of GOLDEN_TASKS.slice(0, 10)) outputs[t.id] = t.reference;
    outputs['g11-team-photos'] = '<div>not a tree</div>';
    outputs['g99-unknown'] = {};
    const report = await scoreGoldenRun(outputs);
    expect(report.total).toBe(30);
    expect(report.passed).toBe(10);
    expect(report.missing).toHaveLength(19);
    expect(report.unknown).toEqual(['g99-unknown']);
    expect(report.checks.schema).toEqual({ passed: 10, ran: 30 });
    expect(report.checks.axe).toEqual({ passed: 0, ran: 0 });
    // Missing and non-tree outputs skip the checks that need a tree.
    expect(report.checks.grammar).toEqual({ passed: 10, ran: 10 });
    expect(report.checks.sinks).toEqual({ passed: 10, ran: 10 });
    const markdown = formatGoldenReport(report);
    expect(markdown).toContain('**10 of 30** tasks passed every check that ran.');
    expect(markdown).toContain('### g11-team-photos');
    expect(markdown).toContain('Ignored keys: g99-unknown');
    expect(markdown).not.toContain('### g30-feature-announcement');
    for (const junk of [null, 42, 'text', [1, 2]]) {
      await expect(scoreGoldenRun(junk)).resolves.toMatchObject({ passed: 0, total: 30 });
    }
  });

  it('texuli-golden prints the report and exits 0 whatever the scores; unreadable input exits 2', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'texuli-golden-'));
    const out: string[] = [];
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const file = join(dir, 'run.json');
      writeFileSync(
        file,
        JSON.stringify({ 'g02-release-notes': task('g02-release-notes').reference })
      );
      expect(await runGoldenCli([file])).toBe(0);
      expect(out.join('')).toContain('**1 of 30** tasks passed');
      out.length = 0;
      expect(await runGoldenCli([file, '--json'])).toBe(0);
      expect(JSON.parse(out.join('')).passed).toBe(1);
      writeFileSync(file, '{ not json');
      expect(await runGoldenCli([file])).toBe(2);
      expect(await runGoldenCli([])).toBe(2);
    } finally {
      write.mockRestore();
      err.mockRestore();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
