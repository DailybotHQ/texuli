import {
  Drawer as PrimitiveDrawer,
  Panel as PrimitivePanel,
  ResponsiveModal as PrimitiveResponsiveModal,
  Sheet as PrimitiveSheet,
} from '@texuli/primitives/sheet';
import DetailPanelContent from './DetailPanelContent.svelte';
import DrawerContent from './DrawerContent.svelte';
import ResponsiveModalContent from './ResponsiveModalContent.svelte';
import SheetContent from './SheetContent.svelte';
import SheetOverlay from './SheetOverlay.svelte';

export const Sheet: Omit<typeof PrimitiveSheet, 'Content' | 'Overlay'> & {
  Content: typeof SheetContent;
  Overlay: typeof SheetOverlay;
} = { ...PrimitiveSheet, Content: SheetContent, Overlay: SheetOverlay };
export const Drawer: Omit<typeof PrimitiveDrawer, 'Content'> & { Content: typeof DrawerContent } = {
  ...PrimitiveDrawer,
  Content: DrawerContent,
};
export const DetailPanel: Omit<typeof PrimitivePanel, 'Content'> & {
  Content: typeof DetailPanelContent;
} = { ...PrimitivePanel, Content: DetailPanelContent };
export const ResponsiveModal: Omit<typeof PrimitiveResponsiveModal, 'Content' | 'Overlay'> & {
  Content: typeof ResponsiveModalContent;
  Overlay: typeof SheetOverlay;
} = {
  ...PrimitiveResponsiveModal,
  Content: ResponsiveModalContent,
  Overlay: SheetOverlay,
};

export const Panel = DetailPanel;

export { default as DetailPanelContent } from './DetailPanelContent.svelte';
export { default as DrawerContent } from './DrawerContent.svelte';
export { default as ResponsiveModalContent } from './ResponsiveModalContent.svelte';
export { default as SheetContent } from './SheetContent.svelte';
export { default as SheetOverlay } from './SheetOverlay.svelte';
export {
  detailPanelContentClass,
  drawerContentClass,
  responsiveModalContentClass,
  SHEET_SIZES,
  type SheetSize,
  sheetContentClass,
} from './variants.ts';
