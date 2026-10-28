export interface ComposerLabels {
  input: string;
  placeholder: string;
  hint: string;
  send: string;
  sending: string;
  sendError: string;
  /** Name of the button that stops a streaming reply. */
  stop: string;
}

/** What the `actions` snippet receives: the composer state and its commands. */
export interface ComposerActionContext {
  canSend: boolean;
  busy: boolean;
  streaming: boolean;
  submit: () => Promise<void>;
  stop: () => void;
}

export const DEFAULT_COMPOSER_LABELS: ComposerLabels = {
  input: 'Message',
  placeholder: 'Write a message…',
  hint: 'Press Enter to send. Press Shift+Enter for a new line.',
  send: 'Send message',
  sending: 'Sending message',
  sendError: 'Your message could not be sent. Please try again.',
  stop: 'Stop generating',
};
