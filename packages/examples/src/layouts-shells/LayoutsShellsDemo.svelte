<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';
import { onMount } from 'svelte';
import { AppShell } from 'texuli/layouts/shells';

const docsHref = safeHref('https://example.com/handbook', 'developer');
const statusHref = safeHref('https://example.com/status', 'developer');
let sidebarOpen = $state(true);
let drawerReady = $state(false);

onMount(() => {
  const findDrawer = () => {
    if (!document.querySelector('[data-tx-layout-drawer]')) return false;
    drawerReady = true;
    return true;
  };
  if (findDrawer()) return;
  const observer = new MutationObserver(() => {
    if (findDrawer()) observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
});
</script>

<section class="demo" aria-label="Responsive application shell examples">
  {#if !drawerReady}<p role="status">Loading the narrow navigation drawer…</p>{/if}
  <h2>Wide workspace</h2>
  <AppShell mainElement="div" mainId="wide-shell-main" sidebarLabel="Workspace navigation">
    {#snippet sidebar()}
      <nav aria-label="Workspace navigation">
        <strong>Harbor Notes</strong>
        <a href={docsHref}>Overview</a>
        <a href={statusHref}>Activity</a>
      </nav>
    {/snippet}
    {#snippet header()}
      <header class="header"><span>Release workspace</span><span>Updated today</span></header>
    {/snippet}
    {#snippet children()}
      <article>
        <h3>Weekly review</h3>
        <p>Three fictional release notes are ready for the Harbor team.</p>
      </article>
    {/snippet}
    {#snippet notifications()}
      <p>1 new review comment</p>
    {/snippet}
  </AppShell>

  <h2>RTL shell with drawer</h2>
  <div class="rtl-shell" dir="rtl" lang="ar">
    <AppShell
      bind:sidebarOpen
      mainElement="div"
      mainId="rtl-shell-main"
      sidebarLabel="تنقل مساحة العمل"
      closeLabel="إغلاق التنقل"
      skipLabel="انتقل إلى المحتوى"
      notificationsLabel="الإشعارات"
    >
      {#snippet sidebar()}
        <nav aria-label="تنقل مساحة العمل">
          <strong>Harbor Notes</strong>
          <a href={docsHref}>نظرة عامة</a>
          <a href={statusHref}>النشاط</a>
        </nav>
      {/snippet}
      {#snippet header()}
        <header class="header">
          <button type="button" onclick={() => (sidebarOpen = !sidebarOpen)}>فتح التنقل</button>
          <span>مراجعة الإصدار</span>
        </header>
      {/snippet}
      {#snippet children()}
        <article>
          <h3>ملخص أسبوعي</h3>
          <p>ثلاث ملاحظات خيالية جاهزة للمراجعة.</p>
        </article>
      {/snippet}
      {#snippet notifications()}
        <p>تعليق جديد واحد</p>
      {/snippet}
    </AppShell>
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
  }
  h2,
  h3,
  p {
    margin: 0;
  }
  .header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border-block-end: 1px solid var(--tx-border, ButtonBorder);
  }
  .rtl-shell {
    inline-size: min(100%, 48rem);
  }
  nav {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }
  nav a {
    color: inherit;
  }
  article {
    display: grid;
    gap: 0.5rem;
    padding: 1.25rem;
  }
</style>
