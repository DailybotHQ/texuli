import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayerFrameHost } from '../src/embed/host.ts';
import {
  PLAYER_FRAME_PROTOCOL,
  parseFrameMessage,
  parseHostMessage,
} from '../src/embed/protocol.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { mountPlayerFrame } from '../src/mount.ts';
import Player from '../src/Player.svelte';
import { LOCAL_STATE_FORMAT } from '../src/state/bind.ts';
import {
  AUTOCOMPLETE_ALLOWLIST,
  actionValues,
  checkActionNodes,
  DEFAULT_FIELD_MESSAGES,
  MAX_ACTION_VALUE_LENGTH,
  runAction,
  validateFieldValue,
} from './action-test-helpers.ts';

const state = {
  email: { type: 'string', maxLength: 120 },
  team: { type: 'string', maxLength: 40 },
  seats: { type: 'number', min: 0, max: 50, initial: 0 },
};

const field = (props: Record<string, unknown>) => ({ id: 'form-field', props });
const form = (children: unknown[], props: Record<string, unknown> = {}) => ({
  id: 'action-form',
  props: { action: 'request-access', label: 'Request access', ...props },
  children,
});
const fields = [
  field({
    name: 'email',
    state: 'email',
    label: 'Email',
    kind: 'email',
    required: true,
    autocomplete: 'email',
  }),
  field({ name: 'team', state: 'team', label: 'Team', pattern: 'slug' }),
  field({
    name: 'seats',
    state: 'seats',
    label: 'Seats',
    kind: 'number',
    min: 1,
    max: 20,
    required: true,
  }),
  { id: 'form-submit', props: { label: 'Send request' } },
];

function wrapped(children: unknown[] = [form(fields)], declarations: unknown = state) {
  return {
    format: LOCAL_STATE_FORMAT,
    version: 1,
    state: declarations,
    blueprint: { id: 'layout-page', props: { title: 'Fictional access' }, children },
  };
}

async function paint(extra: Record<string, unknown> = {}, blueprint: unknown = wrapped()) {
  const view = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS, ...extra } });
  await screen.findByRole('heading', { level: 1, name: 'Fictional access' }, { timeout: 5000 });
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    { timeout: 5000 }
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send request' })).toBeTruthy());
  await tick();
  return view;
}

async function fill() {
  await fireEvent.input(screen.getByLabelText(/Email/), { target: { value: 'ada@example.com' } });
  await fireEvent.input(screen.getByLabelText(/Team/), { target: { value: 'harbor-ops' } });
  await fireEvent.input(screen.getByLabelText(/Seats/), { target: { value: '5' } });
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
const receipt = (container: Element) =>
  container.querySelector('[data-tx-player-receipt]')?.textContent?.trim();

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('action model (G17)', () => {
  it('validates required, pattern, length and range with fixed messages', () => {
    const messages = DEFAULT_FIELD_MESSAGES;
    expect(
      validateFieldValue({ label: 'Email', kind: 'email', required: true }, '', messages)
    ).toBe('Email is required.');
    expect(
      validateFieldValue({ label: 'Email', kind: 'email' }, 'not-an-email', messages)
    ).toContain('expected format');
    expect(
      validateFieldValue({ label: 'Team', kind: 'text', pattern: 'slug' }, 'Harbor Ops', messages)
    ).toContain('expected format');
    expect(validateFieldValue({ label: 'Code', kind: 'text', minLength: 4 }, 'ab', messages)).toBe(
      'Code must be 4 to 2048 characters.'
    );
    expect(
      validateFieldValue({ label: 'Seats', kind: 'number', min: 1, max: 20 }, 25, messages)
    ).toBe('Seats must be between 1 and 20.');
    expect(validateFieldValue({ label: 'Note', kind: 'text' }, '', messages)).toBeNull();
  });

  it('caps action values to plain scalars', () => {
    expect(
      actionValues([
        ['email', 'a@example.com'],
        ['seats', 3],
        ['ok', true],
      ])
    ).toEqual({ email: 'a@example.com', seats: 3, ok: true });
    expect(actionValues([['big', 'x'.repeat(MAX_ACTION_VALUE_LENGTH + 1)]])).toBeNull();
    expect(
      actionValues([
        ['a', 1],
        ['a', 2],
      ])
    ).toBeNull();
    expect(actionValues([['bad name', 1]])).toBeNull();
    expect(actionValues(Array.from({ length: 33 }, (_, i) => [`f${i}`, i] as const))).toBeNull();
    const proto = actionValues([['__proto__', 'x']]);
    expect(proto).toBeNull();
  });

  it('keeps payment, credential and one-time-code tokens out of autocomplete', () => {
    for (const token of [
      'cc-number',
      'cc-csc',
      'cc-exp',
      'current-password',
      'new-password',
      'one-time-code',
    ]) {
      expect((AUTOCOMPLETE_ALLOWLIST as readonly string[]).includes(token)).toBe(false);
    }
  });

  it('maps host answers to receipts', async () => {
    const intent = { id: 'action-1', action: 'a', values: {} };
    expect(await runAction(undefined, intent)).toBe('unavailable');
    expect(await runAction(() => 'confirmed', intent)).toBe('confirmed');
    expect(await runAction(async () => 'rejected' as const, intent)).toBe('rejected');
    expect(
      await runAction(() => {
        throw new Error('down');
      }, intent)
    ).toBe('failed');
    expect(await runAction((() => 'maybe') as never, intent)).toBe('failed');
  });

  it('checks forms, fields and submits against the declared state', () => {
    const declarations = {
      email: { type: 'string', maxLength: 10, initial: '' },
      seats: { type: 'number', min: 0, max: 1, initial: 0 },
    } as const;
    const tree = (children: unknown[]) => ({ id: 'layout-page', props: {}, children });
    expect(
      checkActionNodes(
        tree([form([field({ name: 'email', state: 'email', label: 'E' })])]),
        declarations
      )
    ).toEqual([]);
    expect(
      checkActionNodes(
        tree([field({ name: 'email', state: 'email', label: 'E' })]),
        declarations
      )[0]?.message
    ).toContain('inside an "action-form"');
    expect(
      checkActionNodes(
        tree([form([field({ name: 'n', state: 'seats', label: 'N' })])]),
        declarations
      )[0]?.message
    ).toContain('writes a string');
    expect(
      checkActionNodes(
        tree([
          form([
            field({ name: 'e', state: 'email', label: 'A' }),
            field({ name: 'e', state: 'email', label: 'B' }),
          ]),
        ]),
        declarations
      )[0]?.message
    ).toContain('used twice');
    expect(checkActionNodes(tree([form([form([])])]), declarations)[0]?.message).toContain(
      'cannot nest'
    );
    expect(
      checkActionNodes(tree([form([], { action: 'bad action!' })]), declarations)[0]?.message
    ).toContain('action name');
  });
});

describe('the action surface in the player', () => {
  it('blocks an invalid submit: errors linked to fields, focus on the first, no intent', async () => {
    const onAction = vi.fn(() => 'confirmed' as const);
    const { container } = await paint({ onAction });
    await submit();
    const email = screen.getByLabelText(/Email/);
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector(`#${email.getAttribute('aria-describedby')}`)?.textContent).toBe(
      'Email is required.'
    );
    expect(document.activeElement).toBe(email);
    expect(onAction).not.toHaveBeenCalled();
    expect(email.getAttribute('autocomplete')).toBe('email');
  });

  it('proposes one action intent with the named values and shows the receipt', async () => {
    let answer: (value: 'confirmed' | 'rejected') => void = () => {};
    const onAction = vi.fn(
      () =>
        new Promise<'confirmed' | 'rejected'>((resolve) => {
          answer = resolve;
        })
    );
    const { container } = await paint({ onAction });
    await fill();
    await submit();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({
      id: 'action-1',
      action: 'request-access',
      values: { email: 'ada@example.com', team: 'harbor-ops', seats: 5 },
    });
    await tick();
    expect(receipt(container)).toBe('Sending…');
    const button = screen.getByRole('button', { name: 'Send request' });
    expect(button.hasAttribute('disabled')).toBe(true);
    await submit();
    expect(onAction).toHaveBeenCalledTimes(1);
    answer('confirmed');
    await waitFor(() => expect(receipt(container)).toBe('Sent.'));
    await waitFor(() =>
      expect(container.querySelector('[data-tx-player-announcer]')?.textContent?.trim()).toBe(
        'Sent.'
      )
    );
  });

  it.each([
    ['rejected', () => 'rejected' as const, 'Not accepted.'],
    [
      'failed',
      () => {
        throw new Error('down');
      },
      'Could not send. Please try again.',
    ],
  ])('shows a %s receipt', async (_name, onAction, text) => {
    const { container } = await paint({ onAction });
    await fill();
    await submit();
    await waitFor(() => expect(receipt(container)).toBe(text));
  });

  it('is unavailable without a host handler, and sends nothing', async () => {
    const { container } = await paint();
    expect(screen.getByRole('button', { name: 'Send request' }).getAttribute('aria-disabled')).toBe(
      'true'
    );
    await fill();
    await submit();
    await waitFor(() => expect(receipt(container)).toBe('This preview cannot send.'));
  });

  it('never hands a native submission to a host form around the player', async () => {
    const hostForm = document.createElement('form');
    const submitted = vi.fn((event: Event) => event.preventDefault());
    hostForm.addEventListener('submit', submitted);
    document.body.append(hostForm);
    const onAction = vi.fn(() => 'confirmed' as const);
    render(Player, {
      target: hostForm,
      props: { blueprint: wrapped(), loaders: PLAYER_LOADERS, onAction },
    });
    await screen.findByRole('button', { name: 'Send request' }, { timeout: 5000 });
    await fill();
    // Enter in a field submits the action form (implicit submission): only the intent leaves.
    const formElement = document.querySelector('[data-tx-player-action-form]') as HTMLFormElement;
    formElement.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
    expect(submitted).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a field outside a form',
      wrapped([field({ name: 'email', state: 'email', label: 'E' })]),
      'inside an "action-form"',
    ],
    [
      'a number field on a string variable',
      wrapped([form([field({ name: 'email', state: 'email', label: 'E', kind: 'number' })])]),
      'writes a number',
    ],
    [
      'a field without declared state',
      {
        id: 'layout-page',
        props: { title: 'X' },
        children: [form([field({ name: 'email', state: 'email', label: 'E' })])],
      },
      'declares none',
    ],
  ])('refuses %s', async (_name, blueprint, message) => {
    const { container } = render(Player, { props: { blueprint, loaders: PLAYER_LOADERS } });
    await tick();
    expect(container.querySelector('[data-tx-player-state-notice]')?.textContent ?? '').toContain(
      message
    );
  });

  it('refuses a payment autocomplete token through the manifest enum', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: wrapped([
          form([field({ name: 'card', state: 'email', label: 'Card', autocomplete: 'cc-number' })]),
        ]),
        loaders: PLAYER_LOADERS,
      },
    });
    await tick();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('input[autocomplete="cc-number"]')).toBeNull();
  });
});

describe('actions through the frame protocol', () => {
  it('parses action messages under the same caps', () => {
    expect(
      parseFrameMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'action',
        id: 'action-1',
        action: 'a',
        values: { n: 1 },
      })
    ).toMatchObject({ type: 'action' });
    expect(
      parseFrameMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'action',
        id: 'action-1',
        action: 'a',
        values: { big: 'x'.repeat(3000) },
      })
    ).toBeNull();
    expect(
      parseFrameMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'action',
        id: 'x',
        action: 'a',
        values: {},
      })
    ).toBeNull();
    expect(
      parseHostMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'action-result',
        id: 'action-2',
        status: 'confirmed',
      })
    ).toMatchObject({ status: 'confirmed' });
    expect(
      parseHostMessage({
        protocol: PLAYER_FRAME_PROTOCOL,
        type: 'action-result',
        id: 'action-2',
        status: 'maybe',
      })
    ).toBeNull();
  });

  it('sends a frame action to the host and shows the host answer as the receipt', async () => {
    const parent = Object.assign(new EventTarget(), { postMessage: vi.fn() });
    const win = Object.assign(new EventTarget(), {
      postMessage: vi.fn(),
      parent,
    }) as unknown as Window;
    const target = document.createElement('div');
    document.body.append(target);
    const frame = mountPlayerFrame(target, {
      parentOrigins: ['https://host.example'],
      window: win,
      loaders: PLAYER_LOADERS,
    });
    const send = (data: unknown) => {
      const event = new MessageEvent('message', { origin: 'https://host.example', data });
      Object.defineProperty(event, 'source', { value: parent });
      (win as unknown as EventTarget).dispatchEvent(event);
    };
    send({ protocol: PLAYER_FRAME_PROTOCOL, type: 'init', blueprint: wrapped(), options: {} });
    await screen.findByRole('button', { name: 'Send request' }, { timeout: 5000 });
    await fill();
    await submit();
    await waitFor(() =>
      expect(parent.postMessage).toHaveBeenCalledWith(
        {
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'action',
          id: 'action-1',
          action: 'request-access',
          values: { email: 'ada@example.com', team: 'harbor-ops', seats: 5 },
        },
        'https://host.example'
      )
    );
    send({
      protocol: PLAYER_FRAME_PROTOCOL,
      type: 'action-result',
      id: 'action-1',
      status: 'confirmed',
    });
    await waitFor(() => expect(receipt(target)).toBe('Sent.'));
    frame.dispose();
  });

  it('answers a frame action from the host handler', async () => {
    const hostWindow = new EventTarget() as Window & EventTarget;
    const frameWindow = Object.assign(new EventTarget(), { postMessage: vi.fn() });
    const iframe = Object.assign(new EventTarget(), {
      contentWindow: frameWindow,
      ownerDocument: { defaultView: hostWindow },
    }) as unknown as HTMLIFrameElement;
    const onAction = vi.fn(async () => 'rejected' as const);
    createPlayerFrameHost({ frame: iframe, onAction });
    const post = (data: unknown) => {
      const event = new MessageEvent('message', { origin: 'null', data });
      Object.defineProperty(event, 'source', { value: frameWindow });
      hostWindow.dispatchEvent(event);
    };
    post({ protocol: PLAYER_FRAME_PROTOCOL, type: 'ready' });
    post({
      protocol: PLAYER_FRAME_PROTOCOL,
      type: 'action',
      id: 'action-3',
      action: 'a',
      values: { n: 1 },
    });
    await waitFor(() =>
      expect(frameWindow.postMessage).toHaveBeenCalledWith(
        {
          protocol: PLAYER_FRAME_PROTOCOL,
          type: 'action-result',
          id: 'action-3',
          status: 'rejected',
        },
        '*'
      )
    );
    expect(onAction).toHaveBeenCalledWith({ id: 'action-3', action: 'a', values: { n: 1 } });
  });
});
