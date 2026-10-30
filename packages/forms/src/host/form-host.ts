/**
 * The `formHost` seam of `@texuli/player` (spec 0.8.0, ADR-015): agents
 * emit a `schema-form` catalog node whose `schema` prop holds a form
 * schema; the player runs `checkForm` inside its validation (at the
 * player's tier, never the draft's, with this host's validator names) and
 * hands each valid node to `present`, which mounts `SchemaForm` (loaded on
 * first use) into the player's surface. The types are declared here
 * structurally, because this package (L4) cannot import the player (L7);
 * the player keeps the form engine out of its eager chunk this way.
 */
import { mount, unmount } from 'svelte';
import type { FormValidator } from '../model/controller.ts';
import { checkFormDraft, validateFormSchema } from '../model/schema.ts';
import type { FormSchemaIssue } from '../model/types.ts';
import type { SchemaFormLabels } from '../view/labels.ts';

/** The tiers the player validates at. */
export type FormHostTier = 'developer' | 'untrusted';

/** The form validator a draft check runs (`checkFormDraft`). */
export type FormDraftCheck = (
  schema: unknown,
  tier: FormHostTier,
  validators?: readonly string[]
) => { ok: boolean; issues: readonly FormSchemaIssue[] };

/** What a submit resolves to: accepted, or refused with a message the form shows. */
export type FormHostSubmitResult = { ok: true } | { ok: false; message: string };

/** What the player hands `present` (`active`, `labels` and `target` are live getters). */
export interface FormHostRequest {
  schema: unknown;
  /** The node's `action` intent name. */
  action: string;
  /** The node's `label` prop (the form's accessible name), when it set one. */
  formLabel?: string;
  tier: FormHostTier;
  active: boolean;
  /** Player messages: the confirmation after a confirmed submit. */
  labels: { submitted: string };
  target: HTMLElement | null;
  /** Propose the node's action with the submitted values (visible, enabled fields only). */
  submit(values: Readonly<Record<string, unknown>>): Promise<FormHostSubmitResult>;
}

export interface FormHost {
  checkForm: FormDraftCheck;
  /** The names of {@link FormHostOptions.validators}: the only ones drafts may name. */
  validators: readonly string[];
  present(request: FormHostRequest): undefined | (() => void);
}

export interface FormHostOptions {
  /** Host validators by name, sync or async; schema fields name them in `validator`. */
  validators?: Readonly<Record<string, FormValidator>>;
  /** Label overrides for every painted form (the player's confirmation wins for `submitted`). */
  labels?: Partial<SchemaFormLabels>;
}

/**
 * A `formHost` for `Player`: `checkForm` (`checkFormDraft`) joins
 * validation with the names of `options.validators` (a field that names
 * any other validator is refused, none registered means none allowed), and `present`
 * validates the schema again at the tier and mounts `SchemaForm`, whose
 * submit goes to `request.submit`. A schema that does not validate paints
 * nothing. The cleanup unmounts the form, or cancels a mount still loading.
 */
export function createFormPlayerHost(options: FormHostOptions = {}): FormHost {
  const validators = options.validators ?? {};
  const names = Object.keys(validators);
  return {
    checkForm: checkFormDraft,
    validators: names,
    present(request) {
      const target = request.target;
      if (!target) return undefined;
      const checked = validateFormSchema(request.schema, { tier: request.tier, validators: names });
      if (!checked.ok) return undefined;
      let cancelled = false;
      let instance: Record<string, unknown> | null = null;
      void import('../view/SchemaForm.svelte').then(({ default: SchemaForm }) => {
        if (cancelled) return;
        instance = mount(SchemaForm, {
          target,
          props: {
            form: checked.form,
            validators,
            labels: { ...options.labels, submitted: request.labels.submitted },
            ...(request.formLabel ? { 'aria-label': request.formLabel } : {}),
            onSubmit: async ({ values }) => {
              const result = await request.submit(values);
              return result.ok ? { ok: true } : { ok: false, message: result.message };
            },
          },
        });
      });
      return () => {
        cancelled = true;
        if (instance) void unmount(instance);
        instance = null;
      };
    },
  };
}
