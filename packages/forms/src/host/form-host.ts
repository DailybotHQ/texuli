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
import { type Component, mount, unmount } from 'svelte';
import type { FormValidator } from '../model/controller.ts';
import { validateFormSchema } from '../model/schema.ts';
import type { FormSchemaIssue } from '../model/types.ts';
import type { SchemaFormCustomField, SchemaFormLabels } from '../view/labels.ts';

/** The tiers the player validates at. */
export type FormHostTier = 'developer' | 'untrusted';

/** The form validator a draft check runs (`checkFormDraft`). */
export type FormDraftCheck = (
  schema: unknown,
  tier: FormHostTier,
  validators?: readonly string[],
  kinds?: readonly string[]
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
  /** The kinds of {@link FormHostOptions.customFields}: the only custom kinds drafts may use. */
  customKinds: readonly string[];
  present(request: FormHostRequest): undefined | (() => void);
}

export interface FormHostOptions {
  /** Host validators by name, sync or async; schema fields name them in `validator`. */
  validators?: Readonly<Record<string, FormValidator>>;
  /** Label overrides for every painted form (the player's confirmation wins for `submitted`). */
  labels?: Partial<SchemaFormLabels>;
  /**
   * Custom field painters by kind (G113): a component that receives the
   * field context as `field`, and its validator. A draft may declare a
   * `custom` field only with one of these kinds (refused with `kind`
   * otherwise).
   */
  customFields?: Readonly<
    Record<
      string,
      {
        readonly component: Component<{ field: SchemaFormCustomField }>;
        readonly validate?: FormValidator;
      }
    >
  >;
  /**
   * Allow `password` and `otp` fields in drafts (G117). Off by default:
   * agent output asking for a credential is refused (`credential`).
   */
  credentials?: boolean;
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
  const customFields = options.customFields ?? {};
  const kinds = Object.keys(customFields);
  const credentials = options.credentials === true;
  const check = (
    schema: unknown,
    tier: FormHostTier,
    given?: readonly string[],
    kindsGiven?: readonly string[]
  ) =>
    validateFormSchema(schema, {
      tier,
      validators: given ?? names,
      // Only kinds this host paints, whatever the caller passes.
      kinds: (kindsGiven ?? kinds).filter((kind) => kinds.includes(kind)),
      credentials,
    });
  return {
    checkForm: (schema, tier, given, kindsGiven) => {
      const result = check(schema, tier, given, kindsGiven);
      return { ok: result.ok, issues: result.issues };
    },
    validators: names,
    customKinds: kinds,
    present(request) {
      const target = request.target;
      if (!target) return undefined;
      const checked = check(request.schema, request.tier);
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
            customFields,
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
