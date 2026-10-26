import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import BannerRefHarness from './BannerRefHarness.svelte';

afterEach(cleanup);

describe('Banner ref', () => {
  it('binds the rendered root element like Alert and Callout do', () => {
    const view = render(BannerRefHarness);
    expect(view.container.querySelector('[data-tx-layout="banner"]')).toBeTruthy();
    expect(view.getByTestId('banner-ref-tag').textContent).toBe('DIV');
  });
});
