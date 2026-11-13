# Chat blueprint attachment

> **Status: in development.** Added in PLAN_023 (T-cmp-chat); not yet in a
> published release.

`ChatAttachment` is a message card for an artifact an agent attached, such as
a blueprint:
- it validates the artifact first;
- it paints it only if it passed, behind a disclosure;
- otherwise it shows a refused state that says why.

It is a `figure` named by its caption. The preview toggle is a button with
`aria-expanded` and `aria-controls`.

```svelte
<script lang="ts">
import { validateDraft } from '@texuli/catalog/validate';
import { ChatAttachment, type ChatAttachmentCheck } from '@texuli/chat';
import { createPlayerCatalog, Player } from '@texuli/player';

const catalog = createPlayerCatalog();

function check(artifact: unknown): ChatAttachmentCheck {
  const result = validateDraft(artifact, { catalog, tier: 'untrusted' });
  return result.ok && result.draft
    ? { ok: true, value: result.draft }
    : { ok: false, reasons: result.diagnostics.map((d) => `${d.code}: ${d.message}`) };
}
</script>

<ChatAttachment artifact={attachment} title="Weekly report" {check}>
  {#snippet preview(value)}<Player blueprint={value} label="Weekly report" />{/snippet}
</ChatAttachment>
```

## Why the host passes `check` and `preview`

`@texuli/chat` sits on layer 4, below `@texuli/catalog` (6) and
`@texuli/player` (7), so it cannot import them. The host supplies the
validator (`check`) and the painter (`preview`). The card guarantees the
order:
- `preview` is never called for an artifact that `check` refused;
- a `check` that throws, or answers anything but `{ ok: true, value }`, reads as
  refused;
- reasons are plain text, at most 5, each cut at 200 characters
  (`CHAT_ATTACHMENT_LIMITS`; `runAttachmentCheck` applies the rules).

## API

- **Props:**
  - `artifact` (untrusted), `title`, `check`, `preview`;
  - `open` (bindable, `false` by default);
  - `labels` (`ChatAttachmentLabels`);
  - other attributes land on the `figure`.
- **States:** `data-state` is `ready` or `refused`. `labels.refused` and
  `labels.reasons` head the refused list.

The example `chat-attachment` in `@texuli/examples` attaches a valid report and
a blueprint with an unknown component.

**Not in the agent catalog yet.** `ChatAttachment` has no catalog id, so it is
not agent-emittable. A `chat-attachment` id is a spec vocabulary change and is
tracked as a planned exclusion.
