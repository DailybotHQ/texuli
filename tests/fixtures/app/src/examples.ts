/**
 * Fixture-app façade over `@texuli/examples`. Visual, a11y and e2e specs import
 * from here so the registry stays the single source of example ids and loaders.
 */
export {
  defineExample,
  type ExampleEntry,
  type ExampleFilter,
  type ExampleMeta,
  type ExampleModule,
  getExample,
  listExampleIds,
  listExamples,
} from '@texuli/examples';
