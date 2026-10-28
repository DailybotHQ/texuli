/**
 * English defaults for the overview and presenter strings the engine catalog
 * (`@texuli/deck/engine` `DECK_MESSAGES`) does not carry yet. They join the
 * stage-only keys (`DECK_STAGE_MESSAGES`), so a host overrides them through
 * the same `messages` prop. Placeholders use the engine's `{name}` syntax.
 */
export const DECK_PRESENTER_MESSAGES = Object.freeze({
  'stage.overviewHint':
    'Arrow keys move between slides, Enter opens one, Escape closes the overview.',
  // An overview card's description (its name is the visible number and title).
  'stage.overviewCardPosition': 'slide {current} of {total}',
  'stage.presenterTimers': 'Timers',
  'stage.pauseTimers': 'Pause timers',
  'stage.startTimers': 'Start timers',
  'stage.resetTimers': 'Reset timers',
  'stage.slidePreview': 'Preview: {title}',
  'stage.openPresenterWindow': 'Open presenter window',
  'stage.closePresenterWindow': 'Close presenter window',
  'stage.presenterWindowTitle': 'Presenter: {title}',
  'stage.presenterBlocked':
    'The browser blocked the presenter window, so the presenter view stays on this page.',
  'stage.presenterNoChannel':
    'This browser cannot link two windows, so the presenter view stays on this page.',
  'stage.presenterNoWindow':
    'No second window is available here, so the presenter view stays on this page.',
  'stage.presenterLoadError':
    'The presenter window could not be loaded, so the presenter view stays on this page.',
} as const);
