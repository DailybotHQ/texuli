<script lang="ts">
import { type ClassValue, cx } from 'texuli/cx';
import { chapterAtTime, formatCaptionTime } from './model.ts';
import type { ChapterMenuProps } from './types.ts';
import './captions.css';

/**
 * Keyboard-operable chapter list. Selecting a chapter reports its start time
 * through `onSelect` so a host player can seek.
 */
let {
  chapters,
  currentTime = 0,
  label = 'Chapters',
  disabled = false,
  class: className,
  onSelect,
}: ChapterMenuProps & { class?: ClassValue } = $props();

const active = $derived(chapterAtTime(chapters, currentTime));
const listId = $props.id();

function activate(index: number): void {
  if (disabled || !onSelect) return;
  const chapter = chapters[index];
  if (chapter) onSelect(chapter);
}

function onKeydown(event: KeyboardEvent, index: number): void {
  if (disabled || chapters.length === 0) return;
  let next = index;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    event.preventDefault();
    next = Math.min(chapters.length - 1, index + 1);
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    event.preventDefault();
    next = Math.max(0, index - 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    next = 0;
  } else if (event.key === 'End') {
    event.preventDefault();
    next = chapters.length - 1;
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    activate(index);
    return;
  } else {
    return;
  }
  const target = (event.currentTarget as HTMLElement)
    .closest('[data-tx-captions-chapters]')
    ?.querySelectorAll<HTMLButtonElement>('[data-tx-chapter-button]')[next];
  target?.focus();
}
</script>

<nav
  class={cx('tx-captions-chapters', className)}
  data-tx-captions-chapters=""
  aria-label={label}
>
  <p class="tx-captions-chapters__title" id="{listId}-title">{label}</p>
  <ul class="tx-captions-chapters__list" aria-labelledby="{listId}-title" role="list">
    {#each chapters as chapter, index (chapter.id)}
      <li class="tx-captions-chapters__item">
        <button
          type="button"
          class="tx-captions-chapters__button"
          data-tx-chapter-button=""
          data-chapter-id={chapter.id}
          aria-current={active?.id === chapter.id ? 'true' : undefined}
          {disabled}
          onclick={() => activate(index)}
          onkeydown={(event) => onKeydown(event, index)}
        >
          <span class="tx-captions-chapters__label">{chapter.title}</span>
          <span class="tx-captions-chapters__time">{formatCaptionTime(chapter.start)}</span>
        </button>
      </li>
    {/each}
  </ul>
</nav>
