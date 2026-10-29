<script lang="ts">
import { Toaster } from '../src/components/toast/index.ts';
import type { ToastStore } from '../src/components/toast/toast-store.ts';
import type { ToasterPosition } from '../src/components/toast/variants.ts';

interface Props {
  store: ToastStore;
  position?: ToasterPosition;
  onpointerenter?: (event: PointerEvent) => void;
  onfocusin?: (event: FocusEvent) => void;
}

let { store, position, onpointerenter, onfocusin }: Props = $props();
</script>

<Toaster {store} {position} label="Notifications" data-probe="toaster" {onpointerenter} {onfocusin} />
