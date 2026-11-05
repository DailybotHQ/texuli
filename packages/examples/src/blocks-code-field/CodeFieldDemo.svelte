<script lang="ts">
import { CodeField } from '@texuli/blocks/code-field';

let source = $state(
  [
    'interface Note {',
    '  id: string;',
    '  title: string;',
    '}',
    '',
    '// Fetch one note from the fictional API.',
    'export async function getNote(id: string): Promise<Note> {',
    "  const response = await fetch('https://api.example.com/notes/' + id);",
    '  return (await response.json()) as Note;',
    '}',
  ].join('\n')
);
let config = $state(
  'name: harbor\nreplicas: 2\n# A deliberately long comment that wraps inside the field instead of scrolling sideways.'
);
let query = $state('');
</script>

<article class="demo" data-example="blocks-code-field" aria-labelledby="code-field-title">
  <h2 id="code-field-title">Code field</h2>

  <CodeField
    bind:value={source}
    language="ts"
    label="Note loader (TypeScript)"
    lineNumbers
    showKeyboardHint
    name="loader"
    data-case="ts"
  />
  <p class="count" data-count>{source.split('\n').length} lines</p>

  <CodeField bind:value={config} language="yaml" label="Deploy settings (YAML, wrapped)" wrap lineNumbers rows={3} data-case="wrap" />

  <CodeField
    bind:value={query}
    language="sql"
    label="Query"
    placeholder="SELECT id FROM notes;"
    rows={2}
    data-case="empty"
  />

  <CodeField value={'{\n  "theme": "enterprise-neutral"\n}'} language="json" label="Read-only settings" readonly rows={2} data-case="readonly" />

  <CodeField value={'pnpm dev --port 4810'} language="bash" label="Disabled command" disabled rows={1} data-case="disabled" />
</article>

<style>
  .demo {
    display: grid;
    gap: 1rem;
    max-inline-size: 46rem;
    padding: 1.5rem;
  }
  .demo h2,
  .count {
    margin: 0;
  }
  .count {
    font-size: 0.875rem;
  }
</style>
