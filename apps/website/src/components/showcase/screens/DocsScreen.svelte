<script lang="ts">
import { Badge } from 'texuli/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'texuli/card';
</script>

<section class="docs" aria-label="Documentation page">
  <aside class="toc" aria-label="On this page">
    <Card variant="flat">
      <CardHeader>
        <CardTitle level={2}>On this page</CardTitle>
      </CardHeader>
      <CardContent>
        <nav>
          <ol>
            <li><a href="#overview">Overview</a></li>
            <li><a href="#install">Install</a></li>
            <li><a href="#a11y">Accessibility</a></li>
          </ol>
        </nav>
      </CardContent>
    </Card>
  </aside>
  <article class="prose">
    <header>
      <Badge variant="secondary">Guide</Badge>
      <h2 id="overview">Building with Texuli</h2>
    </header>
    <p>
      Harbor Notes docs are fictional. This page shows a documentation layout: outline, prose, and
      callouts using Texuli cards and badges only.
    </p>
    <h3 id="install">Install</h3>
    <p>
      In a workspace that already links Texuli packages, import public subpaths such as
      <code>texuli/button</code> and <code>@texuli/media/image</code>. Prefer subpaths over root
      barrels for lazy media.
    </p>
    <h3 id="a11y">Accessibility</h3>
    <p>
      WCAG 2.x AA is the contrast gate. Logical CSS properties keep RTL honest. Never inject
      raw HTML from untrusted content.
    </p>
  </article>
</section>

<style>
  .docs {
    display: grid;
    gap: 1.25rem;
  }
  @media (min-width: 48rem) {
    .docs {
      grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr);
    }
  }
  .toc ol {
    margin: 0;
    padding-inline-start: 1.1rem;
    display: grid;
    gap: 0.35rem;
    font-size: 0.875rem;
  }
  .prose {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 40rem;
  }
  .prose h2 {
    margin: 0.5rem 0 0;
    font-size: 1.5rem;
  }
  .prose h3 {
    margin: 0.75rem 0 0;
    font-size: 1.15rem;
  }
  .prose p {
    margin: 0;
    color: var(--tx-foreground, CanvasText);
  }
  code {
    font-size: 0.9em;
  }
</style>
