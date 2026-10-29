/**
 * English defaults for the chrome strings the engine catalog
 * (`@texuli/deck/engine` `DECK_MESSAGES`) does not carry yet. They join the
 * stage-only keys (`DECK_STAGE_MESSAGES`), so a host overrides them through
 * the same `messages` prop. Placeholders use the engine's `{name}` syntax.
 */
export const DECK_CHROME_MESSAGES = Object.freeze({
  'stage.counter': '{current} / {total}',
  'stage.jumpLabel': '{label}, {counter}',
  'stage.shortcut': 'Keys: {keys}',
  'stage.shortcutCloses': '(Esc closes it)',
  'stage.shortcutEscape': 'Keys: Esc',
  'stage.more': 'More',
  'stage.groupNavigate': 'Move around',
  'stage.groupView': 'View',
  'stage.groupPresent': 'Present',
  'stage.groupShare': 'Share and print',
  'stage.groupHelp': 'Help',
  'stage.groupDebug': 'Debug',
  'stage.groupTools': 'More tools',
  'stage.linkCopied': 'Link to this slide copied.',
  'stage.linkCopyFailed': 'Could not copy the link.',
  'stage.laserOff': 'Laser off',
  'stage.hintDismiss': 'Got it',
  'stage.fullscreenWindow':
    'Fills this window with the slides: this page cannot use the browser full screen. Press Esc to leave.',
} as const);
