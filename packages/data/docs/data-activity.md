# Activity feed

**Package:** `@texuli/data`  
**Lazy subpath:** `@texuli/data/activity`  
**Engine:** `packages/data/src/engines/activity/` (also `@texuli/data/activity/engine`)  
**View:** `packages/data/src/activity/`  
**Tests:** `packages/data/tests/activity.test.ts`  
**Example:** `data-activity`

## Goal

A day-grouped activity feed over `ActivityItem` rows with:

- Day labels relative to a runtime clock (`groupByDay` / `whenLabel`); an
  unknown `timeZone` falls back to UTC and an invalid `locale` to `en-US`
- Avatars (`texuli/avatar`) and optional kind filters
- Comment bodies with `@{id}` / `#{id}` mention tokens
- Reactions via `toggleReaction` (host persists)
- Progressive pagination (local window + optional `onLoadMore`)
- Keyboard: arrows, Home/End, Enter to open; RTL via `dir`

## Usage

```svelte
<script lang="ts">
  import { ActivityFeed, type ActivityItem } from '@texuli/data/activity';

  let items = $state<ActivityItem[]>([
    {
      id: '1',
      at: '2026-02-12T16:00:00.000Z',
      actorId: 'p-marta',
      kind: 'comment',
      lines: [],
      body: 'Thanks @{p-li}.',
      recordLabel: 'Acme renewal',
    },
  ]);
  let reactions = $state<Record<string, Record<string, string[]>>>({});
</script>

<ActivityFeed
  {items}
  now="2026-02-12T18:00:00.000Z"
  getActorName={(item) => (item.actorId === 'p-marta' ? 'Marta Ruiz' : item.actorId)}
  personaId="p-marta"
  {reactions}
  onReactionToggle={(item, _emoji, next) => {
    reactions = { ...reactions, [item.id]: next };
  }}
  mentions={{ person: (id) => (id === 'p-li' ? 'Li Chen' : undefined) }}
  filterable
  pageSize={10}
/>
```

Pass a fixed `now` in tests and visual stories so day labels stay stable.

## Engine vs view

| Layer | Import | Role |
| --- | --- | --- |
| Engine | `@texuli/data/activity` re-exports or `/activity/engine` | `groupByDay`, `sortActivity`, `tokenize`, `toggleReaction` |
| View | `ActivityFeed` | avatars, reactions UI, filters, pagination |
