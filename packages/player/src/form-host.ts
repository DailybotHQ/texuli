/**
 * Host seam for painting `schema-form` nodes (spec 0.8.0, ADR-015).
 *
 * The player (L7) could import `@texuli/forms` (L4), but the form engine
 * (schema compiler, expression evaluator, every field control) does not
 * belong in the player's first-load chunk, and a direct dependency would
 * tie every player release to the forms package. So, as for documents and
 * canvases, a host supplies a {@link FormPlayerHost}: its `checkForm` runs
 * inside the player's validation (`validateDraft`'s injected form check, at
 * the player's tier, with the host's validator names), and each valid
 * `schema-form` node hands its schema to `present`, with a `submit` that
 * proposes the node's action intent to the host through the player.
 *
 * Without a host a `schema-form` node is refused (`form-unchecked`), the
 * player shows its invalid notice, and nothing of the form paints.
 * `@texuli/forms` ships the real adapter (`createFormPlayerHost` from
 * `@texuli/forms/host`), which mounts `SchemaForm` lazily. Tests use the
 * same adapter or a mock.
 */

import type { RenderTier } from '@texuli/catalog/render/renderer';
import type { DraftFormCheck } from '@texuli/catalog/validate';

export type { DraftFormCheck };

/** What a submit resolves to: accepted, or refused with a message the form shows. */
export type FormPlayerSubmitResult = { ok: true } | { ok: false; message: string };

/**
 * Read-only request the player hands a form host for one `schema-form`
 * node. `schema`, `action` and `tier` are fixed for one
 * presentation; `active`, `labels` and `target` are live getters.
 */
export interface FormPlayerHostRequest {
  /** The validated node's `schema` (validated again by the host before it paints). */
  schema: unknown;
  /** The node's `action` intent name. */
  action: string;
  /** The node's `label` prop (the form's accessible name), when it set one. */
  formLabel?: string;
  /** Host-chosen tier (never from the draft). */
  tier: RenderTier;
  /** False while the enclosing surface is inactive (`inert`). */
  active: boolean;
  /** Player messages the form shows (the confirmation after a confirmed submit). */
  labels: { submitted: string };
  /** The element the host paints into (empty, owned by the host until cleanup). */
  target: HTMLElement | null;
  /**
   * Propose the node's action with the submitted values (visible, enabled
   * fields only), mapped to scalar action values. Resolves once the host
   * confirmed or refused; on a confirmed submit the node's `submit` event
   * runs.
   */
  submit(values: Readonly<Record<string, unknown>>): Promise<FormPlayerSubmitResult>;
}

/** A host that validates and paints `schema-form` nodes. */
export interface FormPlayerHost {
  /** The form validator the player injects into `validateDraft`. */
  checkForm: DraftFormCheck;
  /**
   * The names of the host validators fields may name in `validator`. With
   * them a draft's names must be among these; without them a field that
   * names one is refused.
   */
  validators?: readonly string[];
  /**
   * Paint the form into `request.target`. May return a cleanup; the player
   * calls it when the node, its schema, the tier or the host changes, and
   * on destroy, and only then presents again.
   */
  present(request: FormPlayerHostRequest): undefined | (() => void);
}

/**
 * The package that owns the form painter: a host passes
 * `createFormPlayerHost()` from `@texuli/forms/host` as `formHost` on
 * `Player`. A stable pointer for tests and docs; not a runtime import.
 */
export const FORM_HOST_PACKAGE = '@texuli/forms' as const;
