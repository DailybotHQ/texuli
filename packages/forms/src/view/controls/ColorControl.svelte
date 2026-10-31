<script lang="ts">
import { ColorPicker } from 'texuli/tags-color';
import type { SchemaFormControlProps } from './types.ts';

/*
 * A color as hex (`#rrggbb`, or `#rrggbbaa` with transparency) through the
 * texuli ColorPicker. The picker always shows a color; until the person
 * picks one the answer stays empty (`null`).
 */

let { field, value, attrs, disabled, readOnly, onValue }: SchemaFormControlProps = $props();
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
</script>

<ColorPicker
  {...attrs}
  label={field.label}
  value={typeof value === 'string' ? value : undefined}
  format="hex"
  disabled={disabled || readOnly}
  onValueChange={(next) => {
    if (HEX.test(next)) onValue(next);
  }}
/>
