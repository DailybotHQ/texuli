import CheckboxGroup from './CheckboxGroup.svelte';
import CheckboxIndicator from './CheckboxIndicator.svelte';
import CheckboxRoot from './CheckboxRoot.svelte';

export {
  type CheckboxGroupContext,
  type CheckedState,
  getCheckboxGroupContext,
  setCheckboxGroupContext,
} from './context.ts';
export {
  type CheckboxFormBridge,
  type CheckboxFormOptions,
  createCheckboxFormBridge,
} from './form.ts';

/** Namespace matching the public Bits-style composition surface. */
export const Checkbox = {
  Root: CheckboxRoot,
  Group: CheckboxGroup,
  Indicator: CheckboxIndicator,
};

export { CheckboxGroup, CheckboxIndicator, CheckboxRoot };
