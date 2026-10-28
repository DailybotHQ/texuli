import {
  Drawer as PrimitiveDrawer,
  Panel as PrimitivePanel,
  ResponsiveModal as PrimitiveResponsiveModal,
  Sheet as PrimitiveSheet,
} from '@texuli/primitives/sheet';
import DetailPanelContent from './DetailPanelContent.svelte';
import DrawerContent from './DrawerContent.svelte';
import ResponsiveModalContent from './ResponsiveModalContent.svelte';
import SheetBody from './SheetBody.svelte';
import SheetCloseButton from './SheetCloseButton.svelte';
import SheetContent from './SheetContent.svelte';
import SheetFooter from './SheetFooter.svelte';
import SheetHeader from './SheetHeader.svelte';
import SheetOverlay from './SheetOverlay.svelte';

/** The styled header, body, footer and close parts every sheet surface shares. */
type SheetParts = {
  Header: typeof SheetHeader;
  Body: typeof SheetBody;
  Footer: typeof SheetFooter;
  CloseButton: typeof SheetCloseButton;
};
const parts: SheetParts = {
  Header: SheetHeader,
  Body: SheetBody,
  Footer: SheetFooter,
  CloseButton: SheetCloseButton,
};

export const Sheet: Omit<typeof PrimitiveSheet, 'Content' | 'Overlay'> &
  SheetParts & {
    Content: typeof SheetContent;
    Overlay: typeof SheetOverlay;
  } = { ...PrimitiveSheet, ...parts, Content: SheetContent, Overlay: SheetOverlay };
export const Drawer: Omit<typeof PrimitiveDrawer, 'Content'> &
  SheetParts & { Content: typeof DrawerContent } = {
  ...PrimitiveDrawer,
  ...parts,
  Content: DrawerContent,
};
export const DetailPanel: Omit<typeof PrimitivePanel, 'Content'> &
  SheetParts & {
    Content: typeof DetailPanelContent;
  } = { ...PrimitivePanel, ...parts, Content: DetailPanelContent };
export const ResponsiveModal: Omit<typeof PrimitiveResponsiveModal, 'Content' | 'Overlay'> &
  SheetParts & {
    Content: typeof ResponsiveModalContent;
    Overlay: typeof SheetOverlay;
  } = {
  ...PrimitiveResponsiveModal,
  ...parts,
  Content: ResponsiveModalContent,
  Overlay: SheetOverlay,
};

export const Panel = DetailPanel;

export { default as DetailPanelContent } from './DetailPanelContent.svelte';
export { default as DrawerContent } from './DrawerContent.svelte';
export { default as ResponsiveModalContent } from './ResponsiveModalContent.svelte';
export { default as SheetBody } from './SheetBody.svelte';
export { default as SheetCloseButton } from './SheetCloseButton.svelte';
export { default as SheetContent } from './SheetContent.svelte';
export { default as SheetFooter } from './SheetFooter.svelte';
export { default as SheetHeader } from './SheetHeader.svelte';
export { default as SheetOverlay } from './SheetOverlay.svelte';
export {
  detailPanelContentClass,
  drawerContentClass,
  responsiveModalContentClass,
  SHEET_SIZES,
  type SheetSize,
  sheetBodyClass,
  sheetCloseClass,
  sheetContentClass,
  sheetDescriptionClass,
  sheetFooterClass,
  sheetHeaderClass,
  sheetTitleClass,
} from './variants.ts';
