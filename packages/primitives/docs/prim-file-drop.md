# FileDrop primitive

`@texuli/primitives/file-drop` provides an accessible, headless file input and
drop target. It keeps selected `File` objects as bindable state, checks the
browser-provided name, MIME type and byte size, and reports accepted or
rejected files without reading file contents.

```svelte
<script lang="ts">
  import { FileDrop } from '@texuli/primitives/file-drop';

  let files = $state<File[]>([]);
</script>

<FileDrop.Root
  bind:files
  label="Attach documents"
  inputLabel="Choose documents"
  accept="application/pdf,.md"
  maxSize={5 * 1024 * 1024}
  maxFiles={3}
>
  {#snippet children({ files: selected, removeFile })}
    <ul aria-label="Selected documents">
      {#each selected as file, index (index)}
        <li>
          {file.name}
          <button type="button" onclick={() => removeFile(file)}>Remove {file.name}</button>
        </li>
      {/each}
    </ul>
  {/snippet}
</FileDrop.Root>
```

## Behavior and accessibility

- The root is a named `group` and handles file drag, drag-over, leave and drop.
- A labeled native `input[type=file]` remains visible and keyboard and touch
  operable by default. It opens the platform picker; consumers may style it or
  replace its element with the `child` snippet while spreading the provided
  `props` onto their input.
- `accept` supports comma-separated file extensions, exact MIME types and MIME
  wildcards such as `image/*`. The same checks run for picker and dropped files.
- `maxSize` is a per-file byte limit. `maxFiles` counts currently selected
  files and newly accepted files. A non-multiple input accepts at most one.
- Accepted files are available through `bind:files` and the `children` snippet.
  `removeFile` updates bound state without reading or mutating file bytes.
- Rejections are bindable as `rejects`, listed in an alert region, and described
  by the input. Accepted/rejected selection updates the status region.
- `getRejectMessage` and `getAnnouncement` let an application supply localized
  copy. Labels (`label`, `inputLabel`, `browseLabel`) and `description` are also
  configurable.
- `data-state` is `idle`, `dragging`, or `disabled` on the group, and is also
  present on the native input.

Client-side type and size checks improve the interaction but are not a security
boundary. Validate files again in the receiving service. FileDrop does not
preview files, inspect their contents, upload them, or treat their MIME type as
verified.

## Public helpers

`matchesFileAccept(file, accept)` and `validateFiles(files, options)` are
framework-free helpers exported from the same subpath. `validateFiles` returns
`{ accepted, rejected }`; each rejection contains the original `File` and a
`count`, `size`, or `type` reason.

## Validation

```sh
pnpm vitest run packages/primitives/tests/file-drop.test.ts
TEXULI_E2E_PORT=4850 pnpm exec playwright test tests/behavior/scenarios/file-drop.spec.ts
```

The behavior spec exercises keyboard and pointer selection, a real dropped-file
event, touch input on the Pixel 7 project, and axe checks.
