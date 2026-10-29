// @vitest-environment happy-dom
/**
 * /motion-page/ (PLAN_010 T-site-060): honest copy, fictional data, lazy
 * islands, sections that match the page, spring curves drawn from the token
 * data, the blueprint's motion inside the closed vocabulary (and the hostile
 * one refused at its node), the docs it points to, and the settings panel
 * and the list demo driven from the keyboard.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import {
  MOTION_LEVELS as DECK_MOTION_LEVELS,
  DECK_TRANSITIONS,
  FRAGMENT_EFFECTS,
  parseDeck,
} from '@texuli/deck/model';
import { MOTION_SPRING_NAMES, MOTION_SPRINGS } from '@texuli/tokens/motion';
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { ADOPTER_PATTERN, MOTION_ADOPTERS } from '../src/components/motion-site/adopters.ts';
import {
  HOSTILE_BLUEPRINT,
  MOTION_BLUEPRINT,
  MOTION_BLUEPRINT_JSON,
} from '../src/components/motion-site/blueprint.ts';
import { motionDeck, TRANSITION_TABLE } from '../src/components/motion-site/deck.ts';
import LayoutList from '../src/components/motion-site/LayoutList.svelte';
import MotionConsole from '../src/components/motion-site/MotionConsole.svelte';
import {
  CONTRACT_POINTS,
  MOTION_DOCS,
  MOTION_PIECES,
  MOTION_RELEASE,
  MOTION_SECTIONS,
} from '../src/components/motion-site/page.ts';
import { MOTION_SETTINGS } from '../src/components/motion-site/settings.svelte.ts';
import { PLOT, plotY, SPRING_CURVES } from '../src/components/motion-site/springs.ts';
import { checkBlueprintText } from '../src/components/workflows-site/json/validate.ts';

const read = (path: string) => readFileSync(resolve('apps/website/src', path), 'utf8');
const PAGE = read('pages/motion-page/index.astro');
const SOURCES = [
  'components/motion-site/BlueprintDemo.svelte',
  'components/motion-site/BoardDemo.svelte',
  'components/motion-site/ComponentGallery.svelte',
  'components/motion-site/DeckMotionDemo.svelte',
  'components/motion-site/LayoutList.svelte',
  'components/motion-site/MotionConsole.svelte',
  'components/motion-site/PresenceDemo.svelte',
  'components/motion-site/PresetGallery.svelte',
  'components/motion-site/SettingsNote.svelte',
  'components/motion-site/SharedDemo.svelte',
  'components/motion-site/SpringLab.svelte',
  'components/motion-site/SpringsDemo.svelte',
  'components/motion-site/TimelineDemo.svelte',
  'components/motion-site/TokensExplorer.svelte',
  'components/motion-site/adopters.ts',
  'components/motion-site/blueprint.ts',
  'components/motion-site/deck.ts',
  'components/motion-site/page.ts',
  'components/motion-site/settings.svelte.ts',
  'components/motion-site/springs.ts',
  'pages/motion-page/index.astro',
].map((path) => [path, read(path)] as const);

afterEach(() => {
  cleanup();
  MOTION_SETTINGS.level = 'full';
  MOTION_SETTINGS.reduced = false;
});

describe('motion page: copy and safety', () => {
  it('says the motion system is in development and on npm from 0.6.0, and that 0.5.0 is without it', () => {
    const copy = PAGE.replace(/\s+/g, ' ');
    expect(MOTION_RELEASE).toBe('0.6.0');
    expect(copy).toContain('texuli/motion · in development · on npm from {MOTION_RELEASE}');
    expect(copy).toContain(
      'The motion system is in development and on npm from <code>{MOTION_RELEASE}</code>, a pre-1.0 release; the previous release, <code>0.5.0</code>, is without it.'
    );
    expect(copy).toContain(
      'Spec <code>0.6.0</code> ships in the <code>0.6.0</code> release of <code>@texuli/spec</code>.'
    );
    expect(copy).not.toMatch(/unreleased|ships in \{MOTION_RELEASE\}/);
    // The contract story separates what 0.5.0 shipped from what 0.6.0 adds.
    expect(copy).toMatch(/<code>0\.5\.0<\/code> brought <code>bind:ref<\/code>/);
    expect(copy).toContain('<code>{MOTION_RELEASE}</code> brings the rest');
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/not (?:yet )?on npm|production[- ]ready|is released/i);
    }
  });

  it('renders no HTML from data and uses only fictional example.com addresses', () => {
    for (const [path, source] of SOURCES) {
      expect(source, path).not.toMatch(/\{@html|set:html|innerHTML/);
      for (const [url] of source.matchAll(/https?:\/\/[^\s'"`)]+/g)) {
        expect(new URL(url).hostname, `${path}: ${url}`).toMatch(/(^|\.)example\.com$/);
      }
      for (const [email] of source.matchAll(/[\w.+-]+@[\w-]+\.[\w.]+/g)) {
        expect(email, path).toMatch(/@example\.com$/);
      }
    }
  });

  it('mounts every island lazily with client:visible', () => {
    const islands = [...PAGE.matchAll(/<([A-Z]\w+) client:(\w+)/g)];
    expect(islands.map(([, name]) => name).sort()).toEqual([
      'BlueprintDemo',
      'BoardDemo',
      'ComponentGallery',
      'DeckMotionDemo',
      'LayoutList',
      'MotionConsole',
      'PresenceDemo',
      'PresetGallery',
      'SharedDemo',
      'SpringLab',
      'SpringsDemo',
      'TimelineDemo',
      'TokensExplorer',
    ]);
    for (const [, name, directive] of islands) expect(`${name} ${directive}`).toMatch(/ visible$/);
  });

  it('gives every section an anchor on the page and a unique id, with one h1', () => {
    const ids = MOTION_SECTIONS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PAGE).toContain(`id="${id}"`);
    expect(PAGE.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(MOTION_PIECES.map((piece) => piece.name)).toEqual([
      'animate',
      'presence',
      'flip',
      'shared',
      'timeline',
      'stagger',
      'spring',
      'levels',
    ]);
  });

  it('points at docs that exist and states the contract the standards document', () => {
    for (const doc of MOTION_DOCS) {
      expect(existsSync(resolve(doc.path)), doc.path).toBe(true);
    }
    const standards = readFileSync(resolve('docs/STANDARDS.md'), 'utf8');
    expect(standards).toContain('## Component API contract');
    expect(standards).toContain('### Motion prop contract');
    for (const phrase of [
      'Rest attributes and `ref`',
      'The Field rule',
      'Providers render nothing',
      'Handler order: the caller first',
      'Callback naming',
    ]) {
      expect(standards).toContain(phrase);
    }
    expect(CONTRACT_POINTS.map((point) => point.id)).toEqual([
      'ref-rest',
      'handlers',
      'callbacks',
      'field',
      'providers',
      'motion-prop',
    ]);
    // The motion prop sample names only closed vocabulary words.
    const sample = CONTRACT_POINTS.find((point) => point.id === 'motion-prop')?.code ?? '';
    expect(sample).toMatch(/enter: 'rise', exit: 'fade', duration: 'slow'/);
    expect(PAGE).toContain('id="api-contract"');
  });
});

describe('the spring plot', () => {
  it('draws one curve per spring token from the solver, from rest at 0 to 1', () => {
    expect(SPRING_CURVES.map((curve) => curve.name)).toEqual([...MOTION_SPRING_NAMES]);
    for (const curve of SPRING_CURVES) {
      const token = MOTION_SPRINGS[curve.name];
      expect(curve.stiffness).toBe(token.stiffness);
      expect(curve.damping).toBe(token.damping);
      expect(curve.mass).toBe(token.mass);
      expect(curve.durationMs).toBe(token.durationMs);
      expect(curve.path.startsWith(`M${PLOT.left} ${plotY(0)}`)).toBe(true);
      expect(curve.end.y).toBe(plotY(1));
      expect(curve.path.split(' L')).toHaveLength(60);
    }
    const peak = Object.fromEntries(SPRING_CURVES.map((curve) => [curve.name, curve.peak]));
    // Lower damping ratio, more overshoot.
    expect(peak.bouncy).toBeGreaterThan(peak.snappy as number);
    expect(peak.snappy).toBeGreaterThanOrEqual(peak.gentle as number);
    expect(peak.bouncy).toBeLessThan(1.25);
    const ratios = SPRING_CURVES.map((curve) => curve.ratio);
    expect(ratios).toEqual([0.91, 0.75, 0.46]);
  });
});

describe('the motion blueprint', () => {
  it('validates with zero errors at the untrusted tier and declares motion only as names', () => {
    const result = checkBlueprintText(MOTION_BLUEPRINT_JSON);
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(MOTION_BLUEPRINT.spec).toBe('0.6.0');
    expect(MOTION_BLUEPRINT_JSON).not.toMatch(/keyframes|cubic-bezier|\d+ms|transform/);
    expect(MOTION_BLUEPRINT_JSON).toMatch(/"stagger": "base"/);
  });

  it('refuses the hostile motion at its node and nothing else', () => {
    const result = checkBlueprintText(JSON.stringify(HOSTILE_BLUEPRINT));
    expect(result.ok).toBe(false);
    const errors = result.diagnostics.filter((entry) => entry.severity === 'error');
    expect(errors.map((entry) => [entry.code, entry.path])).toEqual([
      ['invalid-motion', '$.tree.children[1]'],
    ]);
  });
});

describe('the settings panel', () => {
  it('shows the token durations at each level and zero under reduced motion', async () => {
    const { container } = render(MotionConsole);
    const base = () => container.querySelector('[data-motion-duration="base"]')?.textContent;
    expect(base()).toBe('200 ms');
    await fireEvent.click(screen.getByRole('radio', { name: 'Subtle' }));
    expect(MOTION_SETTINGS.level).toBe('subtle');
    expect(base()).toBe('120 ms');
    await fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(base()).toBe('0 ms');
    await fireEvent.click(screen.getByRole('radio', { name: 'Full' }));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Reduced motion' }));
    expect(MOTION_SETTINGS.reduced).toBe(true);
    expect(base()).toBe('0 ms');
    expect(container.querySelector('[data-motion-duration="slower"]')?.textContent).toBe('0 ms');
  });

  it('commits the sample at once under reduced motion and at level none, and says why', async () => {
    const { container } = render(MotionConsole);
    const outcome = () => container.querySelector('[data-motion-outcome="console"]')?.textContent;
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Reduced motion' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Play sample' }));
    await tick();
    expect(outcome()).toBe('Instant: reduced-motion');
    await fireEvent.click(screen.getByRole('checkbox', { name: 'Reduced motion' }));
    await fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Play sample' }));
    await tick();
    expect(outcome()).toBe('Instant: level-none');
  });
});

describe('the layout list', () => {
  it('reorders, adds and removes from the keyboard, keeping focus on the moved item', async () => {
    render(LayoutList);
    const list = screen.getByRole('list', { name: 'Launch tasks' });
    const labels = () =>
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.querySelector('.task__label')?.textContent);
    expect(labels()).toEqual([
      'Write launch notes',
      'Refresh pricing page',
      'Check status page',
      'Send May invoices',
    ]);
    const down = screen.getByRole('button', { name: 'Move Write launch notes down' });
    down.focus();
    await fireEvent.click(down);
    await tick();
    await tick();
    expect(labels().slice(0, 2)).toEqual(['Refresh pricing page', 'Write launch notes']);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Write launch notes down');
    expect(screen.getByRole('status').textContent).toBe(
      'Write launch notes moved to position 2 of 4.'
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Sort A to Z' }));
    expect(labels()[0]).toBe('Check status page');
    await fireEvent.click(screen.getByRole('button', { name: 'Add a task' }));
    expect(labels()).toHaveLength(5);
    expect(labels()[0]).toBe('Draft the changelog');
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Draft the changelog' }));
    expect(labels()).toHaveLength(4);
    expect(screen.getByRole('status').textContent).toBe('Draft the changelog removed. 4 left.');
  });
});

describe('every animation is on the page', () => {
  it('lists every committed package source that animates through the runtime', () => {
    const tracked = execFileSync('git', ['ls-files', 'packages/*/src/**'], { encoding: 'utf8' })
      .split('\n')
      .filter((file) => /\.(ts|svelte)$/.test(file))
      .filter((file) => !/^packages\/(core\/src\/motion|texuli\/src\/motion)\//.test(file));
    const adopters = tracked.filter((file) =>
      ADOPTER_PATTERN.test(readFileSync(resolve(file), 'utf8'))
    );
    expect(adopters.length).toBeGreaterThan(20);
    expect(MOTION_ADOPTERS.map((entry) => entry.file).sort()).toEqual(adopters.sort());
    for (const adopter of MOTION_ADOPTERS) {
      if (adopter.live === '') continue; // its showcase page is planned
      if (adopter.live.startsWith('#'))
        expect(PAGE, adopter.live).toContain(`id="${adopter.live.slice(1)}"`);
      else expect(adopter.live).toMatch(/^\/[a-z-]+\/(?:[a-z-]+\/)?(?:#[a-z-]+)?$/);
    }
  });

  it('builds a valid deck at every level with every transition and every fragment effect', () => {
    for (const level of DECK_MOTION_LEVELS) {
      const deck = motionDeck(level);
      expect(parseDeck(deck).ok, level).toBe(true);
      const json = JSON.stringify(deck);
      for (const transition of DECK_TRANSITIONS)
        expect(json).toContain(`"transition":"${transition}"`);
      for (const effect of FRAGMENT_EFFECTS) expect(json).toContain(`"fragment":"${effect}"`);
    }
    expect(TRANSITION_TABLE.map((row) => row.transition)).toEqual([...DECK_TRANSITIONS]);
    const zoom = TRANSITION_TABLE.find((row) => row.transition === 'zoom');
    expect(zoom?.cells.map((cell) => `${cell.name}:${cell.ms}`)).toEqual([
      'zoom:350',
      'fade:180',
      'none:0',
      'fade:150',
    ]);
  });

  it('reads the inventory from the packages at build time, not from a hand-written list', () => {
    for (const module of [
      '@texuli/core/motion',
      '@texuli/core/motion/spring',
      '@texuli/tokens/motion',
      'texuli/motion',
    ]) {
      expect(PAGE).toContain(`from '${module}'`);
    }
    expect(PAGE).toContain('Object.keys(coreMotion)');
    expect(PAGE).toContain('motionVariables()');
  });
});
