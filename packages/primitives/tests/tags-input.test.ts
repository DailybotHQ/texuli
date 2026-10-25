import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addTags, splitTags } from '../src/tags-input/index.ts';
import Fixture from './tags-input-fixture.svelte';

afterEach(cleanup);

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const input = () => screen.getByRole('textbox', { name: 'Add a topic' }) as HTMLInputElement;
const tagNames = () =>
  screen.getAllByRole('listitem').map((item) => item.querySelector('span')?.textContent);
const tag = (name: string) =>
  screen
    .getAllByRole('listitem')
    .find((item) => item.querySelector('span')?.textContent === name) as HTMLElement;
const status = () => screen.getByRole('status').textContent;

async function type(text: string) {
  await fireEvent.input(input(), { target: { value: text } });
}

async function press(key: string, target: Element = document.activeElement as Element) {
  await fireEvent.keyDown(target, { key });
  await tick();
}

function paste(text: string) {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { getData: () => string };
  };
  Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
  input().dispatchEvent(event);
  return event;
}

describe('tag rules', () => {
  it('splits on the delimiter and line breaks, trimming and dropping empty pieces', () => {
    expect(splitTags(' a, b ,,c ', ',')).toEqual(['a', 'b', 'c']);
    expect(splitTags('a\nb\r\nc', ',')).toEqual(['a', 'b', 'c']);
    expect(splitTags('a; b|c', /[;|]/)).toEqual(['a', 'b', 'c']);
    expect(splitTags('   ', ',')).toEqual([]);
  });

  it('accepts in order and explains every refusal', () => {
    const decision = addTags(['a'], ['a', 'b', 'bad', 'c', 'd'], {
      delimiter: ',',
      allowDuplicates: false,
      max: 3,
      validate: (value) => (value === 'bad' ? 'No bad tags' : true),
    });
    expect(decision.tags).toEqual(['a', 'b', 'c']);
    expect(decision.added).toEqual(['b', 'c']);
    expect(decision.rejected).toEqual([
      { tag: 'a', reason: 'duplicate' },
      { tag: 'bad', reason: 'invalid', message: 'No bad tags' },
      { tag: 'd', reason: 'max' },
    ]);
    expect(addTags(['a'], ['a'], { delimiter: ',', allowDuplicates: true, max: 9 }).tags).toEqual([
      'a',
      'a',
    ]);
  });
});

describe('TagsInput: structure', () => {
  it('is a labelled group with a list of tags, a named input and named remove buttons', () => {
    render(Fixture);
    expect(screen.getByRole('group', { name: 'Topics' })).toBeTruthy();
    expect(screen.getByRole('list')).toBeTruthy();
    expect(tagNames()).toEqual(['design', 'research']);
    expect(screen.getByRole('button', { name: 'Remove design' }).getAttribute('tabindex')).toBe(
      '-1'
    );
    // The input is the only Tab stop; tags take focus from the arrow keys.
    expect(tag('design').getAttribute('tabindex')).toBe('-1');
    expect(input().getAttribute('autocomplete')).toBe('off');
    expect(screen.getByRole('status').textContent).toBe('');
  });
});

describe('TagsInput: adding', () => {
  it('adds the typed text with Enter, clears the input and announces it', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    input().focus();
    await type('  testing  ');
    await press('Enter', input());
    expect(tagNames()).toEqual(['design', 'research', 'testing']);
    expect(input().value).toBe('');
    expect(onValueChange).toHaveBeenLastCalledWith(['design', 'research', 'testing']);
    expect(status()).toBe('testing added');
  });

  it('adds with the delimiter key and splits several tags at once', async () => {
    render(Fixture);
    await type('ux, ops');
    await press(',', input());
    expect(tagNames()).toEqual(['design', 'research', 'ux', 'ops']);
  });

  it('does not submit the form with Enter while there is text, but lets an empty Enter through', async () => {
    render(Fixture);
    await type('ops');
    const withText = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(withText);
    expect(withText.defaultPrevented).toBe(true);
    await tick();
    expect(input().value).toBe('');
    const empty = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input().dispatchEvent(empty);
    expect(empty.defaultPrevented).toBe(false);
  });

  it('refuses duplicates, keeps the draft, marks it invalid and announces why', async () => {
    const onInvalid = vi.fn();
    render(Fixture, { props: { onInvalid } });
    await type('design');
    await press('Enter', input());
    expect(tagNames()).toEqual(['design', 'research']);
    expect(input().value).toBe('design');
    expect(input().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByTestId('root').hasAttribute('data-invalid')).toBe(true);
    expect(status()).toBe('design is already added');
    expect(onInvalid).toHaveBeenCalledWith({ tag: 'design', reason: 'duplicate' });
    await type('designs');
    expect(input().hasAttribute('aria-invalid')).toBe(false);
  });

  it('stops at max and runs the validator, announcing its message', async () => {
    render(Fixture, {
      props: {
        max: 3,
        validate: (value: string) => (value.length > 10 ? 'Keep topics short' : true),
      },
    });
    await type('a very long topic');
    await press('Enter', input());
    expect(status()).toBe('Keep topics short');
    await type('ux');
    await press('Enter', input());
    await type('ops');
    await press('Enter', input());
    expect(tagNames()).toEqual(['design', 'research', 'ux']);
    expect(status()).toBe('You can add up to 3 tags');
  });

  it('splits pasted text into tags, after what was already typed', async () => {
    render(Fixture);
    await type('mob');
    const event = paste('ile, web\nqa');
    await tick();
    expect(event.defaultPrevented).toBe(true);
    expect(tagNames()).toEqual(['design', 'research', 'mobile', 'web', 'qa']);
    expect(input().value).toBe('');
  });

  it('pastes normally when paste splitting is off', async () => {
    render(Fixture, { props: { addOnPaste: false } });
    expect(paste('a, b').defaultPrevented).toBe(false);
  });

  it('adds the draft on blur when asked', async () => {
    render(Fixture, { props: { addOnBlur: true } });
    await type('ops');
    await fireEvent.blur(input());
    expect(tagNames()).toContain('ops');
  });
});

describe('TagsInput: keyboard', () => {
  it('moves from the input to the last tag with Backspace on empty input, and ArrowLeft at the start', async () => {
    render(Fixture);
    input().focus();
    await press('Backspace', input());
    expect(document.activeElement).toBe(tag('research'));
    expect(tag('research').dataset.state).toBe('active');
    input().focus();
    await type('x');
    input().setSelectionRange(0, 0);
    await press('ArrowLeft', input());
    expect(document.activeElement).toBe(tag('research'));
  });

  it('keeps Backspace for editing while the input has text', async () => {
    render(Fixture);
    input().focus();
    await type('x');
    await press('Backspace', input());
    expect(document.activeElement).toBe(input());
  });

  it('moves between tags with the arrows and back to the input past the last one', async () => {
    render(Fixture);
    tag('research').focus();
    await press('ArrowLeft');
    expect(document.activeElement).toBe(tag('design'));
    await press('ArrowLeft');
    expect(document.activeElement).toBe(tag('design'));
    await press('ArrowRight');
    await press('ArrowRight');
    expect(document.activeElement).toBe(input());
    tag('research').focus();
    await press('Home');
    expect(document.activeElement).toBe(tag('design'));
    await press('End');
    expect(document.activeElement).toBe(input());
  });

  it('flips the arrows in RTL', async () => {
    render(Fixture, { props: { dir: 'rtl' } });
    tag('research').focus();
    await press('ArrowRight');
    expect(document.activeElement).toBe(tag('design'));
  });

  it('removes a tag with Backspace (focus to the previous one) or Delete (focus to the next one)', async () => {
    render(Fixture, { props: { value: ['a', 'b', 'c'] } });
    tag('b').focus();
    await press('Backspace');
    expect(tagNames()).toEqual(['a', 'c']);
    expect(document.activeElement).toBe(tag('a'));
    expect(status()).toBe('b removed');
    await press('Delete');
    expect(tagNames()).toEqual(['c']);
    expect(document.activeElement).toBe(tag('c'));
    await press('Delete');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(document.activeElement).toBe(input());
  });
});

describe('TagsInput: pointer and touch', () => {
  it('removes a tag with its remove button and returns focus to the input', async () => {
    const onValueChange = vi.fn();
    render(Fixture, { props: { onValueChange } });
    await fireEvent.click(screen.getByRole('button', { name: 'Remove design' }));
    await tick();
    expect(tagNames()).toEqual(['research']);
    expect(document.activeElement).toBe(input());
    expect(onValueChange).toHaveBeenLastCalledWith(['research']);
  });
});

describe('TagsInput: disabled', () => {
  it('disables the input and remove buttons and ignores keys', async () => {
    render(Fixture, { props: { disabled: true } });
    expect(input().disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Remove design' }) as HTMLButtonElement).disabled
    ).toBe(true);
    tag('design').focus();
    await press('Delete');
    expect(tagNames()).toEqual(['design', 'research']);
    expect(screen.getByTestId('root').hasAttribute('data-disabled')).toBe(true);
  });
});

describe('TagsInput: forms', () => {
  it('submits one field per tag and restores the start tags on reset', async () => {
    const onsubmit = vi.fn();
    render(Fixture, { props: { name: 'topic', onsubmit } });
    await type('ops');
    await press('Enter', input());
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const submitted = onsubmit.mock.calls[0]?.[0] as FormData | undefined;
    expect(submitted?.getAll('topic')).toEqual(['design', 'research', 'ops']);
    (screen.getByTestId('form') as HTMLFormElement).reset();
    await tick();
    await tick();
    expect(tagNames()).toEqual(['design', 'research']);
  });

  it('blocks submission while required and empty, without submitting the helper field', () => {
    render(Fixture, { props: { value: [], name: 'topic', required: true } });
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(form.checkValidity()).toBe(false);
    expect([...new FormData(form).keys()]).toEqual([]);
  });

  it('moves focus to the text input when the browser rejects an empty required field', async () => {
    render(Fixture, { props: { value: [], required: true } });
    (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).focus();
    (screen.getByTestId('form') as HTMLFormElement).checkValidity();
    await tick();
    expect(document.activeElement).toBe(input());
  });

  it('follows a required prop that changes after mount', async () => {
    const { rerender } = render(Fixture, { props: { value: [], required: false } });
    const form = screen.getByTestId('form') as HTMLFormElement;
    expect(form.checkValidity()).toBe(true);
    await rerender({ value: [], required: true });
    expect(form.checkValidity()).toBe(false);
  });

  it('is valid once a required input has a tag', async () => {
    render(Fixture, { props: { value: [], name: 'topic', required: true } });
    await type('ops');
    await press('Enter', input());
    expect((screen.getByTestId('form') as HTMLFormElement).checkValidity()).toBe(true);
  });
});

describe('TagsInput: composition', () => {
  it('spreads the input props on a child element', async () => {
    render(Fixture, { props: { childInput: true } });
    expect(input().classList.contains('custom-input')).toBe(true);
    await type('ops');
    await press('Enter', input());
    expect(tagNames()).toContain('ops');
  });
});
