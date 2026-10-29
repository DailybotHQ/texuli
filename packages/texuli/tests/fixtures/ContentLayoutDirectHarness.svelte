<script lang="ts">
import { ContentLayout, type TocEntry, type TocLevel } from '../../src/layouts/content/index.ts';
import type { LayoutOptions } from '../../src/layouts/host/contract.ts';

let {
  toc,
  tocLevels,
  preserveHeadingIds,
  options,
  mountScreen,
}: {
  toc?: readonly TocEntry[];
  tocLevels?: readonly TocLevel[];
  preserveHeadingIds?: boolean;
  options?: LayoutOptions;
  mountScreen?: (target: HTMLElement) => void;
} = $props();
</script>

<ContentLayout
  kind="docs"
  {toc}
  {tocLevels}
  {preserveHeadingIds}
  {options}
  {mountScreen}
>
  <h2 id="intro">Introduction</h2>
  <p>Start here.</p>
  <h2>Untitled section</h2>
  <h3 id="setup">Setup</h3>
  <div class="callout">
    <h3 id="callout-note">Callout note</h3>
  </div>
  <h4 id="deep-detail">Deep detail</h4>
  <h2 id="intro">Introduction again</h2>
</ContentLayout>
