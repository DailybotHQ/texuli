import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { defineRows, gotoScenario, scenario } from '../harness/index.ts';

const input = (page: import('@playwright/test').Page) => page.getByLabel('Choose files');

scenario(
  'file-drop',
  defineRows([
    {
      id: 'named-input',
      title: 'the drop group exposes a named native file input',
      async run({ page }) {
        await expect(page.getByRole('group', { name: 'Attach documents' })).toBeVisible();
        await expect(input(page)).toHaveAttribute('type', 'file');
        await expect(input(page)).toHaveAttribute('accept', 'text/plain,.md');
        await expect(input(page)).toHaveAttribute('multiple', '');
      },
    },
    {
      id: 'keyboard-file-picker',
      title: 'Enter opens the native file picker and selected files are announced',
      async run({ page }) {
        await input(page).focus();
        const chooserPromise = page.waitForEvent('filechooser');
        await page.keyboard.press('Enter');
        const chooser = await chooserPromise;
        await chooser.setFiles({
          name: 'notes.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('hello'),
        });
        await expect(page.getByText('notes.txt')).toBeVisible();
      },
    },
  ])
);

test('FileDrop accepts pointer selection through its native input', async ({ page }) => {
  await gotoScenario(page, 'file-drop');
  const nativeInput = input(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await nativeInput.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'pointer.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('pointer'),
  });
  await expect(page.getByText('pointer.txt')).toBeVisible();
});

test('FileDrop accepts dropped files and reports rejected files accessibly', async ({ page }) => {
  await gotoScenario(page, 'file-drop');
  const group = page.getByRole('group', { name: 'Attach documents' });
  await group.evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['notes'], 'notes.md', { type: 'text/markdown' }));
    transfer.items.add(new File(['image'], 'image.png', { type: 'image/png' }));
    const dragEnter = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    const dragOver = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    });
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
    element.dispatchEvent(dragEnter);
    element.dispatchEvent(dragOver);
    element.dispatchEvent(drop);
  });

  await expect(group).toHaveAttribute('data-state', 'idle');
  await expect(page.getByRole('list', { name: 'Selected documents' })).toContainText('notes.md');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('image.png');
  await expect(alert).toContainText('Unsupported file type');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  const accessibility = await new AxeBuilder({ page })
    .include('[aria-label="Attach documents"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test('FileDrop native input opens from touch on Pixel 7', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Touch input is exercised on the Pixel 7 project.');
  await gotoScenario(page, 'file-drop');
  const nativeInput = input(page);
  const chooserPromise = page.waitForEvent('filechooser');
  await nativeInput.tap();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'touch.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('touch'),
  });
  await expect(page.getByText('touch.txt')).toBeVisible();
});
