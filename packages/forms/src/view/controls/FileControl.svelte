<script lang="ts">
import { FileUpload } from 'texuli/file-upload';
import type { SchemaFormControlProps } from './types.ts';

let { field, attrs, required, disabled, readOnly, files, onFiles }: SchemaFormControlProps =
  $props();

function addFiles(added: File[]): void {
  onFiles(field.maxItems === 1 ? added.slice(-1) : [...files, ...added]);
}

function removeFile(file: File): void {
  onFiles(files.filter((item) => item !== file));
}
</script>

<FileUpload
  {...attrs}
  name={field.name}
  files={[...files]}
  accept={field.accept?.join(',')}
  maxSize={field.maxSize}
  maxFiles={field.maxItems}
  multiple={field.maxItems !== 1}
  {required}
  disabled={disabled || readOnly}
  onFilesAdd={addFiles}
  onFileRemove={removeFile}
/>
