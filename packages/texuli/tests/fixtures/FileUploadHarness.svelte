<script lang="ts">
import type { FileDropRejection } from '@texuli/primitives/file-drop';
import {
  FileUpload,
  type FileUploadProgressMap,
  type FileUploadVariant,
} from '../../src/components/file-upload/index.ts';

let {
  accept = 'image/*,.txt,.md',
  maxSize = 1024 * 1024,
  maxFiles = 3,
  multiple = true,
  disabled = false,
  variant = 'default' as FileUploadVariant,
  showPreviews = true,
  progress = {} as FileUploadProgressMap,
  files = $bindable<File[]>([]),
  rejects = $bindable<FileDropRejection[]>([]),
}: {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  disabled?: boolean;
  variant?: FileUploadVariant;
  showPreviews?: boolean;
  progress?: FileUploadProgressMap;
  files?: File[];
  rejects?: FileDropRejection[];
} = $props();
</script>

<FileUpload
  bind:files
  bind:rejects
  {accept}
  {maxSize}
  {maxFiles}
  {multiple}
  {disabled}
  {variant}
  {showPreviews}
  {progress}
/>
