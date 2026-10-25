<script lang="ts">
import { Badge } from 'texuli/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';

const columns = [
  {
    id: 'todo',
    title: 'To do',
    cards: [
      { id: 'a', title: 'Wire showcase e2e', tag: 'QA' },
      { id: 'b', title: 'Caption English track', tag: 'Media' },
    ],
  },
  {
    id: 'doing',
    title: 'In progress',
    cards: [{ id: 'c', title: 'Dashboard KPI row', tag: 'UI' }],
  },
  {
    id: 'done',
    title: 'Done',
    cards: [
      { id: 'd', title: 'Landing hero copy', tag: 'Design' },
      { id: 'e', title: 'Token no-flash bootstrap', tag: 'Core' },
    ],
  },
];
</script>

<section class="board" aria-label="Kanban board">
  {#each columns as col (col.id)}
    <section class="column" aria-labelledby={`col-${col.id}`}>
      <h2 id={`col-${col.id}`} class="column__title">
        {col.title}
        <Badge variant="secondary">{col.cards.length}</Badge>
      </h2>
      <ul class="column__list">
        {#each col.cards as card (card.id)}
          <li>
            <Card variant="elevated">
              <CardHeader>
                <CardTitle level={3}>{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline">{card.tag}</Badge>
              </CardContent>
            </Card>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</section>

<style>
  .board {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    align-items: start;
  }
  .column {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--tx-radius-lg, 0.5rem);
    background: var(--tx-muted, color-mix(in srgb, CanvasText 6%, Canvas));
    border: 1px solid var(--tx-border, ButtonBorder);
  }
  .column__title {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
  }
  .column__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.65rem;
  }
</style>
