/**
 * A controllable stand-in for the Web Animations API: each `element.animate`
 * call returns a FakeAnimation the test finishes, cancels or inspects.
 */

export class FakeAnimation {
  readonly keyframes: Keyframe[] | PropertyIndexedKeyframes;
  readonly options: KeyframeAnimationOptions;
  readonly target: Element;
  currentTime: number | null = 0;
  playbackRate = 1;
  playState: 'running' | 'paused' | 'finished' | 'idle' = 'running';
  onfinish: (() => void) | null = null;
  oncancel: (() => void) | null = null;
  readonly finished: Promise<FakeAnimation>;
  calls: string[] = [];
  #resolve: (value: FakeAnimation) => void = () => {};
  #reject: (reason: unknown) => void = () => {};

  constructor(
    target: Element,
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options: KeyframeAnimationOptions
  ) {
    this.target = target;
    this.keyframes = keyframes;
    this.options = options;
    this.finished = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  finish(): void {
    if (this.playState === 'finished' || this.playState === 'idle') return;
    this.calls.push('finish');
    this.playState = 'finished';
    this.onfinish?.();
    this.#resolve(this);
  }

  cancel(): void {
    this.calls.push('cancel');
    if (this.playState === 'finished' || this.playState === 'idle') return;
    this.playState = 'idle';
    this.oncancel?.();
    this.#reject(new Error('AbortError'));
  }

  reverse(): void {
    this.calls.push('reverse');
    this.playbackRate *= -1;
  }

  pause(): void {
    this.calls.push('pause');
    this.playState = 'paused';
  }

  play(): void {
    this.calls.push('play');
    this.playState = 'running';
  }
}

/** Install a fake `animate` on the element and collect every animation it starts. */
export function stubAnimate(element: Element, log?: string[]): FakeAnimation[] {
  const started: FakeAnimation[] = [];
  (element as unknown as { animate: unknown }).animate = (
    keyframes: Keyframe[] | PropertyIndexedKeyframes,
    options: KeyframeAnimationOptions
  ) => {
    log?.push('write');
    const animation = new FakeAnimation(element, keyframes, options);
    started.push(animation);
    return animation;
  };
  return started;
}

/** Remove the Web Animations API from one element. */
export function removeAnimate(element: Element): void {
  (element as unknown as { animate: unknown }).animate = undefined;
}

export type Box = { left: number; top: number; width: number; height: number };

/** Give the element a controllable box and log every read. */
export function stubBox(
  element: Element,
  box: Box,
  log?: string[]
): { set: (next: Partial<Box>) => void } {
  let current = { ...box };
  element.getBoundingClientRect = () => {
    log?.push('read');
    return {
      ...current,
      x: current.left,
      y: current.top,
      right: current.left + current.width,
      bottom: current.top + current.height,
      toJSON: () => current,
    } as DOMRect;
  };
  return {
    set(next) {
      current = { ...current, ...next };
    },
  };
}

/** A connected element. */
export function attached(tag = 'div'): HTMLElement {
  const element = document.createElement(tag);
  document.body.append(element);
  return element;
}

/** Let pending promise callbacks run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}
