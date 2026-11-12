<script lang="ts">
/**
 * Editor emoji (PLAN_023 row 9): a toolbar button that opens `EmojiPicker` from `texuli/emoji`
 * (search, keyboard grid, tones, recents kept by the host) in a popover. A chosen emoji is
 * inserted at the selection as one undo step (`controller.insertEmoji`), and focus returns to
 * the text. The `:shortcode:` input rule is the controller's `shortcodes` lookup.
 */
import { Trigger as PopoverTrigger } from '@texuli/primitives/popover';
import { Toolbar as ToolbarPrimitive } from '@texuli/primitives/toolbar';
import { Button } from 'texuli/button';
import { type EmojiArtResolver, EmojiPicker, type EmojiPickerMessages } from 'texuli/emoji';
import { Popover } from 'texuli/popover';
import { toolbarButtonClass } from 'texuli/toolbar';
import type { EditorController } from '../controller/controller.svelte.ts';
import '../editor/editor.css';
import './emoji.css';

type Props = {
  controller: EditorController;
  /** Called after an emoji was inserted, so the host returns focus to the text. */
  onCommand?: () => void;
  disabled?: boolean;
  /** Render the button as a toolbar item (inside `EditorToolbar` or another toolbar). Default true. */
  toolbarItem?: boolean;
  /** Recently used emoji ids, kept by the host. */
  recentIds?: readonly string[];
  onRecentIdsChange?: (ids: readonly string[]) => void;
  /** Picker strings (translate). */
  messages?: Partial<EmojiPickerMessages>;
  /** Draw emoji with host art instead of system glyphs. */
  artResolver?: EmojiArtResolver;
  class?: string;
};

let {
  controller,
  onCommand,
  disabled = false,
  toolbarItem = true,
  recentIds,
  onRecentIdsChange,
  messages,
  artResolver,
  class: className,
}: Props = $props();

const uid = $props.id();
const labels = $derived(controller.labels);
const buttonClass = toolbarButtonClass({ size: 'sm' });
const unavailable = $derived(
  disabled || controller.active.block?.type === 'code' || controller.active.block?.type === 'void'
);
let open = $state(false);

function select(emoji: { unicode: string }) {
  controller.insertEmoji(emoji.unicode);
  open = false;
  // After the popover has closed and returned focus to its button, hand it back to the text.
  setTimeout(() => onCommand?.(), 0);
}
</script>

<Popover.Root bind:open side="bottom" align="start">
  {#if toolbarItem}
    <PopoverTrigger disabled={unavailable}>
      {#snippet child({ props })}
        <ToolbarPrimitive.Button
          {...props}
          class={[buttonClass, className]}
          disabled={unavailable}
          aria-label={labels.emoji}
          title={labels.emoji}
          data-command="emoji"
        >
          <span class="tx-editor-glyph" data-glyph="emoji" data-glyph-text="☺" aria-hidden="true"></span>
        </ToolbarPrimitive.Button>
      {/snippet}
    </PopoverTrigger>
  {:else}
    <PopoverTrigger disabled={unavailable}>
      {#snippet child({ props })}
        <Button {...props} size="sm" variant="outline" class={className} disabled={unavailable} data-command="emoji">
          {labels.emoji}
        </Button>
      {/snippet}
    </PopoverTrigger>
  {/if}
  <Popover.Content class="tx-editor-emoji" aria-label={labels.emojiPicker} data-editor-emoji>
    {#if open}
      <EmojiPicker
        id="{uid}-emoji"
        label={labels.emojiPicker}
        {recentIds}
        {onRecentIdsChange}
        {messages}
        {artResolver}
        onSelect={select}
      />
    {/if}
  </Popover.Content>
</Popover.Root>
