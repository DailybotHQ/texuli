/**
 * The kit's library and changes sections (kit API §5.3, §5.4): `KitLibrary` (the design
 * system's own components through host snippets, each with its approval badge and hash
 * check) and `KitChanges` (what changed between two versions), with their pure models.
 */
export { default as ApprovalBadge } from './ApprovalBadge.svelte';
export {
  changesModel,
  KIT_ALLOW_LISTS,
  type KitAllowChange,
  type KitAllowList,
  type KitApprovalChange,
  type KitChangeKind,
  type KitChangesModel,
  type KitLibraryChange,
  type KitVersion,
} from './changes-model.ts';
export { default as KitChanges } from './KitChanges.svelte';
export { default as KitLibrary } from './KitLibrary.svelte';
export {
  type KitComposeState,
  type KitLibraryItem,
  type KitLibraryModel,
  kitEntryApproval,
  kitEntryContentHash,
  libraryModel,
} from './model.ts';
