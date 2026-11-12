import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SchedulerClock } from '@texuli/deck/engine';
import { createDeckController } from '@texuli/deck/engine';
import { parseDeck } from '@texuli/deck/model';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createSlidesDemoModel,
  getSlidesDemoFixture,
  SLIDES_DEMO_SCENARIOS,
  type SlidesDemoModel,
} from '../../src/components/solutions/slides/demo/model.ts';

const WEBSITE_PUBLIC = resolve(import.meta.dirname, '../../public');

class ManualClock implements SchedulerClock {
  private time = 0;
  private nextId = 0;
  private tasks = new Map<number, { at: number; callback: () => void }>();

  setTimeout(callback: () => void, delayMs: number): unknown {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.time + delayMs, callback });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.tasks.delete(handle as number);
  }

  now(): number {
    return this.time;
  }

  advance(delayMs: number): void {
    this.time += delayMs;
    const due = [...this.tasks.entries()]
      .filter(([, task]) => task.at <= this.time)
      .sort(([, left], [, right]) => left.at - right.at);
    for (const [id, task] of due) {
      this.tasks.delete(id);
      task.callback();
    }
  }
}

const models: SlidesDemoModel[] = [];

function model(clock = new ManualClock()): SlidesDemoModel {
  const instance = createSlidesDemoModel(clock);
  models.push(instance);
  return instance;
}

afterEach(() => {
  for (const instance of models.splice(0)) instance.destroy();
});

describe('slides demo fixtures', () => {
  it('provides deterministic model-v2 fixtures with the primary six-to-nine-slide story', () => {
    const primary = getSlidesDemoFixture('texuli-in-motion');
    expect(primary.meta.title).toBe('Texuli launch keynote');
    expect(primary.slides).toHaveLength(7);
    expect(primary.slides.map((slide) => slide.id)).toEqual([
      'pieces',
      'compare',
      'packages',
      'layers',
      'history',
      'agents',
      'close',
    ]);
    expect(primary.slides.map((slide) => slide.layout)).toEqual([
      'title-hero',
      'image-right',
      'big-stat',
      'three-column-cards',
      'timeline',
      'image-left',
      'closing-cta',
    ]);
  });

  it('gives each scenario its own theme and real, relative images that ship with the site', () => {
    const themes = new Set<string>();
    for (const { id } of SLIDES_DEMO_SCENARIOS) {
      const deck = getSlidesDemoFixture(id);
      themes.add(String(deck.style?.theme));
      for (const slide of deck.slides) {
        const image = (slide as { props?: { image?: { src: string; alt: string } } }).props?.image;
        if (!image) continue;
        expect(image.src, `${id} ${slide.id}`).toMatch(/^demo-media\/[a-z-]+\.webp$/);
        expect(image.alt.length, `${id} ${slide.id}`).toBeGreaterThan(20);
        const file = resolve(WEBSITE_PUBLIC, 'solutions/slides', image.src);
        expect(existsSync(file), file).toBe(true);
      }
    }
    expect(themes.size).toBe(SLIDES_DEMO_SCENARIOS.length);
  });

  it('validates every scenario with the published deck model parser', () => {
    for (const { id } of SLIDES_DEMO_SCENARIOS) {
      const deck = getSlidesDemoFixture(id);
      expect(parseDeck(deck).ok, id).toBe(true);
      expect(deck.slides.length, id).toBeGreaterThanOrEqual(5);
      expect(deck.slides.length, id).toBeLessThanOrEqual(9);
    }
  });

  it('feeds validated fixtures to the public deck controller API', () => {
    const deck = getSlidesDemoFixture('texuli-in-motion');
    const controller = createDeckController(deck);
    expect(controller.getState().slideId).toBe('pieces');
    expect(controller.next().slideId).toBe('compare');
    expect(controller.prev().slideId).toBe('pieces');
    controller.destroy();
  });
});

describe('slides demo model actions', () => {
  it('drives next, previous, Play, Theme, source view, and reset on the deck controller', () => {
    const clock = new ManualClock();
    const demo = model(clock);

    expect(demo.getSnapshot()).toMatchObject({
      scenarioId: 'texuli-in-motion',
      slideNumber: 1,
      slideCount: 7,
      playing: false,
      sourceVisible: false,
    });
    expect(demo.dispatch({ type: 'next' }).location.slideId).toBe('compare');
    expect(demo.dispatch({ type: 'prev' }).location.slideId).toBe('pieces');

    expect(demo.dispatch({ type: 'play' }).playing).toBe(true);
    clock.advance(5_000);
    expect(demo.getSnapshot().location.slideId).toBe('compare');
    expect(demo.dispatch({ type: 'play' }).playing).toBe(false);

    const originalTheme = demo.getSnapshot().theme;
    expect(demo.dispatch({ type: 'theme' }).theme).toBe('graphite');
    expect(demo.dispatch({ type: 'view-source' }).source).toContain('Texuli launch keynote');
    const reset = demo.dispatch({ type: 'reset' });
    expect(reset).toMatchObject({
      slideNumber: 1,
      playing: false,
      sourceVisible: false,
      source: null,
      theme: originalTheme,
    });
    clock.advance(10_000);
    expect(demo.getSnapshot().location.slideId).toBe('pieces');

    demo.dispatch({ type: 'play' });
    expect(demo.dispatch({ type: 'next' })).toMatchObject({
      location: { slideId: 'compare' },
      playing: false,
    });
    clock.advance(5_000);
    expect(demo.getSnapshot().location.slideId).toBe('compare');
  });

  it('switches deterministic scenarios and reset restores that fixture', () => {
    const demo = model();
    demo.dispatch({ type: 'next' });
    const switched = demo.dispatch({ type: 'scenario', id: 'data-report' });
    expect(switched).toMatchObject({
      scenarioId: 'data-report',
      slideNumber: 1,
      slideCount: 7,
      location: { slideId: 'opening' },
    });
    expect(demo.dispatch({ type: 'next' }).location.slideId).toBe('trend');
    expect(demo.dispatch({ type: 'reset' }).location.slideId).toBe('opening');
  });
});
