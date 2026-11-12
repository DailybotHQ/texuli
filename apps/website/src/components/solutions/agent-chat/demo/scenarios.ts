import {
  FORM_BLUEPRINT,
  REFUSED_BLUEPRINT,
  REPORT_BLUEPRINT,
  TRIAGE_BLUEPRINT,
} from './blueprints.ts';

/** People and the agent in the fictional workspace (example.com). */
export const PEOPLE = [
  { id: 'jordan', name: 'Jordan Lee', description: 'Support lead' },
  { id: 'avery', name: 'Avery Chen', description: 'Billing specialist' },
  { id: 'sam', name: 'Sam Rivera', description: 'Product designer' },
] as const;

export const COMMANDS = [
  { name: 'triage', description: 'Sort the overnight support queue' },
  { name: 'report', description: 'Build the weekly support report' },
  { name: 'form', description: 'Generate a sign-up form' },
] as const;

export const AGENT = { id: 'ari', name: 'Ari (demo agent)' } as const;
export const YOU = { id: 'you', name: 'You' } as const;

export interface ScenarioAttachment {
  readonly title: string;
  readonly blueprint: unknown;
}

export interface ChatScenario {
  readonly id: (typeof COMMANDS)[number]['name'];
  readonly label: string;
  /** What "you" send: a slash command and, sometimes, a mention token. */
  readonly prompt: string;
  /** The fixture reply, streamed word by word (inline Markdown and message tokens). */
  readonly reply: string;
  readonly attachments: readonly ScenarioAttachment[];
}

/** Fixture replies: there is no live model and no network in this demo. */
export const SCENARIOS: readonly ChatScenario[] = [
  {
    id: 'triage',
    label: 'Support triage',
    prompt: '/triage the overnight queue',
    reply:
      'Overnight there are **18 open** conversations and **3 urgent** ones. @[Avery Chen](mention:avery) can take the two refunds; I flagged the login lockout as [[status:danger|Urgent]]. Shipping questions can wait until [[date:2026-11-13T09:00:00Z]]. The queue summary is attached.',
    attachments: [{ title: 'Overnight queue', blueprint: TRIAGE_BLUEPRINT }],
  },
  {
    id: 'report',
    label: 'Weekly report',
    prompt: '/report for the launch week, please share it with @[Jordan Lee](mention:jordan)',
    reply:
      'Here is the weekly report: **412 conversations**, a first reply in *3m 40s* and 9 reopened. I also tried a revenue forecast, but it uses a component the catalog does not have, so it is shown as refused instead of painted. See the [support playbook](https://example.com/playbook) for the targets.',
    attachments: [
      { title: 'Support weekly report', blueprint: REPORT_BLUEPRINT },
      { title: 'Revenue forecast', blueprint: REFUSED_BLUEPRINT },
    ],
  },
  {
    id: 'form',
    label: 'Generate a form',
    prompt: '/form for the workshop sign-up',
    reply:
      'Done: a sign-up form with a **name**, an **email** and a submit button. The form paints with the player and validates in the page; nothing is sent anywhere in this demo. ✅',
    attachments: [{ title: 'Workshop sign-up', blueprint: FORM_BLUEPRINT }],
  },
];

/** The reply to free text that matches no command. */
export const FALLBACK_REPLY =
  'This demo answers from fixtures, with no live model. Try `/triage`, `/report` or `/form`, or mention a teammate with `@`.';

/** The scenario a sent message asks for, by its leading slash command. */
export function scenarioFor(message: string): ChatScenario | undefined {
  const command = /^\/([a-z]+)\b/.exec(message.trim())?.[1];
  return SCENARIOS.find((scenario) => scenario.id === command);
}

/** Split a reply into word-sized chunks (spaces kept) for the fixture stream. */
export function chunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}
