import '@texuli/tokens/base.css';
import { LOCAL_STATE_FORMAT, mountPlayer, PLAYER_LOADERS } from '@texuli/player';
import { applyTheme } from '@texuli/tokens';
import { loadLibraryTheme } from '@texuli/tokens/library';
import '@texuli/player/styles.css';
import { AnimationTimeline } from '@texuli/media/timeline';
import { mount } from 'svelte';
import golden from '../../../../packages/media/tests/golden/composition-v2/lower-third.json';

/*
 * tests/e2e/responsive-sweep.spec.ts: the surfaces PLAN_004 added, mounted
 * with the same fictional fixtures their unit tests use. `?dir=rtl` sets the
 * document direction before anything mounts.
 */

const params = new URLSearchParams(location.search);
if (params.get('dir') === 'rtl') document.documentElement.dir = 'rtl';
applyTheme(document.documentElement, {
  theme: await loadLibraryTheme('enterprise-neutral'),
  mode: 'light',
});

const card = (title: string) => ({ id: 'layout-card', props: { title } });
const stateful = (state: unknown, children: unknown[], extra: Record<string, unknown> = {}) => ({
  format: LOCAL_STATE_FORMAT,
  version: 1,
  state,
  blueprint: { id: 'layout-page', props: { title: 'Fictional sweep' }, children },
  ...extra,
});

const blueprints: Record<string, unknown> = {
  layouts: {
    id: 'layout-page',
    props: { title: 'Fictional operations' },
    children: [
      {
        id: 'layout-stack',
        props: { gap: 'small' },
        children: [
          {
            id: 'layout-row',
            props: { gap: 'small', align: 'center' },
            children: [card('Opened'), card('Solved')],
          },
          {
            id: 'layout-split',
            props: { ratio: '2:1', gap: 'large' },
            children: [card('Trend'), card('Notes')],
          },
        ],
      },
      {
        id: 'layout-grid',
        props: { columns: 3 },
        children: [
          { id: 'layout-tile', props: { title: 'Wide tile', span: 2, rowSpan: 2 } },
          { id: 'layout-tile', props: { title: 'Small tile' } },
        ],
      },
    ],
  },
  controls: stateful(
    {
      details: { type: 'boolean' },
      week: { type: 'enum', values: ['w41', 'w42', 'w43'], initial: 'w42' },
      limit: { type: 'number', min: 0, max: 10, initial: 5 },
      query: { type: 'string', maxLength: 20 },
    },
    [
      { id: 'control-toggle', props: { state: 'details', label: 'Show details' } },
      { id: 'control-choice', props: { state: 'week', label: 'Week' } },
      { id: 'control-slider', props: { state: 'limit', label: 'Items shown', step: 1 } },
      {
        id: 'control-filter',
        props: { state: 'query', label: 'Filter tickets', placeholder: 'Search' },
      },
    ]
  ),
  actions: stateful(
    {
      email: { type: 'string', maxLength: 120 },
      team: { type: 'string', maxLength: 40 },
      seats: { type: 'number', min: 0, max: 50, initial: 0 },
    },
    [
      {
        id: 'action-form',
        props: { action: 'request-access', label: 'Request access' },
        children: [
          {
            id: 'form-field',
            props: { name: 'email', state: 'email', label: 'Email', kind: 'email', required: true },
          },
          {
            id: 'form-field',
            props: { name: 'team', state: 'team', label: 'Team', pattern: 'slug' },
          },
          {
            id: 'form-field',
            props: {
              name: 'seats',
              state: 'seats',
              label: 'Seats',
              kind: 'number',
              min: 1,
              max: 20,
            },
          },
          { id: 'form-submit', props: { label: 'Send request' } },
        ],
      },
    ]
  ),
  flow: stateful(
    { agree: { type: 'boolean' } },
    [
      { id: 'control-toggle', props: { state: 'agree', label: 'I agree' } },
      {
        id: 'flow-view',
        props: { name: 'details', label: 'Details' },
        children: [
          card('Your details'),
          { id: 'flow-action', props: { event: 'next', label: 'Next' } },
        ],
      },
      {
        id: 'flow-view',
        props: { name: 'done', label: 'Done' },
        children: [
          card('All set'),
          { id: 'flow-action', props: { event: 'restart', label: 'Start over' } },
        ],
      },
    ],
    {
      flow: {
        views: ['details', 'done'],
        initial: 'details',
        transitions: [
          { from: 'details', to: 'done', on: 'next' },
          { from: '*', to: 'details', on: 'restart' },
        ],
      },
    }
  ),
};

for (const [name, blueprint] of Object.entries(blueprints)) {
  const target = document.querySelector<HTMLElement>(`[data-sweep="${name}"]`);
  if (target) mountPlayer(target, { blueprint, loaders: PLAYER_LOADERS });
}
const timeline = document.querySelector<HTMLElement>('[data-sweep="timeline"]');
if (timeline) {
  mount(AnimationTimeline, {
    target: timeline,
    props: { composition: golden.composition, animation: golden.animation, title: 'Lower third' },
  });
}
const status = document.getElementById('sweep-status');
if (status) status.textContent = 'Ready';
