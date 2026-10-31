import { createExpressionBudget } from '@texuli/core/expression';
import type { CompiledForm } from './schema.ts';
import type { FormValue, FormValues } from './types.ts';
import {
  computeFormLogic,
  DEFAULT_FORM_MESSAGES,
  type FormLogicState,
  type FormMessages,
  stepFields,
  submittedValues,
  validateFormValues,
} from './validate.ts';
import { coerceValue, emptyValue, isSecretType } from './values.ts';

/*
 * A framework-free form controller: values, touched fields, errors, the
 * current step, host validators (sync or async, aborted when superseded),
 * drafts with a debounced autosave through a host storage adapter, and the
 * submit pipeline. Views subscribe and render `getState()`; the Svelte view
 * in `@texuli/forms` is one such view.
 */

/** A host-registered validator. Return a message for a problem, or nothing. */
export type FormValidator = (
  value: FormValue,
  context: { readonly name: string; readonly values: FormValues; readonly signal: AbortSignal }
) => string | null | undefined | Promise<string | null | undefined>;

/** Where drafts live. Every method may be sync or async; failures are reported, never thrown. */
export interface FormDraftStorage {
  load(key: string): unknown | Promise<unknown>;
  save(key: string, draft: FormDraft): void | Promise<void>;
  remove(key: string): void | Promise<void>;
}

/** A stored draft. Restored drafts are untrusted: values are coerced field by field. */
export interface FormDraft {
  readonly format: 'texuli-form-draft';
  readonly version: 1;
  readonly values: FormValues;
  readonly step: number;
  readonly savedAt: number;
}

export interface FormDraftOptions {
  readonly storage: FormDraftStorage;
  /** The storage key, unique per form (and per record, when editing one). */
  readonly key: string;
  /** Autosave delay after the last change, in milliseconds (default 800; 0 saves at once). */
  readonly debounceMs?: number;
}

/** What `onSubmit` may return: nothing or `{ ok: true }` for success, or server-side errors. */
export type FormSubmitResult =
  | undefined
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly errors?: Readonly<Record<string, string>>;
      readonly message?: string;
    };

/**
 * What `onStep` may return: nothing or `{ ok: true }` moves on; `{ ok: false }`
 * blocks the step, with errors by field name and/or a message for the step.
 */
export type FormStepResult = FormSubmitResult;

/** What `onStep` receives when a step validated and the person moves forward. */
export interface FormStepContext {
  /** The step being left. */
  readonly step: FormStepState;
  /** Its position among the visible steps. */
  readonly position: number;
  /** The visible, enabled answers of this step. */
  readonly values: FormValues;
  /** Every visible, enabled answer so far. */
  readonly allValues: FormValues;
  /** Aborted when the controller is destroyed or reset. */
  readonly signal: AbortSignal;
}

export interface FormSubmission {
  /** Visible, enabled fields only. */
  readonly values: FormValues;
}

export interface FormTimers {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface FormControllerOptions {
  /** Starting values (coerced per field; unknown names are dropped). */
  readonly values?: Readonly<Record<string, unknown>>;
  readonly validators?: Readonly<Record<string, FormValidator>>;
  readonly messages?: Partial<FormMessages>;
  readonly drafts?: FormDraftOptions;
  readonly onSubmit?: (
    submission: FormSubmission
  ) => FormSubmitResult | undefined | Promise<FormSubmitResult | undefined>;
  /** The host clock (conditions' `today()` and draft timestamps). Default `Date.now`. */
  readonly now?: () => number;
  /** Timer functions (tests pass fakes). Default `setTimeout` and `clearTimeout`. */
  readonly timers?: FormTimers;
  /**
   * Validators of `custom` fields, keyed by field name or by kind (the name
   * wins), sync or async. They run after `required`, like a named
   * `validator` (which, when the field also names one, runs after them).
   */
  readonly customValidators?: Readonly<Record<string, FormValidator>>;
  /**
   * The whole form is disabled: views disable every control and action.
   * Presentation only: the API (setValue, submit) still works, and the
   * fields' values are still submitted. Change it with `setDisabled`.
   */
  readonly disabled?: boolean;
  /** The whole form is read-only (views show values without editing). Change it with `setReadOnly`. */
  readonly readOnly?: boolean;
  /**
   * Runs when a step validated and the person moves forward (Next, or a
   * later step in the progress), sync or async; `{ ok: false }` blocks the
   * move with field errors and/or a step message. Not run on the last step:
   * submitting goes to `onSubmit`.
   */
  readonly onStep?: (
    context: FormStepContext
  ) => FormStepResult | undefined | Promise<FormStepResult | undefined>;
}

export type FormStatus = 'editing' | 'validating' | 'submitting' | 'submitted' | 'failed';
export type FormDraftStatus = 'none' | 'saving' | 'saved' | 'restored' | 'error';

export interface FormStepState {
  readonly id: string;
  readonly title: string;
  readonly description: string | undefined;
  /** Index into `CompiledForm.steps`. */
  readonly index: number;
}

export interface FormState {
  readonly values: FormValues;
  /** Errors to show, by field name (set once a field was blurred or its step validated). */
  readonly errors: Readonly<Record<string, string>>;
  /** Form-level errors: cross-field rules with no field, and a failed submission's message. */
  readonly formErrors: readonly string[];
  readonly touched: Readonly<Record<string, true>>;
  readonly logic: FormLogicState;
  /** The visible steps, in order. */
  readonly steps: readonly FormStepState[];
  /** Position in `steps`. */
  readonly step: number;
  readonly status: FormStatus;
  /** Fields whose host validator is running. */
  readonly pending: Readonly<Record<string, true>>;
  readonly draft: { readonly status: FormDraftStatus; readonly savedAt: number | null };
  readonly submitCount: number;
  /** The form-level disabled flag. */
  readonly disabled: boolean;
  /** The form-level read-only flag. */
  readonly readOnly: boolean;
  /** A message from `onStep` that blocked the current step, or `null`. */
  readonly stepError: string | null;
}

export type FormSubmitOutcome =
  | { readonly ok: true; readonly values: FormValues }
  | {
      readonly ok: false;
      readonly errors: Readonly<Record<string, string>>;
      readonly formErrors: readonly string[];
      /** The first field to focus, in document order. */
      readonly firstInvalid: string | null;
    };

export interface FormController {
  readonly form: CompiledForm;
  getState(): FormState;
  subscribe(listener: (state: FormState) => void): () => void;
  /** Set a value (coerced; refused values are ignored) and recalculate. */
  setValue(name: string, value: unknown): void;
  /** Mark a field touched and validate it (closed rules, then its host validator). */
  blur(name: string): Promise<void>;
  /** Validate the current step; on failure its errors show. */
  validateStep(): Promise<FormSubmitOutcome>;
  next(): Promise<FormSubmitOutcome>;
  back(): void;
  /** Go to a visible step; moving forward validates each step on the way. */
  goTo(position: number): Promise<boolean>;
  submit(): Promise<FormSubmitOutcome>;
  restoreDraft(): Promise<boolean>;
  saveDraft(): Promise<void>;
  clearDraft(): Promise<void>;
  reset(values?: Readonly<Record<string, unknown>>): void;
  /** Disable or enable the whole form (see `FormControllerOptions.disabled`). */
  setDisabled(disabled: boolean): void;
  /** Make the whole form read-only or editable again. */
  setReadOnly(readOnly: boolean): void;
  destroy(): void;
}

const DEFAULT_TIMERS: FormTimers = {
  set: (callback, ms) => setTimeout(callback, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Create a controller for a compiled form. */
export function createFormController(
  form: CompiledForm,
  options: FormControllerOptions = {}
): FormController {
  const now = options.now ?? Date.now;
  const timers = options.timers ?? DEFAULT_TIMERS;
  const messages: FormMessages = { ...DEFAULT_FORM_MESSAGES, ...options.messages };
  const validators = options.validators ?? {};
  const customValidators = options.customValidators ?? {};
  const drafts = options.drafts;
  const debounce = Math.max(0, drafts?.debounceMs ?? 800);

  const initialValues = (source: Readonly<Record<string, unknown>> | undefined): FormValues => {
    const out: Record<string, FormValue> = {};
    for (const { field } of form.fields) {
      const given =
        source && Object.hasOwn(source, field.name)
          ? coerceValue(field, source[field.name])
          : undefined;
      out[field.name] = given ?? field.default ?? emptyValue(field);
    }
    return Object.freeze(out);
  };

  let values = initialValues(options.values);
  let errors: Record<string, string> = {};
  let formErrors: string[] = [];
  let touched: Record<string, true> = {};
  let pending: Record<string, true> = {};
  let position = 0;
  let status: FormStatus = 'editing';
  let draftStatus: FormDraftStatus = 'none';
  let savedAt: number | null = null;
  let submitCount = 0;
  let disabled = options.disabled === true;
  let readOnly = options.readOnly === true;
  let stepError: string | null = null;
  let stepRun: AbortController | null = null;
  let logic = computeFormLogic(form, values, { now });
  let state: FormState;
  let saveTimer: unknown = null;
  let destroyed = false;
  const listeners = new Set<(state: FormState) => void>();
  const running = new Map<string, AbortController>();

  const visibleSteps = (): FormStepState[] =>
    form.steps
      .map((step, index) => ({ step, index }))
      .filter(({ index }) => logic.steps[index])
      .map(({ step, index }) =>
        Object.freeze({ id: step.id, title: step.title, description: step.description, index })
      );

  const build = (): FormState => {
    const steps = visibleSteps();
    position = Math.min(position, Math.max(0, steps.length - 1));
    const shown: Record<string, string> = {};
    for (const [name, message] of Object.entries(errors)) {
      if (logic.fields[name]?.visible && logic.fields[name]?.enabled) shown[name] = message;
    }
    return Object.freeze({
      values,
      errors: Object.freeze(shown),
      formErrors: Object.freeze([...formErrors]),
      touched: Object.freeze({ ...touched }),
      logic,
      steps: Object.freeze(steps),
      step: position,
      status,
      pending: Object.freeze({ ...pending }),
      draft: Object.freeze({ status: draftStatus, savedAt }),
      submitCount,
      disabled,
      readOnly,
      stepError,
    });
  };

  const emit = () => {
    if (destroyed) return;
    state = build();
    for (const listener of [...listeners]) listener(state);
  };
  state = build();

  const recalculate = () => {
    logic = computeFormLogic(form, values, { now });
  };

  const currentStepIndex = () => state.steps[position]?.index ?? 0;

  const scheduleSave = () => {
    if (!drafts || destroyed) return;
    if (saveTimer !== null) timers.clear(saveTimer);
    saveTimer = timers.set(() => {
      saveTimer = null;
      void saveDraft();
    }, debounce);
  };

  async function saveDraft(): Promise<void> {
    if (!drafts || destroyed) return;
    if (saveTimer !== null) {
      timers.clear(saveTimer);
      saveTimer = null;
    }
    const kept: Record<string, FormValue> = {};
    for (const { field } of form.fields) {
      // Files never go into drafts (the host owns them), nor do credentials.
      if (field.type !== 'file' && !isSecretType(field.type))
        kept[field.name] = values[field.name] as FormValue;
    }
    const draft: FormDraft = Object.freeze({
      format: 'texuli-form-draft',
      version: 1,
      values: Object.freeze(kept),
      step: currentStepIndex(),
      savedAt: now(),
    });
    draftStatus = 'saving';
    emit();
    try {
      await drafts.storage.save(drafts.key, draft);
      draftStatus = 'saved';
      savedAt = draft.savedAt;
    } catch {
      draftStatus = 'error';
    }
    emit();
  }

  const own = (record: Readonly<Record<string, FormValidator>>, key: string | undefined) =>
    key !== undefined && Object.hasOwn(record, key) ? record[key] : undefined;

  /** The host validators of a field, in order; `null` marks a named one that is missing. */
  const validatorsOf = (name: string): (FormValidator | null)[] => {
    const field = form.byName.get(name)?.field;
    if (!field) return [];
    const out: (FormValidator | null)[] = [];
    if (field.type === 'custom') {
      const custom = own(customValidators, name) ?? own(customValidators, field.kind);
      if (custom) out.push(custom);
    }
    if (field.validator !== undefined) out.push(own(validators, field.validator) ?? null);
    return out;
  };

  const runValidator = async (name: string): Promise<string | null> => {
    const list = validatorsOf(name);
    if (list.length === 0) return null;
    if (list.includes(null)) return messages.validatorMissing;
    running.get(name)?.abort();
    const controller = new AbortController();
    running.set(name, controller);
    pending = { ...pending, [name]: true };
    emit();
    let message: string | null = null;
    try {
      for (const validator of list as FormValidator[]) {
        const result = await validator(values[name] as FormValue, {
          name,
          values,
          signal: controller.signal,
        });
        if (typeof result === 'string' && result.length > 0) {
          message = result.slice(0, 300);
          break;
        }
        if (controller.signal.aborted) break;
      }
    } catch {
      message = controller.signal.aborted ? null : messages.validatorFailed;
    }
    if (running.get(name) === controller) {
      running.delete(name);
      const { [name]: _done, ...rest } = pending;
      pending = rest;
    }
    if (controller.signal.aborted) throw controller.signal;
    return message;
  };

  /** Validate some fields: closed rules, rules, then host validators where those passed. */
  const check = async (names: readonly string[] | null): Promise<FormSubmitOutcome> => {
    const budget = createExpressionBudget();
    const result = validateFormValues(form, values, {
      logic,
      messages,
      now,
      budget,
      ...(names ? { fields: names } : {}),
    });
    const found: Record<string, string> = { ...result.errors };
    const scope = names ?? form.fields.map((entry) => entry.field.name);
    const async = scope.filter(
      (name) =>
        !found[name] &&
        validatorsOf(name).length > 0 &&
        logic.fields[name]?.visible &&
        logic.fields[name]?.enabled
    );
    if (async.length > 0) {
      status = 'validating';
      emit();
      const snapshot = values;
      const outcomes = await Promise.allSettled(async.map((name) => runValidator(name)));
      if (values !== snapshot) {
        // Values moved on while validators ran: judge the newest values instead.
        return check(names);
      }
      outcomes.forEach((outcome, index) => {
        if (outcome.status === 'fulfilled' && outcome.value)
          found[async[index] as string] = outcome.value;
      });
    }
    for (const name of scope) {
      if (found[name]) errors[name] = found[name] as string;
      else delete errors[name];
    }
    formErrors = names === null ? [...result.formErrors] : formErrors;
    const firstInvalid = form.fields.find((entry) => found[entry.field.name])?.field.name ?? null;
    if (Object.keys(found).length === 0 && (names !== null || result.formErrors.length === 0)) {
      return { ok: true, values: submittedValues(form, values, logic) };
    }
    return Object.freeze({
      ok: false,
      errors: Object.freeze(found),
      formErrors: Object.freeze([...result.formErrors]),
      firstInvalid,
    });
  };

  const stepNames = (index: number) => stepFields(form, index, logic);

  /** Run `onStep` for the current step; `null` when it lets the person move on. */
  const runStepHook = async (): Promise<FormSubmitOutcome | null> => {
    if (!options.onStep) return null;
    const current = state.steps[position];
    if (!current) return null;
    stepRun?.abort();
    const run = new AbortController();
    stepRun = run;
    const all = submittedValues(form, values, logic);
    const mine: Record<string, FormValue> = {};
    for (const name of stepNames(current.index)) {
      if (Object.hasOwn(all, name)) mine[name] = all[name] as FormValue;
    }
    status = 'validating';
    emit();
    let result: FormStepResult | undefined;
    try {
      result = await options.onStep({
        step: current,
        position,
        values: Object.freeze(mine),
        allValues: all,
        signal: run.signal,
      });
    } catch {
      result = { ok: false, message: messages.stepFailed };
    }
    if (stepRun === run) stepRun = null;
    if (status === 'validating') status = 'editing';
    if (run.signal.aborted || destroyed) {
      return { ok: false, errors: {}, formErrors: [], firstInvalid: null };
    }
    if (result?.ok !== false) return null;
    const found: Record<string, string> = {};
    for (const [name, message] of Object.entries(result.errors ?? {})) {
      if (form.byName.has(name) && typeof message === 'string') found[name] = message.slice(0, 300);
    }
    errors = { ...errors, ...found };
    stepError = typeof result.message === 'string' ? result.message.slice(0, 300) : null;
    if (Object.keys(found).length === 0 && stepError === null) stepError = messages.stepFailed;
    emit();
    return Object.freeze({
      ok: false,
      errors: Object.freeze(found),
      formErrors: Object.freeze(stepError ? [stepError] : []),
      firstInvalid: form.fields.find((entry) => found[entry.field.name])?.field.name ?? null,
    });
  };

  /** Validate the current step, run the hook, and move one step forward. */
  let advancing: Promise<FormSubmitOutcome> | null = null;
  // Calls made while a move is in flight share it, so a double click moves one step.
  const advance = (): Promise<FormSubmitOutcome> => {
    advancing ??= advanceOnce().finally(() => {
      advancing = null;
    });
    return advancing;
  };
  const advanceOnce = async (): Promise<FormSubmitOutcome> => {
    stepError = null;
    const outcome = await controller.validateStep();
    if (!outcome.ok || position >= state.steps.length - 1) return outcome;
    const blocked = await runStepHook();
    if (blocked) return blocked;
    position += 1;
    emit();
    scheduleSave();
    return outcome;
  };

  const controller: FormController = {
    form,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setValue(name, raw) {
      const entry = form.byName.get(name);
      if (!entry || destroyed) return;
      const value = coerceValue(entry.field, raw);
      if (value === undefined) return;
      values = Object.freeze({ ...values, [name]: value });
      recalculate();
      running.get(name)?.abort();
      // Re-check a field that already shows an error, so it clears as it is fixed.
      if (errors[name] !== undefined) {
        const result = validateFormValues(form, values, { logic, messages, now, fields: [name] });
        if (result.errors[name]) errors[name] = result.errors[name] as string;
        else delete errors[name];
      }
      if (status === 'submitted' || status === 'failed') status = 'editing';
      emit();
      scheduleSave();
    },
    async blur(name) {
      if (!form.byName.has(name) || destroyed) return;
      touched = { ...touched, [name]: true };
      await check([name]);
      if (status === 'validating') status = 'editing';
      emit();
    },
    async validateStep() {
      const outcome = await check(stepNames(currentStepIndex()));
      if (status === 'validating') status = 'editing';
      emit();
      return outcome;
    },
    next: advance,
    back() {
      if (position > 0) {
        position -= 1;
        stepError = null;
        emit();
        scheduleSave();
      }
    },
    async goTo(target) {
      const last = state.steps.length - 1;
      const to = Math.max(0, Math.min(last, Math.floor(target)));
      while (position < to) {
        const outcome = await advance();
        if (!outcome.ok) return false;
      }
      if (position > to) {
        position = to;
        stepError = null;
      }
      emit();
      scheduleSave();
      return true;
    },
    async submit() {
      if (status === 'submitting' || destroyed) {
        return { ok: false, errors: {}, formErrors: [], firstInvalid: null };
      }
      submitCount += 1;
      const outcome = await check(null);
      if (!outcome.ok) {
        status = 'failed';
        // Show the earliest step with a problem.
        const first = outcome.firstInvalid ? form.byName.get(outcome.firstInvalid) : undefined;
        if (first) {
          const at = state.steps.findIndex((step) => step.index === first.step);
          if (at >= 0) position = at;
        }
        emit();
        return outcome;
      }
      status = 'submitting';
      emit();
      let result: FormSubmitResult | undefined;
      try {
        result = await options.onSubmit?.({ values: outcome.values });
      } catch {
        result = { ok: false, message: 'The form could not be sent. Try again.' };
      }
      if (result && result.ok === false) {
        status = 'failed';
        const serverErrors: Record<string, string> = {};
        for (const [name, message] of Object.entries(result.errors ?? {})) {
          if (form.byName.has(name) && typeof message === 'string')
            serverErrors[name] = message.slice(0, 300);
        }
        errors = { ...errors, ...serverErrors };
        formErrors = typeof result.message === 'string' ? [result.message.slice(0, 300)] : [];
        emit();
        const firstInvalid =
          form.fields.find((entry) => serverErrors[entry.field.name])?.field.name ?? null;
        return {
          ok: false,
          errors: Object.freeze(serverErrors),
          formErrors: Object.freeze([...formErrors]),
          firstInvalid,
        };
      }
      status = 'submitted';
      formErrors = [];
      emit();
      if (drafts) await controller.clearDraft();
      return outcome;
    },
    async restoreDraft() {
      if (!drafts || destroyed) return false;
      let raw: unknown;
      try {
        raw = await drafts.storage.load(drafts.key);
      } catch {
        draftStatus = 'error';
        emit();
        return false;
      }
      if (
        !isRecord(raw) ||
        raw.format !== 'texuli-form-draft' ||
        raw.version !== 1 ||
        !isRecord(raw.values)
      ) {
        return false;
      }
      const restored: Record<string, FormValue> = { ...values };
      for (const { field } of form.fields) {
        if (
          field.type === 'file' ||
          isSecretType(field.type) ||
          !Object.hasOwn(raw.values, field.name)
        )
          continue;
        const value = coerceValue(field, raw.values[field.name]);
        if (value !== undefined) restored[field.name] = value;
      }
      values = Object.freeze(restored);
      recalculate();
      state = build();
      const step = typeof raw.step === 'number' && Number.isInteger(raw.step) ? raw.step : 0;
      const at = state.steps.findIndex((entry) => entry.index === step);
      position = at >= 0 ? at : 0;
      draftStatus = 'restored';
      savedAt =
        typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : null;
      emit();
      return true;
    },
    saveDraft,
    async clearDraft() {
      if (!drafts) return;
      if (saveTimer !== null) {
        timers.clear(saveTimer);
        saveTimer = null;
      }
      try {
        await drafts.storage.remove(drafts.key);
        draftStatus = 'none';
        savedAt = null;
      } catch {
        draftStatus = 'error';
      }
      emit();
    },
    reset(next) {
      for (const run of running.values()) run.abort();
      running.clear();
      values = initialValues(next ?? options.values);
      errors = {};
      formErrors = [];
      touched = {};
      pending = {};
      position = 0;
      status = 'editing';
      stepError = null;
      stepRun?.abort();
      recalculate();
      emit();
      scheduleSave();
    },
    setDisabled(next) {
      if (disabled === (next === true)) return;
      disabled = next === true;
      emit();
    },
    setReadOnly(next) {
      if (readOnly === (next === true)) return;
      readOnly = next === true;
      emit();
    },
    destroy() {
      destroyed = true;
      stepRun?.abort();
      if (saveTimer !== null) timers.clear(saveTimer);
      for (const run of running.values()) run.abort();
      running.clear();
      listeners.clear();
    },
  };
  return controller;
}

/** A draft storage over a Web Storage area (`localStorage`, `sessionStorage`). */
export function createWebStorageDrafts(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): FormDraftStorage {
  return {
    load(key) {
      const text = storage.getItem(key);
      if (text === null || text.length > 1_000_000) return null;
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return null;
      }
    },
    save(key, draft) {
      storage.setItem(key, JSON.stringify(draft));
    },
    remove(key) {
      storage.removeItem(key);
    },
  };
}

/** A draft storage in memory (tests, previews, server rendering). */
export function createMemoryDrafts(): FormDraftStorage & {
  readonly entries: ReadonlyMap<string, FormDraft>;
} {
  const entries = new Map<string, FormDraft>();
  return {
    entries,
    load: (key) => entries.get(key) ?? null,
    save: (key, draft) => {
      entries.set(key, draft);
    },
    remove: (key) => {
      entries.delete(key);
    },
  };
}
