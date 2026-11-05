<script lang="ts">
import { Image } from '@texuli/media/image';
import { scopedTheme } from '../scoped-theme.ts';
import logoDark from './logo-dark.svg?url&no-inline';
import logoLight from './logo-light.svg?url&no-inline';

/**
 * Theme-aware image pair: `srcDark` with the default `darkMode="theme"`
 * follows the page mode, and a scope that forces `data-tx-mode` wins over
 * the OS preference. `darkMode="system"` is one `<picture>` that follows the
 * OS only. The wordmarks are local fictional files (relative URLs pass the
 * default untrusted image policy).
 */
const alt = 'Harbor Studio wordmark';
</script>

<article class="demo" data-example="media-image-dark" aria-labelledby="media-image-dark-title">
  <h2 id="media-image-dark-title">Image, light and dark pair</h2>

  <section aria-labelledby="pair-page-title">
    <h3 id="pair-page-title">Follows the page theme</h3>
    <Image src={logoLight} srcDark={logoDark} {alt} width={480} height={160} loading="eager" />
  </section>

  <div class="scopes">
    <section class="scope" use:scopedTheme={'dark'} aria-labelledby="pair-dark-title">
      <h3 id="pair-dark-title">Forced dark scope</h3>
      <Image src={logoLight} srcDark={logoDark} {alt} width={480} height={160} loading="eager" />
    </section>
    <section class="scope" use:scopedTheme={'light'} aria-labelledby="pair-light-title">
      <h3 id="pair-light-title">Forced light scope</h3>
      <Image src={logoLight} srcDark={logoDark} {alt} width={480} height={160} loading="eager" />
    </section>
  </div>

  <section aria-labelledby="pair-system-title">
    <h3 id="pair-system-title">Follows the OS only (one download)</h3>
    <Image
      src={logoLight}
      srcDark={logoDark}
      darkMode="system"
      {alt}
      width={480}
      height={160}
      loading="eager"
    />
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: var(--tx-space-6);
    max-inline-size: 64rem;
    color: var(--tx-foreground, CanvasText);
  }
  h2,
  h3 {
    margin: 0 0 var(--tx-space-2);
  }
  h3 {
    font-size: var(--tx-type-label-size);
  }
  .scopes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: var(--tx-space-4);
  }
  .scope {
    background-color: var(--tx-background, Canvas);
    color: var(--tx-foreground, CanvasText);
    padding: var(--tx-space-3);
    border: var(--tx-border-width-thin) solid var(--tx-border, currentColor);
    border-radius: var(--tx-shape-radius-lg);
  }
</style>
