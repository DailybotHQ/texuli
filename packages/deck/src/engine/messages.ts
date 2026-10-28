/**
 * English defaults for every stage chrome string, plus `formatMessage`.
 *
 * Consumers pass per-key overrides; `meta.locale` / `meta.dir` flow through
 * {@link resolveDeckLocale}. Placeholders use `{name}` syntax.
 */

export const DECK_MESSAGES = Object.freeze({
  'controls.previous': 'Previous step or slide',
  'controls.previousDescription': 'Goes back one step, or to the previous slide.',
  'controls.chooseSlide': 'Choose a slide',
  'controls.chooseSlideDescription': 'Opens the slide list so you can jump directly to a slide.',
  'controls.next': 'Next step or slide',
  'controls.nextDescription': 'Shows the next step, or advances to the next slide.',
  'controls.first': 'First slide',
  'controls.firstDescription': 'Jumps to the first slide.',
  'controls.last': 'Last slide',
  'controls.lastDescription': 'Jumps to the last slide.',
  'controls.overview': 'Overview of all slides',
  'controls.overviewDescription': 'Shows every slide as a grid.',
  'controls.fullscreen': 'Full screen',
  'controls.fullscreenDescription': 'Fills the screen with the slides.',
  'controls.leaveFullscreen': 'Leave full screen',
  'controls.leaveFullscreenDescription': 'Returns the deck to its normal place.',
  'controls.presenter': 'Presenter view',
  'controls.presenterDescription': 'Shows notes, the next slide and timers.',
  'controls.blackout': 'Black out the screen',
  'controls.blackoutDescription': 'Turns the screen black.',
  'controls.laser': 'Laser pointer',
  'controls.laserDescription': 'Turns the pointer into a bright dot.',
  'controls.copyLink': 'Copy link to this slide',
  'controls.copyLinkDescription': 'Copies a link to this slide and step.',
  'controls.print': 'Print, one slide per page',
  'controls.printDescription': 'Prints the deck or saves it as a PDF.',
  'controls.help': 'Controls and shortcuts',
  'controls.helpDescription': 'Lists every control and its keys.',
  'controls.debug': 'Debug for agents',
  'controls.debugDescription': 'Shows this slide source, checks and reference.',

  'chrome.toolbar': 'Deck controls',
  'chrome.navigate': 'Navigate',
  'chrome.more': 'More presentation controls',
  'chrome.fullscreenControls': 'Full screen controls',
  'chrome.blackoutHint': 'Screen blacked out. Press B or select to show the slide.',
  'chrome.hintMove': 'Use {key} to move,',
  'chrome.hintFullscreen': '{key} for full screen,',
  'chrome.hintHelp': '{key} for every control.',
  'chrome.buttonOnly': 'Button only',
  'chrome.copied': 'Copied',
  'chrome.copyFailed': 'Could not copy',
  'chrome.slideProgress': 'Deck progress',
  'chrome.chooseSlide': 'Choose a slide',
  'chrome.laserOn': 'Laser on',
  'chrome.close': 'Close',

  'overview.title': 'Slide overview',
  'overview.loading': 'Loading overview…',
  'overview.loadError': 'The overview could not be loaded.',
  'overview.slideNumber': 'Slide {current}',
  'overview.selectSlide': 'Go to slide {current}: {title}',

  'presenter.title': 'Presenter',
  'presenter.viewLabel': 'Presenter view',
  'presenter.elapsed': 'Elapsed',
  'presenter.slideTime': 'Slide',
  'presenter.now': 'Now',
  'presenter.next': 'Next',
  'presenter.currentSlide': 'Current slide',
  'presenter.nextSlide': 'Next slide',
  'presenter.endOfDeck': 'End of deck',
  'presenter.previous': 'Previous',
  'presenter.advance': 'Next',
  'presenter.notes': 'Speaker notes',
  'presenter.upNext': 'Up next',
  'presenter.noNotes': 'No notes for this slide.',
  'presenter.popupBlocked': 'Presenter window could not be opened.',
  'presenter.loading': 'Loading presenter…',
  'presenter.pause': 'Pause presentation',
  'presenter.resume': 'Resume presentation',

  'print.button': 'Print',
  'print.noSlides': 'This deck has no slides to print.',
  'print.notes': 'Speaker notes',
  'print.notesAppendix': 'Notes',
  'print.noNotes': 'No notes for this slide.',

  'debug.title': 'Debug for agents',
  'debug.close': 'Close',
  'debug.thisSlide': 'This slide',
  'debug.slide': 'Slide',
  'debug.position': 'Position',
  'debug.layout': 'Layout',
  'debug.pointer': 'Pointer',
  'debug.props': 'Props',
  'debug.deck': 'Deck',
  'debug.notes': 'Notes',
  'debug.actions': 'Actions',
  'debug.copyReference': 'Copy agent reference',
  'debug.copyPrompt': 'Copy as agent prompt',
  'debug.copySlideJson': 'Copy slide JSON',
  'debug.downloadJson': 'Download deck JSON',
  'debug.copyOutline': 'Copy outline',
  'debug.checks': 'Checks on this slide',
  'debug.noFindings': 'No findings on this slide.',
  'debug.otherFindings': 'Other slides with findings',
  'debug.blocks': 'Blocks',
  'debug.slideText': 'Slide text',
  'debug.noText': '(no text)',
  'debug.loading': 'Loading the debug panel…',
  'debug.loadError': 'The debug panel could not be loaded.',
  'debug.unnamedDeck': 'unnamed',

  'layout.contentUnavailable': 'This part of the slide could not be shown.',
  'layout.emptySlide': 'This slide has no content yet.',
  'layout.contentLoadError': 'Slide content could not be loaded.',
  'layout.contentLoading': 'Loading slide content…',

  'stage.controls': 'Presentation controls',
  'stage.elapsedTime': 'Elapsed time',
  'stage.notes': 'Speaker notes',
  'stage.upNext': 'Up next',
  'stage.slides': 'Slides',
  'stage.emptyNotes': 'No notes for this slide.',
  'stage.emptyContent': 'This slide has no content yet.',
  'stage.loadingOverview': 'Loading overview…',
  'stage.overviewError': 'The overview could not be loaded.',
  'stage.loadingPresenter': 'Loading presenter…',
  'stage.loadingDebug': 'Loading the debug panel…',
  'stage.debugError': 'The debug panel could not be loaded.',
  'stage.slideOf': 'Slide {current} of {total}',
  'stage.stepOf': 'Step {current} of {total}',
} as const);

export type DeckMessageKey = keyof typeof DECK_MESSAGES;
export type DeckMessages = Partial<Record<DeckMessageKey, string>>;
export type MessageValues = Readonly<Record<string, string | number>>;

export interface DeckLocale {
  locale?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
}

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

/**
 * Resolve a message key with optional overrides and `{name}` placeholders.
 * Unknown placeholders are left intact.
 */
export function formatMessage(
  key: DeckMessageKey,
  values: MessageValues = {},
  overrides: DeckMessages = {}
): string {
  const template = overrides[key] ?? DECK_MESSAGES[key];
  return template.replace(PLACEHOLDER, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

/** Merge deck meta and host overrides into a concrete locale. */
export function resolveDeckLocale(
  deck?: DeckLocale | null,
  override?: DeckLocale | null
): Required<DeckLocale> {
  return {
    locale: override?.locale ?? deck?.locale ?? 'en',
    dir: override?.dir ?? deck?.dir ?? 'auto',
  };
}
