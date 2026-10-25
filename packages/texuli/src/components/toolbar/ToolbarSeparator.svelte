<script lang="ts">
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import { type ClassValue, cx } from '../../internal/cx.ts';
import './toolbar.css';

type Props = {
  class?: ClassValue;
};

let { class: className }: Props = $props();
</script>

<ToolbarPrimitive.Separator class={cx('tx-toolbar__separator', className)} />
