<script lang="ts">
import { ImageEditor } from '@texuli/media/image-editor';

let ready = $state(false);
</script>

{#if !ready}<p role="status">Checking the image source…</p>{/if}
<div class="demo">
  <!-- Untrusted content may only use HTTPS or relative paths: this source is refused and never requested. -->
  <ImageEditor
    src="http://images.example/harbor.jpg"
    alt="A harbor photo from an untrusted message"
    onstatus={(status) => (ready = status !== 'loading')}
  />
</div>

<style>
  .demo {
    max-inline-size: 36rem;
  }
</style>
