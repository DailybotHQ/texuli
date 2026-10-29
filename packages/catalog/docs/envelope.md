# Blueprint envelope

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/envelope`  
**Tests:** `packages/catalog/tests/envelope.test.ts`

## Goal

The versioned envelope (ADR-004, audit G13) wraps one catalog tree with what
a host needs to trust it: the catalog it was written for, who produced it and
why, the data's as-of time, its sources, its lifecycle status and its edit
provenance. This is what the agent service emits and the player validates.
`validateDraft` reads it.

## Shape (version 1)

```json
{
  "format": "texuli-blueprint",
  "version": 1,
  "id": "deck-2026-10-24-planning",
  "catalog": "<64-hex catalog build hash>",
  "status": "draft",
  "createdAt": "2026-10-24T09:00:00Z",
  "updatedAt": "2026-10-24T09:00:00Z",
  "generator": { "kind": "agent", "name": "Harbor assistant", "model": "example-model" },
  "tier": "untrusted",
  "profile": "web",
  "asOf": "2026-10-24T08:55:00Z",
  "sources": [{ "label": "Sprint board", "href": "https://example.com/board" }],
  "trigger": { "kind": "calendar", "label": "60 min before the planning meeting" },
  "meetingRef": { "id": "mtg-4411", "title": "Weekly planning", "startsAt": "2026-10-24T10:00:00Z" },
  "provenance": [{ "at": "…", "actor": "person:rae", "kind": "apply", "ops": [ … ] }],
  "tree": { "id": "layout-deck", "props": { "title": "Planning, week 43" }, "children": [ … ] }
}
```

| Field | Rule |
| --- | --- |
| `id` | 1–128 letters, digits, `.`, `_`, `:` or `-` |
| `catalog` | The catalog build hash (64 lowercase hex). With `catalogHash`, a different value is `catalog-mismatch` |
| `status` | `draft`, `validated`, `active` or `superseded`; never trusted from input (below) |
| `createdAt`, `updatedAt`, `asOf`, `startsAt`, `at` | ISO 8601 with a zone |
| `generator` | `kind` (`agent`, `person`, `tool`), `name`, optional `model` |
| `tier` | The emit tier the producer declares; the host chooses the tier it validates with |
| `profile` | `web` (default) or `portable`. `portable` fails closed (`unsupported-profile`): no id is audited portable yet (ADR-004) |
| `sources` | At most 32; each `href` must pass the untrusted URL policy |
| `trigger` | `kind` (`request`, `schedule`, `calendar`, `event`) and `label` |
| `activatedBy` | `by`, `at`, `digest`; written by the host's owner flow only |
| `provenance` | At most 500 entries `{ at, actor, kind, ops }`; `ops` are checked as untrusted edit ops |
| `tree` | One catalog root node (arrays are refused: `missing-tree`) |

Display strings are 1–512 characters with no control or bidi characters.
Unknown fields are `unknown-field` and `__proto__`-style keys `prototype-key`,
at every level.

## Validation and trust

`validateDraft(envelope, { catalog, catalogHash })` adds an `envelope` check:
the strict field rules above, then the whole tree pipeline on `tree`. The
result's `envelope` carries the status validation **earned**:

- `validated` when the draft is `ok`, otherwise `draft`: an invalid
  artifact stays a draft;
- the declared `status`, `activatedBy` and `tier` are never trusted. They
  produce the warnings `status-ignored`, `activation-ignored` and
  `tier-ignored`, and the returned envelope drops `activatedBy`.

`createValidationReceipt(result, at?)` records that transition as separate
host-computed evidence: envelope id, catalog hash, chosen tier, outcome,
check results and diagnostic counts. It returns `null` when parsing failed
before an envelope could be decoded. The receipt is not embedded in or
trusted from the envelope; it is a host record of one validation attempt, not
an activation credential. A later validation produces a new receipt.

An unsupported `version` or a missing `tree` stops the run (`status: 'parse'`).

## Lifecycle

```text
draft ──validateDraft──▶ validated ──activateEnvelope (owner)──▶ active ──supersedeEnvelope──▶ superseded
  ▲                                                                │
  └──────────────── any edit (recordProvenance) ───────────────────┘
```

- `createEnvelope(input)` makes a `draft`.
- `validateDraft` moves a valid draft to `validated`; an invalid result stays
  `draft`. Capture the validation outcome with `createValidationReceipt`.
- `activateEnvelope(envelope, { by, reviewedDigest })` is for the host's own
  activate control, never the player or the draft. It needs a `validated`
  envelope and refuses with `digest-mismatch` when the tree changed since the
  owner reviewed `blueprintDigest(tree)`. The result is `active` with
  `activatedBy: { by, at, digest }`, the envelope's activation provenance.
  The host owns the control and persists the receipt, reviewed digest and
  activated envelope in its own store; this package performs no host I/O.
- `verifyActivation(envelope)` checks that an active tree still has the
  activated digest. Hosts keep their own activation records; this is only the
  digest half.
- `supersedeEnvelope(envelope)` moves `active` to `superseded`.

Only validation can earn `validated`, only the host's explicit owner flow can
call `activateEnvelope`, and only an active envelope can be superseded. Any
edit recorded by `recordProvenance` clears activation provenance and returns
the envelope to `draft` so it must pass validation and owner review again.

## Provenance from edit history

```ts
const history = createEditHistory(envelope.tree, { validate: draftCommitGate({ catalog }) });
const recorder = recordProvenance(history, envelope, 'person:rae');
history.apply(op);
recorder.envelope(); // provenance + the new tree; status back to draft
recorder.stop();
```

Each apply, undo and redo appends `{ at, actor, kind, ops }`; the oldest
entries beyond 500 are dropped. Any edit makes the envelope a `draft` again
and drops `activatedBy`: an edited blueprint needs its own validation and
activation.

## Migration

`migrateEnvelope(value, metadata)` brings stored data to the current version.
A version 1 envelope passes through unchanged (`migrated: false`); a bare
catalog tree (the format before envelopes) is wrapped as a `draft` with the
given `id`, `catalog` and `generator` (`migrated: true`). Everything else is
refused with an actionable code:

| Code | Stored data |
| --- | --- |
| `unknown-format` | Declares a `format` other than `texuli-blueprint`; never reinterpreted as a tree |
| `invalid-version` | Envelope-like (`format` matches) but has no `version` field |
| `unsupported-version` | A newer version than `SUPPORTED_ENVELOPE_VERSIONS` (currently `1`); refused, never guessed at |
| `not-a-tree` | Neither an envelope nor one catalog tree node |

The package reads the versions in `SUPPORTED_ENVELOPE_VERSIONS` (exported
from `@texuli/catalog/envelope`; today `[1]`, the version it writes). When a
future version still reads version 1, the list grows and `migrateEnvelope`
moves stored data up. The result still goes through `validateDraft`.

The envelope's optional `spec` field follows the blueprint contract
(`@texuli/spec/migrate`). `parseEnvelope` accepts the versions in
`SUPPORTED_SPEC_VERSIONS`, the targets of the migration chain (today `0.3.0`
and `0.4.0`, the same enum as `blueprint.schema.json`), and an envelope with
no `spec`, which was written for the undeclared baseline `0.2.0`. An explicit
`"spec": "0.2.0"` is accepted only through migration: `validateDraft` runs
`migrateBlueprint` first, which stamps the current version, so the validated
envelope carries it. `parseEnvelope` alone refuses `"spec": "0.2.0"`, like
any other version off the list, with `unsupported-spec`.

From spec 0.6.0 (new in `0.6.0`) the envelope may declare `motion: { level }`
(`full`, `subtle` or `none`), the level its node motion plays at. Anything
else (another field, a duration, a level off the list) is an
`invalid-motion` error. Node `motion` is checked by the renderer with the
same closed vocabulary (`@texuli/spec/motion`,
[motion.md](../../spec/docs/motion.md)).

## Developer tier (roadmap decision D5)

The `developer` tier is normative: with `renderCatalogFromBuild`, it is the
build's developer tier, every `agentEmittable` component. App chrome such as
`dialog` is `tier-denied` unless the host opts in with
`renderCatalogFromBuild(catalog, { developer: 'all' })`.

Today that is 41 of the catalog's 133 ids (D5 counted 36; G05 added four
block families; G11 added `deck-slide`). Tier U is the same 41 ids, and it
must stay a subset of the developer tier.
`packages/catalog/tests/render-renderer.test.ts` pins the
list and checks every catalog id in both tiers and both developer modes, so
adding or removing an emittable id is a deliberate change to that test and
this page.

The host chooses the validation tier. The envelope's `tier` field is only a
producer declaration: `validateDraft` ignores it (`tier-ignored`) and never
uses it to widen permissions. See [Catalog build](./catalog-build.md) for the
default D5 policy and the explicit trusted-host override.

## Not yet

- The JSON schema for the envelope in the planned `spec/` (ADR-004).
- Capability metadata per id, so a `portable` profile can pass.
- Stable node ids for provenance that survives concurrent edits.
