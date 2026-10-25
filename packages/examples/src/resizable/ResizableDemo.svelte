<script lang="ts">
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from 'texuli/resizable';

// The remembered layout lives in memory here; pass `localStorage` in an app.
const memory = new Map<string, string>();
const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
};
let collapsed = $state(false);
</script>

<div class="demo" data-example="texuli-resizable">
  <section>
    <h2>Default</h2>
    <ResizablePanelGroup class="demo-group">
      <ResizablePanel defaultSize={35} minSize={20}>
        <div class="demo-pane"><strong>Folders</strong><p>Inbox · Drafts · Archive</p></div>
      </ResizablePanel>
      <ResizableHandle label="Resize folders" />
      <ResizablePanel minSize={30}>
        <div class="demo-pane"><strong>Messages</strong><p>Three fictional notes from the harbor team.</p></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>

  <section>
    <h2>Bordered, three panels</h2>
    <ResizablePanelGroup variant="bordered" class="demo-group">
      <ResizablePanel defaultSize={25} minSize={15}>
        <div class="demo-pane"><strong>Projects</strong></div>
      </ResizablePanel>
      <ResizableHandle label="Resize projects" />
      <ResizablePanel defaultSize={45} minSize={25}>
        <div class="demo-pane"><strong>Tasks</strong><p>Fictional backlog for the east pier.</p></div>
      </ResizablePanel>
      <ResizableHandle label="Resize tasks" />
      <ResizablePanel defaultSize={30} minSize={20}>
        <div class="demo-pane"><strong>Details</strong></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>

  <section>
    <h2>Stacked, small handle without grip</h2>
    <ResizablePanelGroup direction="vertical" variant="bordered" class="demo-group demo-tall">
      <ResizablePanel defaultSize={60} minSize={25}>
        <div class="demo-pane"><strong>Editor</strong></div>
      </ResizablePanel>
      <ResizableHandle label="Resize editor" size="sm" withGrip={false} />
      <ResizablePanel minSize={20}>
        <div class="demo-pane"><strong>Terminal</strong><p>$ build finished in 2 fictional seconds</p></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>

  <section>
    <h2>Collapsible sidebar</h2>
    <p class="demo-hint">Focus the handle and press Enter to collapse or restore the sidebar.</p>
    <ResizablePanelGroup variant="bordered" class="demo-group">
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        collapsible
        onCollapse={() => (collapsed = true)}
        onExpand={() => (collapsed = false)}
      >
        <div class="demo-pane"><strong>Sidebar</strong></div>
      </ResizablePanel>
      <ResizableHandle label="Resize sidebar" />
      <ResizablePanel minSize={40}>
        <div class="demo-pane"><strong>Content</strong><p>Sidebar {collapsed ? 'collapsed' : 'open'}.</p></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>

  <section>
    <h2>Disabled</h2>
    <ResizablePanelGroup disabled variant="bordered" class="demo-group">
      <ResizablePanel defaultSize={50}>
        <div class="demo-pane"><strong>Left</strong></div>
      </ResizablePanel>
      <ResizableHandle label="Resize locked panels" />
      <ResizablePanel>
        <div class="demo-pane"><strong>Right</strong></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>

  <section dir="rtl" lang="ar">
    <h2>من اليمين إلى اليسار</h2>
    <ResizablePanelGroup variant="bordered" class="demo-group">
      <ResizablePanel defaultSize={35} minSize={20}>
        <div class="demo-pane"><strong>المجلدات</strong></div>
      </ResizablePanel>
      <ResizableHandle label="تغيير حجم المجلدات" />
      <ResizablePanel minSize={30}>
        <div class="demo-pane"><strong>الرسائل</strong></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>

  <section>
    <h2>Remembered layout</h2>
    <ResizablePanelGroup autoSaveId="demo-layout" {storage} variant="bordered" class="demo-group">
      <ResizablePanel defaultSize={40} minSize={20}>
        <div class="demo-pane"><strong>Saved width</strong></div>
      </ResizablePanel>
      <ResizableHandle label="Resize saved panel" />
      <ResizablePanel minSize={30}>
        <div class="demo-pane"><strong>Rest</strong></div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 48rem;
  }
  .demo h2 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  .demo-hint {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, inherit);
  }
  .demo :global(.demo-group) {
    block-size: 9rem;
  }
  .demo :global(.demo-tall) {
    block-size: 14rem;
  }
  .demo-pane {
    box-sizing: border-box;
    block-size: 100%;
    padding: 0.75rem 1rem;
    overflow: auto;
  }
  .demo-pane p {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--tx-muted-foreground, inherit);
  }
</style>
