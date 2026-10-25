<script lang="ts">
import { TIMELINE_TONES, Timeline, TimelineItem, type TimelineItemData } from 'texuli/timeline';

const project: TimelineItemData[] = [
  {
    id: 'kickoff',
    time: 'Mar 4',
    datetime: '2026-03-04',
    title: 'Kickoff',
    description: 'Scope and owners agreed with the fictional Orbit team.',
    status: 'complete',
    tone: 'success',
  },
  {
    id: 'review',
    time: 'Mar 18',
    datetime: '2026-03-18',
    title: 'Design review',
    description: 'Walkthrough of the onboarding flow.',
    status: 'current',
  },
  {
    id: 'beta',
    time: 'Apr 1',
    datetime: '2026-04-01',
    title: 'Private beta',
    href: 'https://example.com/beta',
    status: 'upcoming',
    tone: 'info',
  },
];

const roadmap: TimelineItemData[] = [
  { id: 'q1', time: 'Q1', title: 'Research', status: 'complete' },
  { id: 'q2', time: 'Q2', title: 'Prototype', status: 'complete' },
  { id: 'q3', time: 'Q3', title: 'Pilot', status: 'current', tone: 'warning' },
  { id: 'q4', time: 'Q4', title: 'General availability', status: 'upcoming' },
];

const tones: TimelineItemData[] = TIMELINE_TONES.map((tone) => ({
  id: tone,
  title: `Tone: ${tone}`,
  tone,
}));

const links: TimelineItemData[] = [
  { id: 'docs', title: 'Release notes', href: 'https://example.com/notes', time: 'Today' },
  // The URL policy rejects this one: it renders as plain text.
  { id: 'blocked', title: 'Blocked link', href: 'javascript:alert(1)', time: 'Today' },
];

const rtl: TimelineItemData[] = [
  { id: 'a', time: '٤ مارس', title: 'البداية', status: 'complete' },
  { id: 'b', time: '١٨ مارس', title: 'المراجعة', status: 'current' },
  { id: 'c', time: '١ أبريل', title: 'الإطلاق', status: 'upcoming' },
];
</script>

<section data-example="texuli-timeline" aria-labelledby="timeline-demo-title">
  <h2 id="timeline-demo-title">Timeline</h2>

  <h3>Vertical, with every status</h3>
  <Timeline items={project} label="Project milestones" />

  <h3>Horizontal</h3>
  <Timeline items={roadmap} orientation="horizontal" label="Roadmap" />

  <h3>Every tone</h3>
  <Timeline items={tones} orientation="horizontal" label="Tones" />

  <h3>Links through the URL policy</h3>
  <Timeline items={links} label="Links" />

  <h3>Composed items</h3>
  <Timeline label="Incident">
    <TimelineItem title="Alert fired" time="09:12" tone="destructive" status="complete">
      {#snippet icon()}<svg viewBox="0 0 12 12" width="10" height="10" focusable="false"><path d="M6 2v5M6 9.5v.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" /></svg>{/snippet}
      <p class="note">Paged the fictional on-call engineer.</p>
    </TimelineItem>
    <TimelineItem title="Mitigated" time="09:40" tone="success" status="current" />
  </Timeline>

  <h3>Right to left</h3>
  <div class="stack" dir="rtl" lang="ar">
    <Timeline items={rtl} label="الجدول الزمني" messages={{ complete: 'مكتمل', current: 'حالي', upcoming: 'قادم' }} />
    <Timeline items={rtl} orientation="horizontal" label="الجدول الزمني الأفقي" messages={{ complete: 'مكتمل', current: 'حالي', upcoming: 'قادم' }} />
  </div>

  <h3>Dark</h3>
  <div class="dark-panel" data-tx-mode="dark">
    <Timeline items={project} label="Project milestones (dark)" />
  </div>
</section>

<style>
  /* The example paints its own surface, so contrast is checked against what users see. */
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    max-inline-size: 48rem;
    background: Canvas;
    color: CanvasText;
  }

  .stack {
    display: grid;
    gap: 1.5rem;
  }

  .note {
    margin: 0;
    font-size: 0.875rem;
  }

  .dark-panel {
    color-scheme: dark;
    padding: 1rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: Canvas;
    color: CanvasText;
    /* Keep token-driven children on the dark panel surface. */
    --tx-foreground: CanvasText;
    --tx-background: Canvas;
    --tx-muted-foreground: CanvasText;
    --tx-border: GrayText;
    --tx-link: LinkText;
    --tx-ring: Highlight;
  }
</style>
