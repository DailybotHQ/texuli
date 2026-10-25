import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { matchesFileAccept, validateFiles } from '../src/file-drop/accept.ts';
import FileDropFixture from './file-drop-fixture.svelte';

afterEach(() => cleanup());

function makeFile(name: string, type = 'text/plain', size = 1): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('FileDrop validation', () => {
  it('matches extension, exact MIME, wildcard and empty accept patterns', () => {
    expect(matchesFileAccept(makeFile('notes.MD'), '.md,.txt')).toBe(true);
    expect(matchesFileAccept(makeFile('photo.png', 'image/png'), 'image/*')).toBe(true);
    expect(matchesFileAccept(makeFile('notes.txt'), 'text/plain')).toBe(true);
    expect(matchesFileAccept(makeFile('archive.bin'), undefined)).toBe(true);
    expect(matchesFileAccept(makeFile('notes.txt'), 'image/*')).toBe(false);
  });

  it('keeps accepted files and identifies type, size and count rejections', () => {
    const notes = makeFile('notes.txt', 'text/plain', 3);
    const tooLarge = makeFile('large.txt', 'text/plain', 9);
    const image = makeFile('photo.png', 'image/png', 3);
    const second = makeFile('todo.md', 'text/markdown', 2);
    const overflow = makeFile('extra.txt', 'text/plain', 1);

    const result = validateFiles([notes, tooLarge, image, second, overflow], {
      accept: 'text/plain,.md',
      maxSize: 8,
      maxFiles: 2,
    });

    expect(result.accepted).toEqual([notes, second]);
    expect(result.rejected).toEqual([
      { file: tooLarge, reason: 'size' },
      { file: image, reason: 'type' },
      { file: overflow, reason: 'count' },
    ]);
  });

  it('honors single-file selection, selected count and zero-byte limits', () => {
    const empty = makeFile('empty.txt', 'text/plain', 0);
    const next = makeFile('next.txt');
    expect(validateFiles([empty], { maxSize: 0, multiple: false }).accepted).toEqual([empty]);
    expect(validateFiles([next], { multiple: false, currentCount: 1 }).rejected[0]?.reason).toBe(
      'count'
    );
  });

  it('rejects invalid limits', () => {
    expect(() => validateFiles([], { maxSize: -1 })).toThrow(RangeError);
    expect(() => validateFiles([], { maxFiles: 1.5 })).toThrow(RangeError);
  });
});

describe('FileDrop.Root', () => {
  it('provides a named, keyboard-focusable native input and bound file state', async () => {
    render(FileDropFixture);

    const input = screen.getByLabelText('Choose documents') as HTMLInputElement;
    const group = screen.getByRole('group', { name: 'Attach documents' });
    expect(input.type).toBe('file');
    expect(input.getAttribute('accept')).toBe('text/plain,.md');
    expect(input.multiple).toBe(true);
    expect(group.getAttribute('data-state')).toBe('idle');

    const file = makeFile('notes.txt');
    input.focus();
    expect(document.activeElement).toBe(input);
    await fireEvent.change(input, { target: { files: [file] } });

    expect(
      within(screen.getByRole('list', { name: 'Selected documents' })).getByText('notes.txt')
    ).toBeTruthy();
    expect(group.querySelector('[role="status"]')?.textContent).toBe('Files added.');
  });

  it('announces invalid type and size with an alert and marks the input invalid', async () => {
    render(FileDropFixture);
    const input = screen.getByLabelText('Choose documents') as HTMLInputElement;
    await fireEvent.change(input, {
      target: {
        files: [makeFile('picture.png', 'image/png'), makeFile('huge.txt', 'text/plain', 9)],
      },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('picture.png');
    expect(alert.textContent).toContain('Unsupported file type');
    expect(alert.textContent).toContain('huge.txt');
    expect(alert.textContent).toContain('File is too large.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
    expect(
      screen.getByRole('group', { name: 'Attach documents' }).querySelector('[role="status"]')
        ?.textContent
    ).toBe('Files rejected.');
  });

  it('accepts dropped files, tracks drag state and supports removal', async () => {
    render(FileDropFixture);
    const group = screen.getByRole('group', { name: 'Attach documents' });
    const file = makeFile('dropped.txt');
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' };
    const dispatchDrag = async (type: 'dragenter' | 'dragover' | 'drop') => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
      await fireEvent(group, event);
    };

    await dispatchDrag('dragenter');
    expect(group.getAttribute('data-state')).toBe('dragging');
    await dispatchDrag('dragover');
    expect(dataTransfer.dropEffect).toBe('copy');
    await dispatchDrag('drop');

    expect(group.getAttribute('data-state')).toBe('idle');
    expect(screen.getByText('dropped.txt')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove dropped.txt' }));
    expect(screen.queryByText('dropped.txt')).toBeNull();
  });

  it('keeps disabled inputs inert when files are dropped', async () => {
    render(FileDropFixture);
    const group = screen.getByRole('group', { name: 'Locked uploads' });
    const file = makeFile('blocked.txt');
    const event = fireEvent.drop(group, {
      dataTransfer: { types: ['Files'], files: [file], dropEffect: 'none' },
    });

    await event;
    expect(group.querySelector('input')?.disabled).toBe(true);
    expect(group.getAttribute('data-state')).toBe('disabled');
    expect(group.querySelector('[role="alert"]')).toBeNull();
  });
});
