import Action from './Action.svelte';
import Close from './Close.svelte';
import Description from './Description.svelte';
import Provider from './Provider.svelte';
import Root from './Root.svelte';
import Title from './Title.svelte';
import Toaster from './Toaster.svelte';
import Viewport from './Viewport.svelte';

export { createToastManager } from './manager.ts';
export type {
  PublishToastInput,
  ToastManager,
  ToastManagerOptions,
  ToastPriority,
  ToastRecord,
  ToastTone,
} from './types.ts';
export { Action, Close, Description, Provider, Root, Title, Toaster, Viewport };

/** Compound toast primitives (region + queue). */
export const Toast = Object.freeze({
  Provider,
  Viewport,
  Root,
  Title,
  Description,
  Action,
  Close,
  Toaster,
});
