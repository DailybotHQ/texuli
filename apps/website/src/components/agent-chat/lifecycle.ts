/**
 * The chat island's view of one request: the steps the service streams
 * (server-sent events) and the draft lifecycle they lead to. Framework-free,
 * so the island and its tests share it. Nothing here trusts the service: the
 * lifecycle only ever ends at "draft", because activation is the owner's
 * decision in their own tool, never this page's.
 */
import type { AgentDraftResult, AgentStreamEvent } from './client.ts';

export type StepState = 'active' | 'done' | 'failed';

export interface StreamStep {
  /** Stable key for the list (`accepted`, `validating-2`, …). */
  key: string;
  label: string;
  state: StepState;
}

/** Fold one streamed event into the step list; earlier active steps complete. */
export function applyStreamEvent(
  steps: readonly StreamStep[],
  event: AgentStreamEvent
): StreamStep[] {
  const settle = (state: StepState = 'done') =>
    steps.map((step) => (step.state === 'active' ? { ...step, state } : step));
  const push = (step: StreamStep) => [...settle(), step];
  switch (event.type) {
    case 'accepted':
      return push({ key: 'accepted', label: 'Request accepted', state: 'done' });
    case 'generating':
      // The service streams a note per text event; one step covers them all.
      return steps.some((step) => step.key === 'generating')
        ? [...steps]
        : push({ key: 'generating', label: 'Writing the draft', state: 'active' });
    case 'validating':
      return push({
        key: `validating-${event.attempt}`,
        label:
          event.attempt === 1
            ? 'Validating the draft'
            : `Validating the repaired draft (attempt ${event.attempt})`,
        state: 'active',
      });
    case 'repairing':
      return [
        ...settle('failed'),
        {
          key: `repairing-${event.attempt}`,
          label: `Repairing ${event.codes.slice(0, 3).join(', ') || 'the draft'}`,
          state: 'active',
        },
      ];
    case 'result':
      return event.result.status === 'valid'
        ? push({ key: 'result', label: 'Draft validated by the service', state: 'done' })
        : [
            ...settle('failed'),
            { key: 'result', label: 'The service rejected the draft', state: 'failed' },
          ];
    case 'error':
      return [...settle('failed'), { key: 'error', label: event.message, state: 'failed' }];
    case 'done':
      return settle();
  }
}

export type LifecycleStage = 'requested' | 'drafted' | 'validated' | 'checked' | 'draft';

export interface LifecycleStep {
  stage: LifecycleStage;
  label: string;
  detail: string;
  state: 'done' | 'current' | 'upcoming' | 'failed';
}

/** What the page shows for the lifecycle of the latest answer. */
export type LifecycleInput =
  | { phase: 'idle' }
  | { phase: 'working'; drafted: boolean }
  | { phase: 'result'; result: AgentDraftResult }
  | { phase: 'error'; message: string };

const STAGES: readonly { stage: LifecycleStage; label: string; detail: string }[] = [
  { stage: 'requested', label: 'Requested', detail: 'Your prompt was sent to the agent service.' },
  { stage: 'drafted', label: 'Drafted', detail: 'The model proposed a blueprint tree.' },
  {
    stage: 'validated',
    label: 'Validated',
    detail: 'The service checked it in the untrusted tier and issued a receipt.',
  },
  {
    stage: 'checked',
    label: 'Re-checked here',
    detail: 'Your browser validates it again before painting it.',
  },
  {
    stage: 'draft',
    label: 'Draft, not activated',
    detail: 'Activating it is a decision for your own tool. This page never does.',
  },
];

/**
 * The five lifecycle stages with their state. A rejected or failed request
 * stops at the stage that failed; nothing ever moves past "draft".
 */
export function draftLifecycle(input: LifecycleInput): LifecycleStep[] {
  let reached = -1;
  let failedAt = -1;
  if (input.phase === 'working') reached = input.drafted ? 1 : 0;
  else if (input.phase === 'error') failedAt = 1;
  else if (input.phase === 'result') {
    if (input.result.status === 'valid') reached = 4;
    else failedAt = 2;
  }
  return STAGES.map((stage, index) => {
    let state: LifecycleStep['state'] = 'upcoming';
    if (failedAt >= 0)
      state = index < failedAt ? 'done' : index === failedAt ? 'failed' : 'upcoming';
    else if (input.phase === 'result' && index <= reached) state = 'done';
    else if (index < reached) state = 'done';
    else if (index === reached) state = 'current';
    return { ...stage, state };
  });
}

/** The envelope status the service stamped, read defensively (the response is untrusted). */
export function envelopeStatus(result: AgentDraftResult | null): string | null {
  const envelope = result?.envelope;
  if (envelope === null || typeof envelope !== 'object') return null;
  const status = (envelope as { status?: unknown }).status;
  return typeof status === 'string' && /^[a-z-]{1,24}$/.test(status) ? status : null;
}
