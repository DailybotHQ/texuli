import { type ActionHandler, type ActionIntent, runAction } from './actions.ts';
import type { PlayerActionAccess } from './context.ts';
import type { PlayerLabels } from './labels.ts';

/**
 * The player's side of the action surface: number each intent, hand it to
 * the host's current handler, and announce the receipt politely. Kept out
 * of Player.svelte so the component only wires it.
 */
export function createActionAccess(options: {
  handler: () => ActionHandler | undefined;
  labels: () => PlayerLabels;
  announce: (text: string) => void;
}): PlayerActionAccess {
  let sequence = 0;
  return {
    available: () => options.handler() !== undefined,
    async propose(action, values) {
      sequence += 1;
      const intent: ActionIntent = Object.freeze({
        id: `action-${sequence}`,
        action,
        values: Object.freeze({ ...values }),
      });
      const status = await runAction(options.handler(), intent);
      const text = options.labels();
      options.announce(
        status === 'confirmed'
          ? text.actionConfirmed
          : status === 'rejected'
            ? text.actionRejected
            : status === 'unavailable'
              ? text.actionUnavailable
              : text.actionFailed
      );
      return status;
    },
  };
}
