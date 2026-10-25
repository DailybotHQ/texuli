import FileDropRoot from './FileDropRoot.svelte';

export { matchesFileAccept, validateFiles } from './accept.ts';
export type {
  FileDropChildren,
  FileDropChildState,
  FileDropInputProps,
  FileDropRejection,
  FileDropRejectReason,
  FileDropRootProps,
  FileDropValidationOptions,
  FileDropValidationResult,
} from './types.ts';
export { FileDropRoot };

export const FileDrop = {
  Root: FileDropRoot,
};
