<script lang="ts">
/** Static server-rendered reader view of the same fixture used by the island. */
import { PageReaderCore } from '@texuli/pages/reader-core';
import { PRODUCT_REPORT } from './fixtures/product-report.ts';

/**
 * The preview never hydrates, so a lazy block (the metrics) would say "Loading the embed"
 * forever. Name where it renders instead.
 */
const labels = { embedLoading: 'The metrics block renders in the interactive demo.' };
</script>

<div class="documents-preview" data-tx-documents-demo-preview="product-report">
  <PageReaderCore
    document={PRODUCT_REPORT}
    anchorPrefix="documents-demo-preview"
    reducedMotion={true}
    {labels}
  />
</div>

<style>
  .documents-preview {
    min-inline-size: 0;
    max-inline-size: 100%;
    overflow-wrap: anywhere;
  }
</style>
