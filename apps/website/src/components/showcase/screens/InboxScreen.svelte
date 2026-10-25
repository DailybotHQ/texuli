<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
import { Input } from 'texuli/input';

const threads = [
  {
    id: '1',
    from: 'Grace Harbor',
    subject: 'Caption pass on ferry reel',
    preview: 'Can we lock English captions before Friday?',
    unread: true,
    tag: 'Media',
  },
  {
    id: '2',
    from: 'Linus Notes',
    subject: 'Landing hero copy',
    preview: 'Pushed a shorter tagline for review.',
    unread: true,
    tag: 'Design',
  },
  {
    id: '3',
    from: 'Ada Example',
    subject: 'Release checklist',
    preview: 'Docs and showcase pages are on the list.',
    unread: false,
    tag: 'Release',
  },
];
</script>

<section class="screen" aria-label="Inbox">
  <div class="toolbar">
    <Input type="search" placeholder="Search messages" aria-label="Search messages" />
    <Button type="button" size="sm">Compose</Button>
  </div>
  <div class="layout">
    <Card variant="flat" class="list-card">
      <CardHeader>
        <CardTitle level={2}>Messages</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="threads">
          {#each threads as t (t.id)}
            <li class:unread={t.unread}>
              <button type="button" class="thread">
                <span class="thread__from">{t.from}</span>
                <span class="thread__subject">{t.subject}</span>
                <span class="thread__preview">{t.preview}</span>
                <Badge variant="outline">{t.tag}</Badge>
              </button>
            </li>
          {/each}
        </ul>
      </CardContent>
    </Card>
    <Card variant="elevated" class="detail">
      <CardHeader>
        <CardTitle level={2}>Caption pass on ferry reel</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          Grace Harbor · Today · <Badge>Media</Badge>
        </p>
        <p>
          Can we lock English captions before Friday? The WebVTT draft is in the media studio demo —
          plain text only, no HTML sinks.
        </p>
        <div class="actions">
          <Button type="button" size="sm">Reply</Button>
          <Button type="button" variant="secondary" size="sm">Archive</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</section>

<style>
  .screen {
    display: grid;
    gap: 1rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }
  .toolbar :global(input) {
    flex: 1 1 12rem;
  }
  .layout {
    display: grid;
    gap: 1rem;
  }
  @media (min-width: 48rem) {
    .layout {
      grid-template-columns: minmax(14rem, 1fr) minmax(16rem, 1.4fr);
    }
  }
  .threads {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }
  .thread {
    display: grid;
    gap: 0.2rem;
    inline-size: 100%;
    text-align: start;
    padding: 0.65rem 0.5rem;
    border: 0;
    border-radius: var(--tx-radius, 0.375rem);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .thread:hover,
  .thread:focus-visible {
    background: color-mix(in srgb, var(--tx-foreground, CanvasText) 6%, transparent);
  }
  /* A 6% tint alone is not a visible focus indicator (WCAG 2.4.7): use the ring. */
  .thread:focus-visible {
    outline: var(--tx-focus-ring-width, 2px) solid var(--tx-ring, Highlight);
    outline-offset: -2px;
  }
  .unread .thread__subject {
    font-weight: 600;
  }
  .thread__from {
    font-size: 0.8rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .thread__preview {
    font-size: 0.85rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-block-start: 1rem;
  }
</style>
