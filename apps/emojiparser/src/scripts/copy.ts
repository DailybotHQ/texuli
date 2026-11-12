const buttons = document.querySelectorAll<HTMLButtonElement>(
  '[data-copy-value], [data-copy-output]'
);
for (const button of buttons) {
  button.addEventListener('click', async () => {
    const output = button.hasAttribute('data-copy-output')
      ? (document.querySelector<HTMLElement>('[data-converter-output]')?.textContent ?? '')
      : (button.dataset.copyValue ?? '');
    const feedback = button.parentElement?.querySelector<HTMLElement>('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(output);
      if (feedback) feedback.textContent = 'Copied.';
      else button.textContent = 'Copied';
    } catch {
      if (feedback) feedback.textContent = 'Copy is unavailable in this browser context.';
      else button.textContent = 'Copy unavailable';
    }
  });
}
