<script lang="ts">
import { FileUpload } from 'texuli/file-upload';

let filesDefault = $state<File[]>([]);
let filesCompact = $state<File[]>([]);
let filesProgress = $state<File[]>([]);
let filesRtl = $state<File[]>([]);

// Demo progress map for the progress axis (stable keys once files exist).
const progress = $derived.by(() => {
  const map: Record<string, number> = {};
  for (const file of filesProgress) {
    map[`${file.name}:${file.size}:${file.lastModified}`] = 55;
  }
  return map;
});
</script>

<section data-example="texuli-file-upload" aria-labelledby="tx-file-upload-title">
  <h2 id="tx-file-upload-title">File upload</h2>
  <p>
    Drop zone with previews, per-file progress and rejection errors. Fictional Harbor Notes
    copy only — no real uploads.
  </p>

  <h3>Default</h3>
  <div data-axis="default">
    <FileUpload
      bind:files={filesDefault}
      accept="image/*,.txt,.md,.pdf"
      maxFiles={4}
      maxSize={5 * 1024 * 1024}
    />
  </div>

  <h3>Compact</h3>
  <div data-axis="compact">
    <FileUpload
      bind:files={filesCompact}
      variant="compact"
      accept=".txt,.md"
      maxFiles={2}
      maxSize={64 * 1024}
    />
  </div>

  <h3>Progress</h3>
  <div data-axis="progress">
    <FileUpload
      bind:files={filesProgress}
      accept="image/*,.txt"
      maxFiles={3}
      {progress}
      labels={{ description: 'Add a file to see a sample progress bar (demo only).' }}
    />
  </div>

  <h3>Disabled</h3>
  <div data-axis="disabled">
    <FileUpload disabled accept=".txt" maxFiles={1} />
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar">
    <FileUpload
      bind:files={filesRtl}
      accept="image/*,.txt"
      labels={{
        label: 'رفع الملفات',
        browse: 'تصفح',
        description: 'اسحب الملفات أو تصفح.',
        empty: 'لا ملفات بعد.',
        selectedList: 'الملفات المحددة',
        remove: 'إزالة',
      }}
    />
  </div>

</section>

<style>
  section {
    display: grid;
    gap: 1.25rem;
    padding: 1rem;
    min-inline-size: 0;
    max-inline-size: min(100%, 40rem);
  }
</style>
