/**
 * Static copy for /motion-page/: the runtime's pieces, the demo sections,
 * the rules every animation keeps and the one API contract. Plain data, so
 * the page and its tests share one source (labels are text, never HTML).
 */

/** The release the motion system first ships in (on npm, in development, pre-1.0). */
export const MOTION_RELEASE = '0.6.0';

export interface MotionPiece {
  readonly name: string;
  readonly role: string;
}

/** The texels of `@texuli/core/motion`, each one small piece. */
export const MOTION_PIECES: readonly MotionPiece[] = [
  { name: 'animate', role: 'Web Animations, one run' },
  { name: 'presence', role: 'enter and exit, reversible' },
  { name: 'flip', role: 'reorder, insert, remove' },
  { name: 'shared', role: 'one element, two places' },
  { name: 'timeline', role: 'play, pause, seek, reverse' },
  { name: 'stagger', role: 'offsets, capped at 1 s' },
  { name: 'spring', role: 'a pure solver, linear() curves' },
  { name: 'levels', role: 'full, subtle, none' },
];

export interface MotionSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export const MOTION_SECTIONS: readonly MotionSection[] = [
  {
    id: 'settings',
    title: 'Motion level and reduced motion',
    summary:
      'Every demo on this page reads these two settings through MotionProvider or the runtime options. Lower the level, or turn on reduced motion, and watch the same code commit its end state at once.',
  },
  {
    id: 'presence',
    title: 'Presence: overlays that enter and leave',
    summary:
      'Dialog, Sheet and the Toaster animate through the shared runtime. Pick the presets: they are the same closed names an agent can use. A closed overlay gives focus back and lifts inert at once; only the paint waits for the exit.',
  },
  {
    id: 'layout',
    title: 'Layout: lists and boards that glide',
    summary:
      'FLIP measures every item before a change and plays each one from where it was. The list below uses the same seam as the Board from @texuli/data, so a reorder, an insert or a committed move glides instead of jumping.',
  },
  {
    id: 'shared',
    title: 'Shared elements: one card, two places',
    summary:
      'Open a card and its preview grows into the detail view; go back and it returns to the grid. The registry measures the element before the change and plays the new one from that box.',
  },
  {
    id: 'timeline',
    title: 'Timelines and stagger',
    summary:
      'Declared steps on one clock: play, pause, seek, reverse. Stagger spreads the tiles from the start, the center or the end, and the whole spread is held to 1,000 ms however many items there are.',
  },
  {
    id: 'springs',
    title: 'Springs',
    summary:
      'Three spring tokens solved by the owned damped-oscillator solver. Each curve is precomputed as a CSS linear() easing, so the browser plays it on its compositor; the plot below is drawn from the same solver.',
  },
  {
    id: 'tokens',
    title: 'Tokens explorer',
    summary:
      'Five durations, five easings and three springs, as data in @texuli/tokens/motion and as --tx-motion-* custom properties. Play any token to see it; under reduced motion every duration is 0 ms.',
  },
  {
    id: 'blueprint',
    title: 'Motion as data: an agent declares it, the player paints it',
    summary:
      'A blueprint names presets and token steps, never keyframes, CSS or milliseconds. The player checks the vocabulary, plays the checked copy through the same runtime, and paints a refused motion without animating it.',
  },
  {
    id: 'rules',
    title: 'The rules every animation keeps',
    summary: 'They hold by construction in the runtime, not by care in each component.',
  },
  {
    id: 'api-contract',
    title: 'One API contract',
    summary:
      'Motion is one prop in a contract every exported component follows, so a styled component, a primitive and an agent blueprint behave the same way.',
  },
];

/** The rules, each backed by the runtime or a test (ADR-013, docs/STANDARDS.md). */
export const MOTION_RULES: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Reduced motion is instant',
    body: 'Under prefers-reduced-motion, a provider override or level none, every texel commits the end state at once: no frames run, the finished promise resolves "instant" and callbacks fire in order.',
  },
  {
    title: 'Nothing animates on hydration',
    body: 'The server paints the end state. Content present on the first render never animates in; animations start only after mount.',
  },
  {
    title: 'No lasting inline style',
    body: 'Every animation plays with fill "none"; the final state lives in classes, attributes or props. That keeps the strict style CSP of this site intact.',
  },
  {
    title: 'The compositor interpolates',
    body: 'Everything plays through the Web Animations API; no requestAnimationFrame loop writes styles. Springs become linear() easings.',
  },
  {
    title: 'Focus never waits',
    body: 'A closing overlay returns focus, lifts inert and leaves the layer stack at once; only its paint waits for the exit, at most 1.2 s.',
  },
  {
    title: 'Hostile input is clamped',
    body: 'Durations and delays are at most 1,000 ms; spring parameters, sample counts, FLIP deltas and list sizes have fixed ranges. Promises never reject.',
  },
];

export interface MotionLevelRow {
  readonly level: 'full' | 'subtle' | 'none';
  readonly effect: string;
}

export const MOTION_LEVEL_ROWS: readonly MotionLevelRow[] = [
  { level: 'full', effect: 'Every preset plays at its token duration.' },
  {
    level: 'subtle',
    effect:
      'Durations shrink to 60%, and travel and scale are dropped: a move commits at once, a fade stays.',
  },
  { level: 'none', effect: 'Nothing animates: every change commits at once.' },
];

export interface ContractPoint {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** A short code sample (shown as text, never HTML). */
  readonly code: string;
}

/** The component API contract, as docs/STANDARDS.md states it. */
export const CONTRACT_POINTS: readonly ContractPoint[] = [
  {
    id: 'ref-rest',
    title: 'Rest attributes and ref',
    body: 'Attributes a component does not consume (id, aria-*, data-*, class, style, handlers) land on its root element, and bind:ref binds that same element. Form controls with a field wrapper send aria-*, data-* and handlers to the control and layout hooks to the wrapper.',
    code: '<Dialog bind:ref={panel} data-testid="crew" aria-describedby="crew-hint" />',
  },
  {
    id: 'handlers',
    title: 'Handlers compose: the caller first',
    body: "A handler you pass never replaces the component's own. It runs first; for actions (click, keydown, pointerdown) event.preventDefault() skips the built-in behavior, and bookkeeping (focus, blur, scroll) always runs.",
    code: '<Button onclick={(event) => { if (locked) event.preventDefault(); }}>Archive</Button>',
  },
  {
    id: 'callbacks',
    title: 'One naming rule for callbacks',
    body: 'Lowercase on<event> props are DOM handlers on the root element. camelCase on<Name> props are typed component callbacks (onValueChange, onOpenChange, onDismissRequest); a callback that can be vetoed gets an event with preventDefault().',
    code: '<Select onValueChange={(value) => save(value)} onkeydown={trackKeys} />',
  },
  {
    id: 'field',
    title: 'The Field rule',
    body: 'The id, aria-describedby, aria-invalid and disabled that a Field hands its control reach the focusable element, so the label focuses it and its description and error are announced: the input of TagsInput, the first thumb of a Slider, the first segment of a DatePicker.',
    code: '<Field label="Tags" description="Up to five">\n  {#snippet children(control)}<TagsInput {...control.props} />{/snippet}\n</Field>',
  },
  {
    id: 'providers',
    title: 'Providers render nothing',
    body: 'Roots that only hold state (menu, select, popover, dialog and toast providers, MotionProvider) and portals render no element of their own, so they take no ref or rest attributes.',
    code: '<MotionProvider level="subtle"><App /></MotionProvider>',
  },
  {
    id: 'motion-prop',
    title: 'One motion prop',
    body: 'Components that move take motion: { enter, exit, layout, duration } or false. The names are the closed spec vocabulary; never CSS, keyframes or milliseconds, and unknown names fall back to the default.',
    code: "<Dialog title=\"Edit crew\" motion={{ enter: 'rise', exit: 'fade', duration: 'slow' }} />",
  },
];

/** Package docs on GitHub (relative to the repository root). */
export const MOTION_DOCS: readonly { readonly label: string; readonly path: string }[] = [
  { label: 'Core motion texels', path: 'packages/core/docs/core-motion.md' },
  { label: 'Motion tokens', path: 'packages/tokens/docs/tokens-motion.md' },
  { label: 'The motion prop and MotionProvider', path: 'packages/texuli/docs/ui-motion.md' },
  { label: 'The spec motion vocabulary', path: 'packages/spec/docs/motion.md' },
  { label: 'Node motion in the player', path: 'packages/player/docs/reference.md' },
  { label: 'The component API contract', path: 'docs/STANDARDS.md' },
  {
    label: 'ADR-013: the motion runtime',
    path: 'docs/DECISIONS.md',
  },
];
