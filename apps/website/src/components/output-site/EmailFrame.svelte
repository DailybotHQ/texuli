<script lang="ts">
/**
 * The rendered email in a frame with every sandbox restriction on
 * (`sandbox=""`: no scripts, no same origin, no forms, no popups, no top
 * navigation). The frame shows a static file the build wrote (the
 * package's escaped output); this island only decides when to mount it,
 * after a click, so the page itself stays a plain document until asked.
 */
let { src, title, tall = false }: { src: string; title: string; tall?: boolean } = $props();
let shown = $state(false);
</script>

<div class="email-frame" data-output-email-preview="">
  <button
    type="button"
    class="email-frame__button"
    aria-expanded={shown}
    onclick={() => {
      shown = !shown;
    }}>{shown ? 'Hide the rendered email' : 'Show the rendered email'}</button
  >
  {#if shown}
    <iframe
      class={tall ? 'email-frame__frame email-frame__frame--tall' : 'email-frame__frame'}
      {src}
      {title}
      sandbox=""
      referrerpolicy="no-referrer"
      data-output-email-frame=""></iframe>
  {/if}
</div>

<style>
  .email-frame {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  .email-frame__button {
    justify-self: start;
    min-block-size: 2.25rem;
    padding-inline: 0.8rem;
    border: 1px solid var(--tx-border, ButtonBorder);
    border-radius: 0.5rem;
    background: var(--tx-surface, ButtonFace);
    color: var(--tx-foreground, ButtonText);
    font: inherit;
    cursor: pointer;
  }
  .email-frame__button:focus-visible {
    outline: 2px solid var(--tx-ring, Highlight);
    outline-offset: 2px;
  }
  .email-frame__frame {
    inline-size: 100%;
    block-size: 18rem;
    border: 1px solid var(--tx-border, CanvasText);
    border-radius: 0.6rem;
  }
  .email-frame__frame--tall {
    block-size: 36rem;
  }
</style>
