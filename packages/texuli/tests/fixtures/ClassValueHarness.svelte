<script lang="ts">
/**
 * Compile-time + runtime harness: Svelte 5 `class` ClassValue shapes must typecheck
 * on styled roots (string, array with falsy entries, object map).
 */
import { Badge } from '../../src/components/badge/index.ts';
import { Button } from '../../src/components/button/index.ts';
import { Card, CardContent } from '../../src/components/card/index.ts';
import { Input } from '../../src/components/input/index.ts';

let full = $state(true);
let quiet = $state(false);
</script>

<section data-tx-classvalue-harness aria-label="ClassValue harness">
  <Button
    data-testid="cv-button-string"
    class="cv-string"
  >
    String
  </Button>

  <Button
    data-testid="cv-button-array"
    class={[full && 'cv-full', quiet && 'cv-quiet', 'cv-array']}
  >
    Array
  </Button>

  <Button
    data-testid="cv-button-object"
    class={{ 'cv-object': true, 'cv-off': false }}
  >
    Object
  </Button>

  <Badge data-testid="cv-badge" class={['cv-badge', full && 'cv-full']} variant="secondary">
    Badge
  </Badge>

  <Card data-testid="cv-card" class={{ 'cv-card': true }}>
    <CardContent>
      <Input data-testid="cv-input" class={['cv-input', quiet && 'cv-quiet']} value="harbor" />
    </CardContent>
  </Card>
</section>
