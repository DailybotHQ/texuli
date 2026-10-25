<script lang="ts">
type Props = {
  code: string;
};

let { code }: Props = $props();
const uid = $props.id();
const titleId = `tx-code-${uid}`;
</script>

<div class="code" data-tx-code-sample>
  <h3 class="code__title" id={titleId}>Code</h3>
  <!--
    tabindex only (no role=region): keeps overflowing samples keyboard-scrollable
    without adding duplicate landmarks when several demos share the title "Code".
  -->
  <pre class="code__pre" tabindex="0" aria-labelledby={titleId}><code>{code}</code></pre>
</div>

<style>
  .code {
    display: grid;
    gap: 0.35rem;
  }
  .code__title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--tx-foreground, CanvasText);
  }
  .code__pre {
    margin: 0;
    padding: 0.85rem 1rem;
    overflow: auto;
    border-radius: var(--tx-radius, 0.5rem);
    border: 1px solid var(--tx-border, ButtonBorder);
    background: var(--tx-surface, Canvas);
    color: var(--tx-foreground, CanvasText);
    font-size: 0.8rem;
    line-height: 1.45;
  }
  .code__pre:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
</style>
