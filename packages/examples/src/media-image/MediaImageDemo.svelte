<script lang="ts">
import { Image, type ImageLoader, type ImageStatus } from '@texuli/media/image';
import harbor from './harbor.svg?url&no-inline';
import harborTiny from './harbor-tiny.svg?url&no-inline';

/**
 * Image example: responsive srcset, focal-point crops, placeholders, a link
 * and a button image, and the fallback for blocked and missing sources. The
 * pictures are local fictional illustrations served as relative files, so
 * they pass the default (untrusted) image policy.
 */

/** A real image CDN would resize; this demo marks the width in the fragment. */
const loader: ImageLoader = (src, width) => `${src}#w=${width}`;

let enlarged = $state(false);
let missingStatus = $state<ImageStatus>('loading');
</script>

<article class="demo" data-example="media-image" aria-labelledby="media-image-title">
  <h2 id="media-image-title">Image</h2>

  <section aria-labelledby="responsive-title">
    <h3 id="responsive-title">Responsive, with a blur-up placeholder</h3>
    <Image
      src={harbor}
      widths={[480, 960, 1600]}
      {loader}
      sizes="(min-width: 48rem) 40rem, 100vw"
      alt="Fishing boats in a harbor at sunset, with a lighthouse on the right"
      width={1600}
      height={900}
      loading="eager"
      placeholder={{ kind: 'blur', src: harborTiny }}
      class="hero"
    />
  </section>

  <section aria-labelledby="focal-title">
    <h3 id="focal-title">Focal point in a square crop</h3>
    <div class="row">
      <figure>
        <Image src={harbor} alt="Crop centered on the sailboat" width={240} height={240} loading="eager" focalPoint={{ x: 0.27, y: 0.6 }} placeholder={{ kind: 'color', color: '#1e3a5f' }} />
        <figcaption>Sailboat (x 0.27)</figcaption>
      </figure>
      <figure>
        <Image src={harbor} alt="Crop centered on the lighthouse" width={240} height={240} loading="eager" focalPoint={{ x: 0.75, y: 0.5 }} placeholder={{ kind: 'color', color: '#1e3a5f' }} />
        <figcaption>Lighthouse (x 0.75)</figcaption>
      </figure>
      <figure>
        <Image src={harbor} alt="The whole harbor, letterboxed" width={240} height={240} loading="eager" fit="contain" />
        <figcaption>fit="contain"</figcaption>
      </figure>
    </div>
  </section>

  <section aria-labelledby="actions-title">
    <h3 id="actions-title">Link and button images</h3>
    <div class="row">
      <Image src={harbor} alt="Open the harbor album on example.com" href="https://example.com/albums/harbor" width={240} height={135} loading="eager" />
      <Image
        src={harbor}
        alt=""
        actionLabel={enlarged ? 'Shrink the harbor photo' : 'Enlarge the harbor photo'}
        onactivate={() => (enlarged = !enlarged)}
        width={enlarged ? 480 : 240}
        height={enlarged ? 270 : 135}
        loading="eager"
      />
    </div>
    <p role="status">{enlarged ? 'Enlarged' : 'Thumbnail'}</p>
  </section>

  <section aria-labelledby="fallback-title">
    <h3 id="fallback-title">Blocked and missing sources</h3>
    <div class="row">
      <Image src="javascript:alert(1)" alt="Blocked: a javascript: URL" width={240} height={135} />
      <Image src="http://images.example.com/plain-http.jpg" alt="Blocked: plain HTTP from untrusted data" width={240} height={135} />
      <Image
        src="/media-image-missing.png"
        alt="A missing file"
        width={240}
        height={135}
        loading="eager"
        onstatus={(status) => (missingStatus = status)}
      />
    </div>
    <p>Missing file status: <span data-missing-status>{missingStatus}</span></p>
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: 1.5rem;
    max-inline-size: 48rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo h3,
  .demo p,
  figure {
    margin: 0;
  }
  section {
    display: grid;
    gap: 0.75rem;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-start;
  }
  figure {
    display: grid;
    gap: 0.375rem;
    font-size: 0.875rem;
  }
  :global(.hero) {
    border-radius: 0.75rem;
  }
</style>
