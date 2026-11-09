import { type DeckController, type DeckState, type SchedulerClock } from '@texuli/deck/engine';
import type { Deck, DeckThemeInput } from '@texuli/deck/model';
import {
  createSlidesDemoController,
  getSlidesDemoFixture,
  type SlidesDemoScenarioId,
} from './fixtures/index.ts';

export {
  getSlidesDemoFixture,
  SLIDES_DEMO_SCENARIOS,
  type SlidesDemoScenarioId,
} from './fixtures/index.ts';

export type SlidesDemoAction =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'play' }
  | { type: 'theme' }
  | { type: 'view-source' }
  | { type: 'reset' }
  | { type: 'scenario'; id: SlidesDemoScenarioId };

export interface SlidesDemoSnapshot {
  scenarioId: SlidesDemoScenarioId;
  deck: Deck;
  location: DeckState;
  slideNumber: number;
  slideCount: number;
  playing: boolean;
  sourceVisible: boolean;
  source: string | null;
  theme: DeckThemeInput;
}

export interface SlidesDemoModel {
  getSnapshot(): SlidesDemoSnapshot;
  dispatch(action: SlidesDemoAction): SlidesDemoSnapshot;
  destroy(): void;
}

export function createSlidesDemoModel(
  clock?: SchedulerClock,
  initialScenario: SlidesDemoScenarioId = 'texuli-in-motion'
): SlidesDemoModel {
  let scenarioId = initialScenario;
  let deck = getSlidesDemoFixture(scenarioId);
  let controller: DeckController = createSlidesDemoController(deck, clock);
  let playing = false;
  let sourceVisible = false;
  let baseTheme = deck.style?.theme ?? 'ocean';
  let alternateTheme = false;

  const setScenario = (id: SlidesDemoScenarioId): void => {
    controller.destroy();
    scenarioId = id;
    deck = getSlidesDemoFixture(id);
    controller = createSlidesDemoController(deck, clock);
    playing = false;
    sourceVisible = false;
    baseTheme = deck.style?.theme ?? 'ocean';
    alternateTheme = false;
  };

  const snapshot = (): SlidesDemoSnapshot => {
    const state = controller.getState();
    return {
      scenarioId,
      deck,
      location: state,
      slideNumber: state.slideIndex + 1,
      slideCount: deck.slides.length,
      playing,
      sourceVisible,
      source: sourceVisible ? JSON.stringify(deck, null, 2) : null,
      theme: deck.style?.theme ?? baseTheme,
    };
  };

  const pausePlayback = (): void => {
    if (!playing) return;
    controller.pause();
    playing = false;
  };

  return {
    getSnapshot: snapshot,
    dispatch(action) {
      switch (action.type) {
        case 'next':
          pausePlayback();
          controller.next({ source: 'pointer' });
          break;
        case 'prev':
          pausePlayback();
          controller.prev({ source: 'pointer' });
          break;
        case 'play':
          if (playing) controller.pause();
          else controller.resume();
          playing = !playing;
          break;
        case 'theme': {
          alternateTheme = !alternateTheme;
          const theme = alternateTheme ? 'graphite' : baseTheme;
          deck = { ...deck, style: { ...deck.style, theme } };
          break;
        }
        case 'view-source':
          sourceVisible = !sourceVisible;
          break;
        case 'scenario':
          setScenario(action.id);
          break;
        case 'reset':
          controller.pause();
          controller.first();
          playing = false;
          sourceVisible = false;
          alternateTheme = false;
          deck = { ...deck, style: { ...deck.style, theme: baseTheme } };
          break;
      }
      return snapshot();
    },
    destroy() {
      controller.destroy();
    },
  };
}
