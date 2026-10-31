// @texuli/forms: schema-driven forms (ADR-015). The root holds the Svelte
// view; the framework-free runtime is @texuli/forms/model.
export {
  type CompiledForm,
  createFormController,
  createMemoryDrafts,
  createWebStorageDrafts,
  type FormController,
  type FormDraftOptions,
  type FormDraftStorage,
  type FormSchema,
  type FormStepContext,
  type FormStepResult,
  type FormSubmitResult,
  type FormValidator,
  type FormValues,
  formatFormValue,
  formValuesToMarkdown,
  validateFormSchema,
} from './model/index.ts';
export {
  DEFAULT_SCHEMA_FORM_LABELS,
  LAZY_CONTROL_TYPES,
  type LazyControlType,
  SchemaForm,
  type SchemaFormActions,
  type SchemaFormControl,
  type SchemaFormControlProps,
  type SchemaFormControls,
  type SchemaFormCustomEntry,
  type SchemaFormCustomField,
  type SchemaFormCustomFields,
  type SchemaFormCustomSnippet,
  type SchemaFormLabels,
  type SchemaFormSubmission,
} from './view/index.ts';

/** The version of this package, kept equal to its manifest. */
export const FORMS_PACKAGE_VERSION = '0.11.1';
