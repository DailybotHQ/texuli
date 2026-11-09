<script lang="ts">
/**
 * KitModeSwitch: Both, Light or Dark (kit API §4), a native radio group so the arrow keys,
 * labels and form semantics come from the platform. Labels go through `texuli.ds-kit.*`
 * message ids (ADR-016).
 */
import { useMessages } from '../../i18n/use-messages.ts';
import type { KitModeView } from './types.ts';

type Props = {
  value?: KitModeView;
  /** A unique radio group name. */
  name: string;
  onchange?: (value: KitModeView) => void;
};

let { value = $bindable('both'), name, onchange }: Props = $props();

const msg = useMessages();
const options = $derived<readonly { value: KitModeView; label: string }[]>([
  { value: 'both', label: msg('texuli.ds-kit.mode-both', 'Both') },
  { value: 'light', label: msg('texuli.ds-kit.mode-light', 'Light') },
  { value: 'dark', label: msg('texuli.ds-kit.mode-dark', 'Dark') },
]);
</script>

<fieldset class="tx-ds-kit__modes" data-tx-ds-kit-modes="">
  <legend>{msg('texuli.ds-kit.mode-legend', 'Color mode')}</legend>
  {#each options as option (option.value)}
    <label>
      <input
        type="radio"
        {name}
        value={option.value}
        checked={value === option.value}
        onchange={() => {
          value = option.value;
          onchange?.(option.value);
        }}
      />
      {option.label}
    </label>
  {/each}
</fieldset>
