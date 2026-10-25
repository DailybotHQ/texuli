<script lang="ts">
import { safeHref } from '@texuli/core/url-policy';

const changelogHref = safeHref('https://example.com/changelog', 'developer');
</script>

<article class="demo" data-example="astro-site-doc" aria-labelledby="astro-site-doc-title">
  <header class="intro">
    <p class="eyebrow">ASTRO · STATIC CONTENT</p>
    <h2 id="astro-site-doc-title">Astro content site doc</h2>
    <p class="summary">
      A documentation page shell over the content layout: compact hero, reading-width prose and a
      surface strip, with light and dark token themes.
    </p>
  </header>

  <div class="previews" aria-label="Theme previews">
    <section class="site" data-tx-mode="light" aria-label="Light theme preview">
      <div class="site-header">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span class="brand">Fieldnotes</span>
        <span class="site-nav">Handbook&nbsp;&nbsp; <a href={changelogHref}>Changelog</a></span>
      </div>
      <main>
        <section class="doc-hero" aria-labelledby="light-doc-title">
          <p class="doc-kicker">HANDBOOK</p>
          <h3 id="light-doc-title">Plan the week, keep the notes.</h3>
          <p class="doc-lede">
            How Fieldnotes teams structure a weekly handbook: one page per ritual, one owner per
            page, and a changelog that tells the story.
          </p>
        </section>
        <section class="doc-prose" aria-labelledby="light-doc-start-title">
          <h4 id="light-doc-start-title">Getting started</h4>
          <p>
            Start from the weekly template, then delete what the team does not use. A handbook that
            fits on one screen is a handbook that gets read.
          </p>
          <ul>
            <li>One page per ritual, named after the day it happens.</li>
            <li>One owner per page, recorded at the top.</li>
            <li>Every change lands in the changelog, newest first.</li>
          </ul>
        </section>
        <section class="doc-surface" aria-labelledby="light-doc-keep-title">
          <h4 id="light-doc-keep-title">Keep it honest</h4>
          <p>
            When a ritual stops happening, mark it paused instead of deleting the page. The
            handbook is a record, not a wish list.
          </p>
        </section>
      </main>
      <footer>Fieldnotes handbook · updated weekly</footer>
    </section>

    <section class="site" data-tx-mode="dark" aria-label="Dark theme preview">
      <div class="site-header">
        <span class="brand-mark" aria-hidden="true">F</span>
        <span class="brand">Fieldnotes</span>
        <span class="site-nav">Handbook&nbsp;&nbsp; <a href={changelogHref}>Changelog</a></span>
      </div>
      <main>
        <section class="doc-hero" aria-labelledby="dark-doc-title">
          <p class="doc-kicker">HANDBOOK</p>
          <h3 id="dark-doc-title">Plan the week, keep the notes.</h3>
          <p class="doc-lede">
            How Fieldnotes teams structure a weekly handbook: one page per ritual, one owner per
            page, and a changelog that tells the story.
          </p>
        </section>
        <section class="doc-prose" aria-labelledby="dark-doc-start-title">
          <h4 id="dark-doc-start-title">Getting started</h4>
          <p>
            Start from the weekly template, then delete what the team does not use. A handbook that
            fits on one screen is a handbook that gets read.
          </p>
          <ul>
            <li>One page per ritual, named after the day it happens.</li>
            <li>One owner per page, recorded at the top.</li>
            <li>Every change lands in the changelog, newest first.</li>
          </ul>
        </section>
        <section class="doc-surface" aria-labelledby="dark-doc-keep-title">
          <h4 id="dark-doc-keep-title">Keep it honest</h4>
          <p>
            When a ritual stops happening, mark it paused instead of deleting the page. The
            handbook is a record, not a wish list.
          </p>
        </section>
      </main>
      <footer>Fieldnotes handbook · updated weekly</footer>
    </section>
  </div>
</article>

<style>
  /* Page-frame tokens per theme, mirroring what ContentLayout sets on <html>. */
  .site[data-tx-mode='light'] {
    --tx-background: #fbfaf7;
    --tx-foreground: #23302b;
    --tx-muted-foreground: #68736c;
    --tx-border: #dce2dd;
    --tx-primary: #315c50;
    --tx-surface: #ffffff;
    --site-accent: var(--tx-primary);
    color-scheme: light;
  }
  .site[data-tx-mode='dark'] {
    --tx-background: #121816;
    --tx-foreground: #eef3ee;
    --tx-muted-foreground: #a6b1a9;
    --tx-border: #37433c;
    --tx-primary: #91b8a4;
    --tx-surface: #1a211d;
    --site-accent: var(--tx-primary);
    color-scheme: dark;
  }

  .demo {
    display: grid;
    gap: clamp(1rem, 3vw, 1.5rem);
    padding: clamp(0.75rem, 2vw, 1rem);
    color: var(--tx-foreground, CanvasText);
  }
  .intro {
    display: grid;
    justify-items: start;
    gap: 0.5rem;
    max-inline-size: 58rem;
  }
  .intro h2,
  .intro p {
    margin: 0;
  }
  .eyebrow,
  .doc-kicker {
    color: var(--tx-muted-foreground, GrayText);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.11em;
  }
  .doc-kicker {
    color: var(--site-accent);
  }
  .intro h2 {
    font-size: clamp(1.45rem, 3vw, 2rem);
    line-height: 1.15;
  }
  .summary {
    max-inline-size: 62ch;
    color: var(--tx-muted-foreground, GrayText);
    line-height: 1.55;
  }
  .previews {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
    gap: clamp(0.75rem, 2vw, 1rem);
    align-items: start;
  }
  .site {
    display: grid;
    overflow: clip;
    border: 1px solid var(--tx-border);
    border-radius: 1rem;
    background: var(--tx-background);
    color: var(--tx-foreground);
  }
  .site-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-block-size: 3.75rem;
    padding-inline: clamp(0.875rem, 3vw, 1.5rem);
    border-block-end: 1px solid var(--tx-border);
  }
  .brand-mark {
    display: grid;
    place-items: center;
    inline-size: 1.8rem;
    aspect-ratio: 1;
    border-radius: 0.6rem;
    background: var(--site-accent);
    color: #fff;
    font-family: Georgia, serif;
    font-weight: 700;
  }
  .site[data-tx-mode='dark'] .brand-mark {
    color: #142119;
  }
  .brand {
    font-family: Georgia, serif;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.025em;
  }
  .site-nav {
    margin-inline-start: auto;
    color: var(--tx-muted-foreground);
    font-size: 0.75rem;
  }
  .site-nav a {
    color: inherit;
    text-underline-offset: 0.2em;
  }
  .site main {
    display: grid;
  }

  /* Compact hero, as `tx-astro-hero--compact` ships it. */
  .doc-hero {
    display: grid;
    gap: 0.75rem;
    padding: clamp(1.5rem, 5vw, 3rem) clamp(1rem, 4vw, 2rem);
  }
  .doc-hero h3,
  .doc-hero p {
    margin: 0;
  }
  .doc-hero h3 {
    font-family: Georgia, serif;
    font-size: clamp(1.75rem, 4.5vw, 2.75rem);
    font-weight: 500;
    letter-spacing: -0.035em;
    line-height: 1.05;
    max-inline-size: 18ch;
    text-wrap: balance;
  }
  .doc-lede {
    color: var(--tx-muted-foreground);
    font-size: 1rem;
    line-height: 1.6;
    max-inline-size: 55ch;
  }

  /* Reading-width prose, as `tx-astro-section--reading` frames it. */
  .doc-prose {
    display: grid;
    gap: 0.75rem;
    margin-inline: auto;
    inline-size: 100%;
    max-inline-size: 44rem;
    padding: clamp(1.25rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem);
  }
  .doc-prose h4,
  .doc-prose p,
  .doc-prose li {
    margin: 0;
  }
  .doc-prose h4 {
    font-family: Georgia, serif;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .doc-prose p,
  .doc-prose li {
    color: var(--tx-muted-foreground);
    font-size: 0.88rem;
    line-height: 1.6;
  }
  .doc-prose ul {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding-inline-start: 1.1rem;
  }

  /* Surface tone, as `tx-astro-section--surface` paints it. */
  .doc-surface {
    display: grid;
    gap: 0.6rem;
    margin-inline: auto;
    inline-size: 100%;
    max-inline-size: 44rem;
    background: var(--tx-surface);
    padding: clamp(1.25rem, 4vw, 2rem) clamp(1rem, 4vw, 2rem);
    border-block-start: 1px solid var(--tx-border);
  }
  .doc-surface h4 {
    margin: 0;
    font-family: Georgia, serif;
    font-size: 1.25rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }
  .doc-surface p {
    margin: 0;
    color: var(--tx-muted-foreground);
    font-size: 0.88rem;
    line-height: 1.6;
  }
  .site footer {
    padding: 0.85rem clamp(1rem, 4vw, 1.5rem);
    border-block-start: 1px solid var(--tx-border);
    color: var(--tx-muted-foreground);
    font-size: 0.72rem;
  }
  @media (max-width: 24rem) {
    .site-nav {
      font-size: 0.68rem;
    }
    .site-header {
      gap: 0.45rem;
    }
  }
  @media (forced-colors: active) {
    .site,
    .doc-surface {
      border-color: CanvasText;
    }
    .brand-mark {
      border: 1px solid ButtonText;
    }
  }
</style>
