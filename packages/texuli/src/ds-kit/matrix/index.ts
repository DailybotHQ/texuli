/**
 * The kit's components matrix (kit API §5.2): `KitMatrix` and its pure model, plus the
 * built-in samples for `texuli` catalog ids.
 */
export { default as KitMatrix } from './KitMatrix.svelte';
export {
  MATRIX_AXES,
  MATRIX_STATES,
  type MatrixAxis,
  type MatrixCell,
  type MatrixCellKind,
  type MatrixCells,
  type MatrixComponent,
  type MatrixIssue,
  type MatrixModel,
  matrixAttributes,
  matrixCells,
  matrixModel,
  matrixProps,
  PSEUDO_STATES,
  staticStates,
} from './model.ts';
export { builtinSample, KIT_BUILTIN_SAMPLES, type KitBuiltinSample } from './samples.ts';
