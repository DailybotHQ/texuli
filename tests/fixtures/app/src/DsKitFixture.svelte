<script lang="ts">
/**
 * The design-system kit fixture (tests/e2e/ds-kit.spec.ts): `DesignSystemKit` with every
 * section, one library preview built from allowed texuli components, and a bindable mode view.
 */
import { Badge } from 'texuli/badge';
import { Button } from 'texuli/button';
import { Card } from 'texuli/card';
import {
  DesignSystemKit,
  type DesignSystemKitProps,
  type KitLibraryEntry,
  type KitMode,
} from 'texuli/ds-kit';

type Props = Pick<
  DesignSystemKitProps,
  'document' | 'compiled' | 'allow' | 'catalog' | 'previous' | 'modeView'
>;

let { modeView = $bindable('both'), ...rest }: Props = $props();
</script>

{#snippet pricingCard(ctx: { id: string; entry: KitLibraryEntry; variant?: string; mode: KitMode })}
  <Card data-library-preview={ctx.id} data-library-mode={ctx.mode}>
    <p>{ctx.entry.name}: <Badge label="Popular" /></p>
    <p>$12 per seat</p>
    <Button variant="default" size="sm">Choose {ctx.mode} plan</Button>
  </Card>
{/snippet}

<DesignSystemKit {...rest} bind:modeView library={{ 'pricing-card': pricingCard }} />
