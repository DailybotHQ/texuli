/**
 * Stage messages: the engine's `DECK_MESSAGES` (every chrome string) plus the
 * few strings only the stage core needs (its region label, the slide
 * announcement, the invalid-deck state and the renderer placeholders).
 *
 * Every user-visible string in `@texuli/slides/stage` resolves through
 * {@link createDeckTranslator}, so a host localizes the stage by passing
 * partial overrides (`messages`) next to `meta.locale`. Placeholders use the
 * engine's `{name}` syntax; unknown placeholders are left intact.
 */
import {
  DECK_MESSAGES,
  type DeckMessageKey,
  formatMessage,
  type MessageValues,
} from '@texuli/deck/engine';
import { DECK_CHROME_MESSAGES } from './chrome/messages.ts';
import { DECK_PRESENTER_MESSAGES } from './presenter/messages.ts';

/**
 * Stage-only English defaults. Candidates to move into the engine catalog
 * (`@texuli/deck/engine` `DECK_MESSAGES`) once its owner adds them.
 */
export const DECK_STAGE_MESSAGES = Object.freeze({
  'stage.label': 'Presentation: {title}',
  'stage.announce': 'Slide {current} of {total}: {title}',
  'stage.announceStep': 'Slide {current} of {total}: {title}, step {step} of {steps}',
  'stage.untitledSlide': 'Slide {current}',
  'stage.invalidTitle': 'This deck could not be shown.',
  'stage.invalidSummary': '{count} problems were found in the deck.',
  'stage.invalidMore': 'And {count} more.',
  'stage.layoutPending': 'The {layout} layout is not available in this stage yet.',
  'stage.componentPending': 'The {component} component is not available in this stage yet.',
  'stage.customPending': 'The host has no renderer for the custom slide {component}.',
  'stage.mediaRefused': 'This media was not shown: its source is not allowed here.',
  'stage.closeOverview': 'Close overview',
  'stage.fullscreenFallback':
    'Full screen is not available here, so the presentation fills the window. Press Escape to leave.',
  'stage.fullscreenRefused':
    'The browser refused full screen, so the presentation fills the window. Press Escape to leave.',
  'stage.nextStep': 'Step {current} of {total} on this slide',
  // The stage-level trust signal shown at the untrusted paint tier (`trustBadge`).
  'stage.untrustedBadge': 'Untrusted content',
  // Chrome strings (toolbar, jump list, tooltips, help, toast), owned by `chrome/`.
  ...DECK_CHROME_MESSAGES,
  // Overview and presenter strings, owned by `overview/` and `presenter/`.
  ...DECK_PRESENTER_MESSAGES,
} as const);

export type DeckStageOnlyMessageKey = keyof typeof DECK_STAGE_MESSAGES;
/** Every key the stage resolves: the engine catalog plus the stage-only keys. */
export type DeckStageMessageKey = DeckMessageKey | DeckStageOnlyMessageKey;
/** Partial, type-checked overrides a host passes as the `messages` prop. */
export type DeckStageMessages = Partial<Record<DeckStageMessageKey, string>>;

/** Resolve one key with `{name}` values. */
export type DeckTranslate = (key: DeckStageMessageKey, values?: MessageValues) => string;

const PLACEHOLDER = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

function isEngineKey(key: string): key is DeckMessageKey {
  return Object.hasOwn(DECK_MESSAGES, key);
}

/**
 * A translator over the defaults and `overrides`. Non-string overrides are
 * ignored (the defaults stay), so a malformed host table cannot blank the UI.
 */
export function createDeckTranslator(overrides: DeckStageMessages = {}): DeckTranslate {
  const own: DeckStageMessages = {};
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (typeof value === 'string') own[key as DeckStageMessageKey] = value;
  }
  return (key, values = {}) => {
    if (isEngineKey(key)) return formatMessage(key, values, own);
    const template = own[key] ?? DECK_STAGE_MESSAGES[key];
    return template.replace(PLACEHOLDER, (match, name: string) =>
      Object.hasOwn(values, name) ? String(values[name]) : match
    );
  };
}
