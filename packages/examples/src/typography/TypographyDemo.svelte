<script lang="ts">
import { Box, Heading, Prose, Text } from 'texuli/typography';
</script>

<section data-example="texuli-typography" aria-labelledby="tx-typography-title">
  <Box as="header" radius="none" border="block-end" surface="default" padding="md">
    <Text size="xs" tone="muted" transform="uppercase" tracking="wide">Example Co. workspace</Text>
    <Heading level={1} size="xl" id="tx-typography-title">Quarterly report</Heading>
  </Box>

  <div class="grid">
    <Box padding="lg" border="default" surface="default" radius="lg">
      <Text size="xs" tone="muted" transform="uppercase" tracking="wide">Revenue</Text>
      <Text size="figure" tabular weight="semibold">$1,284,300</Text>
      <Text size="sm" tone="success">Up 12% on the last quarter</Text>
    </Box>
    <Box padding="lg" border="default" surface="default" radius="lg">
      <Text size="xs" tone="muted" transform="uppercase" tracking="wide">Active teams</Text>
      <Text size="figure" tabular weight="semibold">318</Text>
      <Text size="sm" tone="muted">Updated an hour ago</Text>
    </Box>
    <Box padding="lg" surface="muted" radius="lg">
      <Heading level={2} size="sm">Next review</Heading>
      <Text size="sm">Monday, with the design reviewers.</Text>
      <Text as="small" size="xs" tone="subtle">Fictional dates and figures.</Text>
    </Box>
  </div>

  <Heading level={2} size="lg">Summary</Heading>
  <Prose as="article">
    <p>Example Co. closed the quarter ahead of plan. The new onboarding cut the time to a first report in half.</p>
    <h3>What changed</h3>
    <ul>
      <li>Reports load from a cached query.</li>
      <li>Teams share dashboards with read-only links.</li>
    </ul>
    <blockquote>Keep the next release small and reviewable.</blockquote>
  </Prose>

  <Heading level={2} size="md" tone="muted">Text tones</Heading>
  <div class="tones">
    <Text tone="primary">Primary ink</Text>
    <Text tone="success">Success: saved</Text>
    <Text tone="warning">Warning: expires soon</Text>
    <Text tone="destructive">Error: not saved</Text>
    <Text tone="info">Info: read only</Text>
    <Text lineClamp={2} size="sm" tone="muted">
      A long description clamped to two lines so a card keeps its height while the full text stays in the
      document for assistive technology and for copy, with an ellipsis where it is cut.
    </Text>
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 1rem;
  }
  .tones {
    display: grid;
    gap: 0.25rem;
  }
</style>
