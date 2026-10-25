<script lang="ts">
import { Toaster } from '../src/components/toast/index.ts';
import type { ToastStore } from '../src/components/toast/toast-store.ts';
import type { ToasterPosition } from '../src/components/toast/variants.ts';

interface Props {
  store: ToastStore;
  position?: ToasterPosition;
}

let { store, position }: Props = $props();
</script>

<Toaster {store} {position} label="Notifications" />
