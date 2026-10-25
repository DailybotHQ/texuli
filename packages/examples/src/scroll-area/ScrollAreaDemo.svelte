<script lang="ts">
import { ScrollArea } from 'texuli/scroll-area';

const messages = [
  'Mina shared the launch checklist.',
  'Rafi added notes to the weekly review.',
  'Noor moved the roadmap discussion.',
  'Ari posted the updated project brief.',
  'Samira added a note for the design team.',
  'The release review is ready for feedback.',
  'The next planning session starts Monday.',
];
</script>

<div class="demo" data-example="texuli-scroll-area">
  <section>
    <h2>Default</h2>
    <ScrollArea label="Recent activity">
      <ul>{#each messages as message}<li>{message}</li>{/each}</ul>
    </ScrollArea>
  </section>

  <section>
    <h2>Sizes and visibility</h2>
    <div class="row">
      <ScrollArea label="Compact updates" size="sm" type="always">
        <ul>{#each messages as message}<li>{message}</li>{/each}</ul>
      </ScrollArea>
      <ScrollArea label="Large updates" size="lg" type="scroll">
        <ul>{#each messages as message}<li>{message}</li>{/each}</ul>
      </ScrollArea>
      <ScrollArea label="Hover updates" size="md" type="hover">
        <ul>{#each messages as message}<li>{message}</li>{/each}</ul>
      </ScrollArea>
    </div>
  </section>

  <section>
    <h2>No overflow</h2>
    <ScrollArea label="Short activity list" type="auto">
      <ul>
        <li>One recent update.</li>
        <li>One upcoming review.</li>
      </ul>
    </ScrollArea>
  </section>

  <section dir="rtl" lang="ar">
    <h2>اتجاه من اليمين إلى اليسار</h2>
    <ScrollArea label="الرسائل الأخيرة" dir="rtl" type="always">
      <ul>
        <li>أضافت مينا قائمة الإطلاق.</li>
        <li>شارك رافي ملاحظات الاجتماع.</li>
        <li>أرسلت نور تحديث المشروع.</li>
        <li>أضافت سميرة ملاحظة للفريق.</li>
        <li>المراجعة جاهزة للتعليقات.</li>
      </ul>
    </ScrollArea>
  </section>

  <section data-tx-mode="dark" class="dark">
    <h2>Dark surface</h2>
    <ScrollArea label="Dark activity" size="sm" type="always">
      <ul>{#each messages.slice(0, 5) as message}<li>{message}</li>{/each}</ul>
    </ScrollArea>
  </section>
</div>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 40rem;
    padding: 1rem;
    color: var(--tx-foreground, CanvasText);
    background: var(--tx-background, Canvas);
    font-family: var(--tx-font-sans, system-ui, sans-serif);
  }

  section {
    display: grid;
    gap: 0.5rem;
  }

  h2 {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 600;
  }

  ul {
    display: grid;
    gap: 0.65rem;
    margin: 0;
    padding-inline-start: 1.25rem;
  }

  li {
    line-height: 1.4;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 0.75rem;
  }

  .dark {
    padding: 0.75rem;
    border-radius: var(--tx-radius-lg, 0.75rem);
    color: var(--tx-foreground, #f4f4f5);
    background: var(--tx-background, #17191f);
  }

  @media (max-width: 34rem) {
    .row {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
