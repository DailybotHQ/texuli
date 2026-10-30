<script lang="ts">
import type { HarnessProps } from '../../../primitives/tests/support/contract.ts';
import SplitView from '../../src/layouts/app/SplitView.svelte';
import { BottomNav, MobileAppFrame, MobileHeader } from '../../src/layouts/mobile/index.ts';
import { AppShell } from '../../src/layouts/shells/index.ts';

let { p, refs }: HarnessProps = $props();
const k = (name: string) => `layouts/${name}`;
const items = [
  { id: 'home', href: '/home', label: 'Home', current: true },
  { id: 'inbox', href: '/inbox', label: 'Inbox' },
];
</script>

<AppShell mainElement="div" {...p(k('shells/AppShell'))} bind:ref={refs[k('shells/AppShell')]}>
  <p>Shell content</p>
</AppShell>
<SplitView {...p(k('app/SplitView'))} bind:ref={refs[k('app/SplitView')]}>
  {#snippet list()}<p>List</p>{/snippet}
</SplitView>
<BottomNav {items} {...p(k('mobile/BottomNav'))} bind:ref={refs[k('mobile/BottomNav')]} />
<MobileHeader title="Inbox" {...p(k('mobile/MobileHeader'))} bind:ref={refs[k('mobile/MobileHeader')]} />
<MobileAppFrame mainElement="div" {...p(k('mobile/MobileAppFrame'))} bind:ref={refs[k('mobile/MobileAppFrame')]}>
  <p>Screen</p>
</MobileAppFrame>
