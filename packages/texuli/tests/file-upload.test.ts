import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { FILE_UPLOAD_VARIANTS, fileUploadClass } from '../src/components/file-upload/index.ts';
import FileUploadHarness from './fixtures/FileUploadHarness.svelte';

afterEach(() => cleanup());

function makeFile(name: string, type: string, size = 32): File {
  const buffer = new Uint8Array(size);
  return new File([buffer], name, { type, lastModified: 1 });
}

describe('fileUploadClass', () => {
  it('applies variant classes', () => {
    expect(fileUploadClass({ variant: 'compact' })).toContain('tx-file-upload--compact');
    expect(FILE_UPLOAD_VARIANTS).toContain('default');
  });
});

describe('FileUpload', () => {
  it('renders the drop zone labels and empty state', () => {
    const { getByLabelText, getByText } = render(FileUploadHarness);
    expect(getByLabelText(/Choose files/i)).toBeTruthy();
    expect(getByText(/No files selected yet/i)).toBeTruthy();
  });

  it('lists accepted files and allows remove', async () => {
    const file = makeFile('notes.txt', 'text/plain');
    const { container, getByLabelText } = render(FileUploadHarness, {
      props: { files: [file], accept: '.txt,text/plain' },
    });
    expect(container.querySelector('[data-tx-file-upload-list]')).toBeTruthy();
    expect(container.textContent).toContain('notes.txt');
    const remove = getByLabelText('Remove notes.txt');
    await fireEvent.click(remove);
    expect(container.querySelector('[data-tx-file-upload-list]')).toBeNull();
  });

  it('shows progress when provided', () => {
    const file = makeFile('photo.png', 'image/png');
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    const { container } = render(FileUploadHarness, {
      props: {
        files: [file],
        progress: { [key]: 40 },
        accept: 'image/*',
      },
    });
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('aria-valuenow')).toBe('40');
  });
  it('renders compact variant', () => {
    const { container } = render(FileUploadHarness, {
      props: { variant: 'compact' },
    });
    expect(container.querySelector('[data-variant="compact"]')).toBeTruthy();
  });

  it('marks the control disabled', () => {
    const { container } = render(FileUploadHarness, { props: { disabled: true } });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input?.disabled).toBe(true);
  });
});
