// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DeckController, type DeckPlugin } from '../../packages/deck/src/engine/index.ts';
import { DECK_MARKDOWN_LIMITS, parseDeckMarkdown } from '../../packages/deck/src/markdown/index.ts';
import { type Deck, parseDeck } from '../../packages/deck/src/model/index.ts';
import {
  DeckStage,
  prefetchDeckSlides,
  slideBlockFamilies,
} from '../../packages/slides/src/stage/index.ts';

declare const process: { env: Record<string, string | undefined> };

const SLIDE_COUNT = 200;
const STEP_COUNT = 32;
const REPORT = process.env.TEXULI_PERF_REPORT === '1';

function report(name: string, ms: number): void {
  if (REPORT) console.log(`[perf] ${name}: ${ms.toFixed(3)} ms`);
}

function freeSlide(index: number) {
  return {
    id: `slide-${String(index + 1).padStart(3, '0')}`,
    title: `Slide ${index + 1}`,
    layout: 'free',
    ...(index === 0
      ? { steps: Array.from({ length: STEP_COUNT }, (_, step) => `Reveal ${step + 1}`) }
      : {}),
    blocks: [
      { type: 'heading', level: 1, text: `Slide ${index + 1}` },
      { type: 'text', markdown: 'A short, fictional performance fixture.' },
    ],
  };
}

function deckDraft() {
  return {
    formatVersion: 2,
    meta: { title: '200-slide performance fixture', locale: 'en' },
    style: { aspect: '16:9', motion: 'none' },
    slides: Array.from({ length: SLIDE_COUNT }, (_, index) => freeSlide(index)),
  };
}

function validDeck(): Deck {
  const parsed = parseDeck(deckDraft());
  if (!parsed.ok || !parsed.deck) throw new Error('The generated performance deck must be valid.');
  return parsed.deck;
}

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function markdownDeck(slides: number): string {
  return [
    '---',
    'title: 200-slide Markdown performance fixture',
    '---',
    '',
    ...Array.from({ length: slides }, (_, index) =>
      [
        index === 0 ? '' : '---',
        `# Slide ${index + 1}`,
        '',
        'A short fictional paragraph.',
        '',
      ].join('\n')
    ),
  ].join('\n');
}

afterEach(cleanup);

describe('slide engine performance at the 200-slide cap', () => {
  it('mounts the first slide under one second, keeps the stage window to three, and steps under a frame', async () => {
    expect(process.env.TEXULI_PERF).toBe('1');
    const deck = validDeck();
    let controller: DeckController | undefined;
    const captureController: DeckPlugin = {
      name: 'perf-controller-probe',
      setup(value) {
        controller = value;
      },
    };

    const renderStarted = performance.now();
    const mounted = render(DeckStage, {
      props: {
        deck,
        loadTheme: null,
        plugins: [captureController],
        syncHash: false,
      },
    });
    flushSync();
    await screen.findByText('Slide 1');
    const firstSlideMs = performance.now() - renderStarted;
    report('200-slide first stage render', firstSlideMs);
    expect(firstSlideMs).toBeLessThan(1_000);
    expect(
      mounted.container.querySelectorAll('[aria-roledescription="slide"]').length
    ).toBeLessThanOrEqual(3);
    expect(controller).toBeDefined();

    if (!controller) throw new Error('The stage did not expose its controller to the plugin.');
    const stepController = controller;
    const stepSamples: number[] = [];
    for (let cycle = 0; cycle < 4; cycle += 1) {
      stepController.goTo('slide-001');
      flushSync();
      for (let step = 0; step < STEP_COUNT; step += 1) {
        const started = performance.now();
        stepController.next();
        flushSync();
        stepSamples.push(performance.now() - started);
      }
    }
    const medianStepMs = percentile(stepSamples, 0.5);
    const p95StepMs = percentile(stepSamples, 0.95);
    report(`controller step median (${stepSamples.length} samples)`, medianStepMs);
    report(`controller step p95 (${stepSamples.length} samples)`, p95StepMs);
    expect(stepController.getState().stepCount).toBe(STEP_COUNT);
    expect(medianStepMs).toBeLessThan(16);
    expect(p95StepMs).toBeLessThan(16);
    mounted.unmount();
    stepController.destroy();
  });

  it('parses 200 Markdown slides within bounded time and stops at the documented limit', () => {
    expect(process.env.TEXULI_PERF).toBe('1');
    const source = markdownDeck(SLIDE_COUNT);
    expect(source.length).toBeLessThanOrEqual(DECK_MARKDOWN_LIMITS.bytes);

    const started = performance.now();
    const parsed = parseDeckMarkdown(source);
    const parseMs = performance.now() - started;
    report('parse 200 Markdown slides', parseMs);
    expect(parsed.ok).toBe(true);
    expect(parsed.deck?.slides).toHaveLength(SLIDE_COUNT);
    expect(parseMs).toBeLessThan(1_000);

    const overLimitStarted = performance.now();
    const overLimit = parseDeckMarkdown(markdownDeck(SLIDE_COUNT + 1));
    const overLimitMs = performance.now() - overLimitStarted;
    report('reject Markdown slide 201', overLimitMs);
    expect(overLimit.issues.some((issue) => issue.code === 'md-too-many-slides')).toBe(true);
    expect(overLimit.draft?.slides as unknown[] | undefined).toHaveLength(
      DECK_MARKDOWN_LIMITS.slides
    );
    expect(overLimitMs).toBeLessThan(1_000);
  });

  it('prefetches only the text block chunk for a text-only deck', async () => {
    const deck = validDeck();
    const textOnly = deck.slides.every(
      (slide) =>
        slide.layout === 'free' &&
        slide.blocks.every((block) => block.type === 'heading' || block.type === 'text')
    );
    expect(textOnly).toBe(true);
    expect(
      deck.slides.every((slide) => slideBlockFamilies(slide).join(',') === 'blocks-text')
    ).toBe(true);
    const loadFamily = vi.fn(async () => undefined);
    await prefetchDeckSlides(deck.slides, { loadFamily });
    expect(loadFamily).toHaveBeenCalledTimes(1);
    expect(loadFamily).toHaveBeenCalledWith('blocks-text');
  });
});
