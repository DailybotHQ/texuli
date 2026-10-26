import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getExample } from '../src/index.ts';

afterEach(cleanup);

describe('lane-requested example enrichments', () => {
  it('shows accent and danger callouts and the long code line', async () => {
    const text = await getExample('blocks-text')?.load();
    const code = await getExample('blocks-code')?.load();
    expect(text).toBeDefined();
    expect(code).toBeDefined();
    if (!text || !code) throw new Error('Block examples did not load.');

    const textRender = render(text.default);
    expect(textRender.container.textContent).toContain('A new workspace accent');
    expect(textRender.container.textContent).toContain('Access paused');
    expect(textRender.container.querySelector('[data-tone="danger"]')).not.toBeNull();
    textRender.unmount();

    const codeRender = render(code.default);
    expect(codeRender.container.textContent).toContain('deliberately long line demonstrates');
  });

  it('renders a windowed plain grid and an RTL map', async () => {
    const grid = await getExample('data-grid-core')?.load();
    const map = await getExample('data-map')?.load();
    expect(grid).toBeDefined();
    expect(map).toBeDefined();
    if (!grid || !map) throw new Error('Data examples did not load.');

    const gridRender = render(grid.default);
    expect(gridRender.getByText('Windowed rows')).toBeTruthy();
    expect(
      gridRender.getByText(
        '80 fictional rows with virtualization enabled after 20 visible records.'
      )
    ).toBeTruthy();
    gridRender.unmount();

    const mapRender = render(map.default);
    expect(mapRender.container.querySelector('[dir="rtl"][lang="ar"]')).not.toBeNull();
    expect(mapRender.container.textContent).toContain('تغطية الميناء');
  });

  it('renders a large icon button, vertical group, busy table and disabled field', async () => {
    const button = await getExample('texuli-button')?.load();
    const table = await getExample('texuli-table')?.load();
    const field = await getExample('texuli-field')?.load();
    expect(button && table && field).toBeDefined();
    if (!button || !table || !field) throw new Error('Texuli examples did not load.');

    const buttonRender = render(button.default);
    expect(buttonRender.getByRole('button', { name: 'More actions, large' })).toBeTruthy();
    expect(buttonRender.container.querySelector('[data-axis="group-vertical"]')).not.toBeNull();
    buttonRender.unmount();

    const tableRender = render(table.default);
    expect(tableRender.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    tableRender.unmount();

    const fieldRender = render(field.default);
    expect(fieldRender.getByLabelText('Workspace slug')).toHaveProperty('disabled', true);
  });

  it('switches feedback from skeleton to content and supports the custom alert layout', async () => {
    const feedback = await getExample('texuli-feedback')?.load();
    const alert = await getExample('texuli-alert')?.load();
    const toast = await getExample('texuli-toast')?.load();
    expect(feedback && alert && toast).toBeDefined();
    if (!feedback || !alert || !toast) throw new Error('Feedback examples did not load.');

    const feedbackRender = render(feedback.default);
    expect(feedbackRender.getByLabelText('Loading project summary')).toBeTruthy();
    await fireEvent.click(feedbackRender.getByRole('button', { name: 'Load summary' }));
    await waitFor(() =>
      expect(feedbackRender.getByLabelText('Loaded project summary')).toBeTruthy()
    );
    feedbackRender.unmount();

    const alertRender = render(alert.default);
    expect(
      alertRender.container.querySelector('[data-tx-layout="callout"][data-tx-tone="success"]')
    ).not.toBeNull();
    alertRender.unmount();

    const toastRender = render(toast.default);
    await fireEvent.click(toastRender.getByRole('button', { name: 'Show all tones' }));
    await waitFor(() =>
      expect(toastRender.container.textContent).toContain(
        'A very long notification title that remains readable in a narrow notification corner'
      )
    );
  });
});
