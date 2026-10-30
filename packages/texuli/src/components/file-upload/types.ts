export type FileUploadProgressMap = Readonly<Record<string, number | null | undefined>>;

export type FileUploadLabels = {
  label: string;
  inputLabel: string;
  browse: string;
  description: string;
  selectedList: string;
  remove: string;
  rejectType: string;
  rejectSize: string;
  rejectCount: string;
  empty: string;
};

/** English defaults; the catalog (`texuli.file-upload.*`) and the `labels` prop override them. */
export const DEFAULT_FILE_UPLOAD_LABELS: Readonly<FileUploadLabels> = Object.freeze({
  label: 'Upload files',
  inputLabel: 'Choose files to upload',
  browse: 'Browse files',
  description: 'Drop files here or browse. Only file names and sizes are checked.',
  selectedList: 'Selected files',
  remove: 'Remove',
  rejectType: 'Unsupported type',
  rejectSize: 'File too large',
  rejectCount: 'Too many files',
  empty: 'No files selected yet.',
});
