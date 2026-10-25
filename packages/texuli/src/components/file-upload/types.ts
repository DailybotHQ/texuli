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
