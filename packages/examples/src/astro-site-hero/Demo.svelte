<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';

const storyHref = safeHref('https://example.com/stories', 'developer');
</script>

<article class="demo" data-example="astro-site-hero" aria-labelledby="astro-site-hero-title">
  <header class="intro">
    <p class="eyebrow">ASTRO · STATIC CONTENT</p>
    <h2 id="astro-site-hero-title">Astro content site hero</h2>
    <p class="summary">
      A static first impression with Texuli sections and theme tokens, ready for a content site.
    </p>
  </header>

  <div class="previews" aria-label="Theme previews">
    <section class="site" data-tx-mode="light" aria-label="Light theme preview">
      <div class="site-header">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span class="brand">Fieldnotes</span>
        <span class="site-nav">Stories&nbsp;&nbsp; About</span>
      </div>
      <main>
        <section class="hero" aria-labelledby="light-hero-title">
          <p class="hero-eyebrow">A little more room to think</p>
          <h3 id="light-hero-title">Make space for your best work.</h3>
          <p class="hero-copy">
            Fieldnotes brings thoughtful teams together around clear plans, useful rituals and work
            worth sharing.
          </p>
          {#if storyHref}
            <a class="cta" href={storyHref}>Explore the journal <span aria-hidden="true">↗</span></a>
          {/if}
        </section>
        <section class="features" aria-labelledby="light-features-title">
          <p class="section-kicker">BUILT FOR THE EVERYDAY</p>
          <h4 id="light-features-title">Small habits. Better work.</h4>
          <div class="feature-grid">
            <div class="feature"><span class="feature-number">01</span><span>Gather ideas as they arrive.</span></div>
            <div class="feature"><span class="feature-number">02</span><span>Give every project a clear next step.</span></div>
            <div class="feature"><span class="feature-number">03</span><span>Celebrate the thoughtful details.</span></div>
          </div>
        </section>
      </main>
      <footer>Made for teams who care about the work.</footer>
    </section>

    <section class="site" data-tx-mode="dark" aria-label="Dark theme preview">
      <div class="site-header">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span class="brand">Fieldnotes</span>
        <span class="site-nav">Stories&nbsp;&nbsp; About</span>
      </div>
      <main>
        <section class="hero" aria-labelledby="dark-hero-title">
          <p class="hero-eyebrow">A little more room to think</p>
          <h3 id="dark-hero-title">Make space for your best work.</h3>
          <p class="hero-copy">
            Fieldnotes brings thoughtful teams together around clear plans, useful rituals and work
            worth sharing.
          </p>
          {#if storyHref}
            <a class="cta" href={storyHref}>Explore the journal <span aria-hidden="true">↗</span></a>
          {/if}
        </section>
        <section class="features" aria-labelledby="dark-features-title">
          <p class="section-kicker">BUILT FOR THE EVERYDAY</p>
          <h4 id="dark-features-title">Small habits. Better work.</h4>
          <div class="feature-grid">
            <div class="feature"><span class="feature-number">01</span><span>Gather ideas as they arrive.</span></div>
            <div class="feature"><span class="feature-number">02</span><span>Give every project a clear next step.</span></div>
            <div class="feature"><span class="feature-number">03</span><span>Celebrate the thoughtful details.</span></div>
          </div>
        </section>
      </main>
      <footer>Made for teams who care about the work.</footer>
    </section>
  </div>
</article>

<style>
  .demo { display: grid; gap: clamp(1rem, 3vw, 1.5rem); padding: clamp(0.75rem, 2vw, 1rem); color: var(--tx-foreground, CanvasText); }
  .intro { display: grid; justify-items: start; gap: 0.5rem; max-inline-size: 58rem; }
  .intro h2, .intro p { margin: 0; }
  .eyebrow, .section-kicker { color: var(--tx-muted-foreground, GrayText); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.11em; }
  .intro h2 { font-size: clamp(1.45rem, 3vw, 2rem); line-height: 1.15; }
  .summary { max-inline-size: 62ch; color: var(--tx-muted-foreground, GrayText); line-height: 1.55; }
  .previews { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr)); gap: clamp(0.75rem, 2vw, 1rem); align-items: start; }
  .site { display: grid; overflow: clip; border: 1px solid var(--tx-border, color-mix(in srgb, CanvasText 18%, transparent)); border-radius: 1rem; background: var(--tx-background, Canvas); color: var(--tx-foreground, CanvasText); }
  .site[data-tx-mode='light'] { --tx-background: #fbfaf7; --tx-foreground: #23302b; --tx-muted-foreground: #68736c; --tx-border: #dce2dd; --tx-primary: #315c50; --tx-primary-foreground: #fff; --tx-muted: #edf1ed; --site-accent: var(--tx-primary); color-scheme: light; }
  .site[data-tx-mode='dark'] { --tx-background: #121816; --tx-foreground: #eef3ee; --tx-muted-foreground: #a6b1a9; --tx-border: #37433c; --tx-primary: #91b8a4; --tx-primary-foreground: #142119; --tx-muted: #202a24; --site-accent: var(--tx-primary); color-scheme: dark; }
  .site-header { display: flex; align-items: center; gap: 0.6rem; min-block-size: 3.75rem; padding-inline: clamp(0.875rem, 3vw, 1.5rem); border-block-end: 1px solid var(--tx-border, color-mix(in srgb, CanvasText 14%, transparent)); }
  .brand-mark { display: grid; place-items: center; inline-size: 1.8rem; aspect-ratio: 1; border-radius: 0.6rem; background: var(--site-accent); color: var(--tx-primary-foreground, white); font-family: Georgia, serif; font-weight: 700; }
  .brand { font-family: Georgia, serif; font-size: 1rem; font-weight: 700; letter-spacing: -0.025em; }
  .site-nav { margin-inline-start: auto; color: var(--tx-muted-foreground, GrayText); font-size: 0.75rem; }
  .site main { display: grid; }
  .hero { display: grid; justify-items: center; gap: 0.85rem; padding: clamp(2rem, 7vw, 3.5rem) clamp(1rem, 5vw, 2rem) clamp(2.25rem, 6vw, 3rem); text-align: center; background: radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--site-accent) 13%, transparent), transparent 70%); }
  .hero h3, .hero p { margin: 0; }
  .hero-eyebrow { color: var(--site-accent); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.04em; }
  .hero h3 { max-inline-size: 13ch; font-family: Georgia, serif; font-size: clamp(2rem, 5.5vw, 3.1rem); font-weight: 500; letter-spacing: -0.045em; line-height: 1.02; text-wrap: balance; }
  .hero-copy { max-inline-size: 43ch; color: var(--tx-muted-foreground, GrayText); font-size: 0.9rem; line-height: 1.6; }
  .cta { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; min-block-size: 2.75rem; margin-block-start: 0.35rem; border-radius: 999px; padding-inline: 1.1rem; background: var(--site-accent); color: var(--tx-primary-foreground, white); font-size: 0.82rem; font-weight: 650; text-decoration: none; }
  .cta:focus-visible { outline: 2px solid var(--tx-ring, Highlight); outline-offset: 3px; }
  .features { display: grid; gap: 0.65rem; padding: clamp(1.25rem, 4vw, 2rem); border-block-start: 1px solid var(--tx-border, color-mix(in srgb, CanvasText 14%, transparent)); }
  .features h4, .features p { margin: 0; }
  .features h4 { font-family: Georgia, serif; font-size: clamp(1.25rem, 3vw, 1.65rem); font-weight: 500; letter-spacing: -0.025em; }
  .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9rem), 1fr)); gap: 0.55rem; margin-block-start: 0.35rem; }
  .feature { display: grid; align-content: start; gap: 0.5rem; min-block-size: 5.5rem; border: 1px solid var(--tx-border, color-mix(in srgb, CanvasText 12%, transparent)); border-radius: 0.75rem; padding: 0.75rem; font-size: 0.78rem; line-height: 1.4; }
  .feature-number { color: var(--site-accent); font-size: 0.7rem; font-weight: 700; }
  .site footer { padding: 0.85rem clamp(1rem, 4vw, 1.5rem); border-block-start: 1px solid var(--tx-border, color-mix(in srgb, CanvasText 14%, transparent)); color: var(--tx-muted-foreground, GrayText); font-size: 0.72rem; }
  @media (max-width: 24rem) { .site-nav { font-size: 0.68rem; } .site-header { gap: 0.45rem; } .hero { padding-inline: 0.9rem; } }
  @media (forced-colors: active) { .site, .feature { border-color: CanvasText; } .brand-mark, .cta { border: 1px solid ButtonText; } }
</style>
