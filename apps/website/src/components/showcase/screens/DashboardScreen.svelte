<script lang="ts">
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'texuli/card';
import { Kpi, KpiRow } from 'texuli/stat';
</script>

<section class="screen" aria-label="Dashboard widgets">
  <div class="screen__toolbar">
    <h2 class="screen__h">Harbor Notes overview</h2>
    <Button type="button" variant="secondary" size="sm">Export CSV</Button>
  </div>

  <KpiRow label="Key metrics">
    <Kpi label="Active notes" value={1284} unit="count" previous={1146} />
    <Kpi label="Open tasks" value={47} unit="count" previous={49} positive="down" />
    <Kpi label="Response time" value={2.4} unit="hours" previous={2.9} positive="down" />
    <Kpi label="CSAT" value={96} unit="percent" previous={94} />
  </KpiRow>

  <div class="grid">
    <Card variant="elevated" class="span-2">
      <CardHeader>
        <CardTitle level={3}>Weekly activity</CardTitle>
        <CardDescription>Notes created vs resolved (fictional)</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="bars" role="img" aria-label="Bar chart: activity rising through the week">
          {#each [40, 55, 48, 70, 62, 80, 90] as h, i (i)}
            <div class="bars__col">
              <div class="bars__fill" style:block-size={`${h}%`}></div>
              <span class="bars__label">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
            </div>
          {/each}
        </div>
      </CardContent>
    </Card>
    <Card variant="flat">
      <CardHeader>
        <CardTitle level={3}>Top tags</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="list">
          <li><Badge>design</Badge> 214 notes</li>
          <li><Badge variant="secondary">docs</Badge> 162 notes</li>
          <li><Badge variant="outline">release</Badge> 98 notes</li>
        </ul>
      </CardContent>
    </Card>
    <Card variant="flat" class="span-2">
      <CardHeader>
        <CardTitle level={3}>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        <table class="table">
          <caption class="sr-only">Recent Harbor Notes activity</caption>
          <thead>
            <tr>
              <th scope="col">Event</th>
              <th scope="col">Owner</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Note “Ferry schedule” published</td>
              <td>Ada Example</td>
              <td>2h ago</td>
            </tr>
            <tr>
              <td>Task “Caption pass” completed</td>
              <td>Grace Harbor</td>
              <td>5h ago</td>
            </tr>
            <tr>
              <td>Comment on “Landing hero”</td>
              <td>Linus Notes</td>
              <td>Yesterday</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  </div>
</section>

<style>
  .screen {
    display: grid;
    gap: 1.25rem;
  }
  .screen__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .screen__h {
    margin: 0;
    font-size: 1.125rem;
  }
  .grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  }
  .grid :global(.span-2) {
    grid-column: 1 / -1;
  }
  @media (min-width: 48rem) {
    .grid :global(.span-2) {
      grid-column: span 2;
    }
  }
  .bars {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    block-size: 10rem;
    padding-block-start: 0.5rem;
  }
  .bars__col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    block-size: 100%;
    justify-content: flex-end;
  }
  .bars__fill {
    inline-size: 100%;
    max-inline-size: 2rem;
    border-radius: var(--tx-radius, 0.25rem) var(--tx-radius, 0.25rem) 0 0;
    background: var(--tx-primary, Highlight);
  }
  .bars__label {
    font-size: 0.75rem;
    color: var(--tx-muted-foreground, GrayText);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.65rem;
  }
  .table {
    inline-size: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }
  th,
  td {
    text-align: start;
    padding: 0.5rem 0.35rem;
    border-block-end: 1px solid var(--tx-border, ButtonBorder);
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
