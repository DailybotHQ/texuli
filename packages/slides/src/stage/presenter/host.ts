/**
 * The seam between a stage and its presenter window session (which loads
 * lazily with the presenter extras): while the window is open the stage
 * follows `link`, and `close` ends the window when the stage goes away.
 */
import type { PresenterTransport } from '@texuli/deck/engine';

export interface DeckPresenterHost {
  attach(link: PresenterTransport, close: () => void): void;
  detach(): void;
}
