## Blueprint attachments

`ChatAttachment` shows a blueprint an agent attached. In development: added after `0.17.4`, not in a published release yet.

The host passes `check` and `preview`, because `@texuli/chat` sits below the catalog and the player:

- `check` validates the artifact, usually with `validateDraft` from `@texuli/catalog/validate` at the untrusted tier.
- `preview` paints the validated value, usually with `Player` from `@texuli/player`.

The card never paints an artifact that was refused. It lists the reasons as text instead.

```svelte
<ChatAttachment artifact={blueprint} title="Weekly report" {check}>
  {#snippet preview(value)}<Player blueprint={value} label="Weekly report" />{/snippet}
</ChatAttachment>
```
