/**
 * One shape for the two same-origin links a stage may follow: the engine's
 * closed presenter protocol v1 (`PresenterTransport`, the v2 path) and the v1
 * `DeckSync` link (kept for existing hosts).
 */
import type { PresenterTransport } from '@texuli/deck/engine';
import { presenterMessage } from '@texuli/deck/engine';
import type { DeckSync } from './sync.ts';

export type DeckSyncSignal =
  | { kind: 'hello' }
  | { kind: 'position'; slideId: string; step: number };

export interface DeckSyncLink {
  hello(slideId: string, step: number): void;
  post(slideId: string, step: number): void;
  subscribe(listener: (signal: DeckSyncSignal) => void): () => void;
}

function isLegacy(link: PresenterTransport | DeckSync): link is DeckSync {
  return typeof (link as DeckSync).hello === 'function';
}

export function deckSyncLink(
  link: PresenterTransport | DeckSync | null | undefined
): DeckSyncLink | null {
  if (!link) return null;
  if (isLegacy(link)) {
    return {
      hello: () => link.hello(),
      post: (slideId, step) => link.post({ slideId, step }),
      subscribe: (listener) =>
        link.subscribe((message) =>
          listener(
            message.kind === 'hello'
              ? { kind: 'hello' }
              : { kind: 'position', slideId: message.slideId, step: message.step }
          )
        ),
    };
  }
  const send = (type: 'hello' | 'sync', slideId: string, step: number) => {
    const message = presenterMessage(type, slideId, step);
    if (message) link.post(message);
  };
  return {
    hello: (slideId, step) => send('hello', slideId, step),
    post: (slideId, step) => send('sync', slideId, step),
    subscribe: (listener) =>
      link.subscribe((message) => {
        if (message.type === 'hello' || message.type === 'request') listener({ kind: 'hello' });
        else if (message.type === 'sync') {
          listener({ kind: 'position', slideId: message.slideId, step: message.step });
        }
      }),
  };
}
