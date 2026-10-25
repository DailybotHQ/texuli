import { variants } from '../../internal/variants.ts';
// The recipe carries its styles: a consumer that composes the primitive with
// these classes (without the styled component) still gets the CSS.
import './file-upload.css';

export const FILE_UPLOAD_VARIANTS = ['default', 'compact'] as const;
export type FileUploadVariant = (typeof FILE_UPLOAD_VARIANTS)[number];

export const fileUploadClass = variants({
  base: 'tx-file-upload',
  variants: {
    variant: {
      default: 'tx-file-upload--default',
      compact: 'tx-file-upload--compact',
    },
  },
  defaultVariants: { variant: 'default' },
});
