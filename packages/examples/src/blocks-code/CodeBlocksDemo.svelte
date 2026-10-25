<script lang="ts">
import { CodeBlockView } from '@texuli/blocks/code/renderers';
import { CODE_SAMPLES } from './samples.ts';

const first = CODE_SAMPLES[0]?.block;
</script>

<article class="demo" data-example="blocks-code" aria-labelledby="code-title">
  <h2 id="code-title">Code blocks</h2>

  <section class="case" aria-labelledby="code-steps">
    <h3 id="code-steps">Line numbers and highlighted lines</h3>
    <CodeBlockView block={first} step={1} />
  </section>

  {#each CODE_SAMPLES.slice(1) as sample (sample.label)}
    <div class="case">
      <h3>{sample.label}</h3>
      <CodeBlockView block={sample.block} />
    </div>
  {/each}

  <section class="case" dir="rtl" lang="ar" aria-labelledby="code-rtl">
    <h3 id="code-rtl">صفحة من اليمين إلى اليسار</h3>
    <CodeBlockView
      block={{
        type: 'code',
        lang: 'yaml',
        filename: 'deploy.yml',
        lineNumbers: true,
        code: 'name: harbor\nreplicas: 2\n# fictional',
      }}
      labels={{ copy: 'نسخ', copied: 'تم النسخ', copyName: 'نسخ رمز {name}' }}
    />
  </section>
</article>

<style>
  .demo {
    display: grid;
    gap: 1.25rem;
    max-inline-size: 46rem;
    padding: 1.5rem;
  }
  .case {
    display: grid;
    gap: 0.5rem;
  }
  .case h3,
  .demo h2 {
    margin: 0;
  }
</style>
