<script lang="ts">
import { Toaster } from '../src/components/toast/index.ts';
import type { ToastStore } from '../src/components/toast/toast-store.ts';
import type { ToasterPosition } from '../src/components/toast/variants.ts';

interface Props {
  store: ToastStore;
  position?: ToasterPosition;
  onpointerenter?: (event: PointerEvent) => void;
  onfocusin?: (event: FocusEvent) => void;
  mode?: 'top-layer' | 'contained';
  container?: Element | null;
  positioned?: boolean;
}

let { store, position, onpointerenter, onfocusin, mode, container, positioned }: Props = $props();
</script>

<Toaster {store} {position} label="Notifications" data-probe="toaster" {onpointerenter} {onfocusin} {mode} {container} {positioned} />
