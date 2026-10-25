import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampDisplay,
  formatRatingLabel,
  normalizeMax,
  normalizeValue,
  Rating,
  ratingSteps,
  starFill,
} from '../src/components/rating/index.ts';

afterEach(cleanup);

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll('.tx-rating__star')].map((star) =>
    Number(star.querySelector('.tx-rating__fill')?.getAttribute('data-fill') ?? 0)
  );

describe('rating helpers', () => {
  it('normalizes the star count and the value grid', () => {
    expect([
      normalizeMax(5),
      normalizeMax(0),
      normalizeMax(12),
      normalizeMax(Number.NaN),
      normalizeMax(3.7),
    ]).toEqual([5, 1, 10, 5, 3]);
    expect(normalizeValue(3.4, 5, false)).toBe(3);
    expect(normalizeValue(3.4, 5, true)).toBe(3.5);
    expect(normalizeValue(9, 5, true)).toBe(5);
    expect(normalizeValue(-1, 5, false)).toBe(0);
    expect(normalizeValue(Number.NaN, 5, false)).toBe(0);
    expect(clampDisplay(4.3, 5)).toBe(4.3);
    expect(clampDisplay(7, 5)).toBe(5);
  });

  it('fills stars and lists the steps', () => {
    expect([1, 2, 3, 4, 5].map((index) => starFill(3.5, index))).toEqual([1, 1, 1, 0.5, 0]);
    expect(ratingSteps(3, false)).toEqual([1, 2, 3]);
    expect(ratingSteps(2, true)).toEqual([0.5, 1, 1.5, 2]);
  });

  it('formats translatable templates for the locale', () => {
    expect(formatRatingLabel('{value} of {max} stars', { value: 2.5, max: 5 })).toBe(
      '2.5 of 5 stars'
    );
    expect(formatRatingLabel('{value} von {max}', { value: 2.5, max: 5 }, 'de-DE')).toBe(
      '2,5 von 5'
    );
    expect(formatRatingLabel('{unknown}', {})).toBe('{unknown}');
  });
});

describe('Rating input (APG radio group)', () => {
  it('is a labeled radio group with one labeled radio per star', () => {
    render(Rating, { props: { value: 3 } });
    const group = screen.getByRole('radiogroup', { name: 'Rating' });
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('aria-label'))).toEqual([
      '1 of 5 stars',
      '2 of 5 stars',
      '3 of 5 stars',
      '4 of 5 stars',
      '5 of 5 stars',
    ]);
    expect(group.getAttribute('aria-orientation')).toBe('horizontal');
    expect(screen.getByRole('radio', { name: '3 of 5 stars' }).getAttribute('aria-checked')).toBe(
      'true'
    );
    // One Tab stop: the checked radio (not the first star).
    expect(
      radios
        .filter((radio) => radio.tabIndex === 0)
        .map((radio) => radio.getAttribute('aria-label'))
    ).toEqual(['3 of 5 stars']);
  });

  it('moves the single Tab stop to the new value when it changes from outside', async () => {
    const view = render(Rating, { props: { value: 2 } });
    const stops = () =>
      screen
        .getAllByRole('radio')
        .filter((radio) => radio.tabIndex === 0)
        .map((radio) => radio.getAttribute('aria-label'));
    expect(stops()).toEqual(['2 of 5 stars']);
    await view.rerender({ value: 4 });
    await waitFor(() => expect(stops()).toEqual(['4 of 5 stars']));
  });

  it('selects by click and keyboard, and fills up to the value', async () => {
    const onValueChange = vi.fn();
    const { container } = render(Rating, { props: { value: 2, onValueChange } });
    await fireEvent.click(screen.getByRole('radio', { name: '4 of 5 stars' }));
    expect(onValueChange).toHaveBeenLastCalledWith(4);
    expect(fills(container)).toEqual([1, 1, 1, 1, 0]);
    const four = screen.getByRole('radio', { name: '4 of 5 stars' });
    four.focus();
    await fireEvent.keyDown(four, { key: 'ArrowRight' });
    expect(onValueChange).toHaveBeenLastCalledWith(5);
    expect(screen.getByRole('radio', { name: '5 of 5 stars' }).getAttribute('aria-checked')).toBe(
      'true'
    );
  });

  it('mirrors the arrow keys in right-to-left text', async () => {
    const host = document.createElement('div');
    host.dir = 'rtl';
    document.body.append(host);
    const onValueChange = vi.fn();
    render(Rating, { target: host, props: { value: 2, onValueChange } });
    const two = screen.getByRole('radio', { name: '2 of 5 stars' });
    two.focus();
    await fireEvent.keyDown(two, { key: 'ArrowLeft' });
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    await fireEvent.keyDown(screen.getByRole('radio', { name: '3 of 5 stars' }), {
      key: 'ArrowRight',
    });
    expect(onValueChange).toHaveBeenLastCalledWith(2);
    host.remove();
  });

  it('supports half values with two labeled radios per star', async () => {
    const onValueChange = vi.fn();
    const { container } = render(Rating, { props: { allowHalf: true, onValueChange } });
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(10);
    expect(radios[4]?.getAttribute('aria-label')).toBe('2.5 of 5 stars');
    expect(radios[4]?.classList.contains('tx-rating__hit--start')).toBe(true);
    expect(radios[5]?.classList.contains('tx-rating__hit--end')).toBe(true);
    await fireEvent.click(screen.getByRole('radio', { name: '3.5 of 5 stars' }));
    expect(onValueChange).toHaveBeenLastCalledWith(3.5);
    expect(fills(container)).toEqual([1, 1, 1, 0.5, 0]);
    expect(container.querySelector('.tx-rating')?.classList.contains('tx-rating--half')).toBe(true);
  });

  it('clears on a second press of the selected star or Delete, only when clearable', async () => {
    const onValueChange = vi.fn();
    render(Rating, { props: { value: 3, clearable: true, onValueChange } });
    await fireEvent.click(screen.getByRole('radio', { name: '3 of 5 stars' }));
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    expect(
      screen.getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false')
    ).toBe(true);
    await fireEvent.click(screen.getByRole('radio', { name: '2 of 5 stars' }));
    await fireEvent.keyDown(screen.getByRole('radio', { name: '2 of 5 stars' }), { key: 'Delete' });
    expect(onValueChange).toHaveBeenLastCalledWith(0);
    cleanup();

    const kept = vi.fn();
    render(Rating, { props: { value: 3, onValueChange: kept } });
    await fireEvent.click(screen.getByRole('radio', { name: '3 of 5 stars' }));
    await fireEvent.keyDown(screen.getByRole('radio', { name: '3 of 5 stars' }), { key: 'Delete' });
    expect(kept).not.toHaveBeenCalled();
  });

  it('does not clear on the first press when focus selects before the click', async () => {
    const onValueChange = vi.fn();
    render(Rating, { props: { clearable: true, onValueChange } });
    const three = screen.getByRole('radio', { name: '3 of 5 stars' });
    // A real press: pointerdown, focus (the group selects on focus), click.
    await fireEvent.pointerDown(three);
    three.focus();
    await fireEvent.click(three);
    expect(three.getAttribute('aria-checked')).toBe('true');
    expect(onValueChange).toHaveBeenLastCalledWith(3);
    // A second press on it clears.
    await fireEvent.pointerDown(three);
    await fireEvent.click(three);
    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it('does not change when read-only or disabled', async () => {
    const onValueChange = vi.fn();
    render(Rating, { props: { value: 2, readonly: true, onValueChange } });
    await fireEvent.click(screen.getByRole('radio', { name: '4 of 5 stars' }));
    expect(onValueChange).not.toHaveBeenCalled();
    cleanup();
    render(Rating, { props: { value: 2, disabled: true } });
    expect(
      screen.getAllByRole('radio').every((radio) => (radio as HTMLButtonElement).disabled)
    ).toBe(true);
  });

  it('previews on mouse hover and restores on leave', async () => {
    const { container } = render(Rating, { props: { value: 1 } });
    await fireEvent.pointerEnter(screen.getByRole('radio', { name: '4 of 5 stars' }), {
      pointerType: 'mouse',
    });
    expect(fills(container)).toEqual([1, 1, 1, 1, 0]);
    await fireEvent.pointerLeave(screen.getByRole('radiogroup'));
    expect(fills(container)).toEqual([1, 0, 0, 0, 0]);
    await fireEvent.pointerEnter(screen.getByRole('radio', { name: '5 of 5 stars' }), {
      pointerType: 'touch',
    });
    expect(fills(container)).toEqual([1, 0, 0, 0, 0]);
  });

  it('shows a translated, locale-formatted summary and hides the label on request', () => {
    const { container } = render(Rating, {
      props: {
        value: 2.5,
        allowHalf: true,
        showValue: true,
        hideLabel: true,
        locale: 'de-DE',
        labels: {
          label: 'Bewertung',
          item: '{value} von {max} Sternen',
          summary: '{value} von {max}',
        },
      },
    });
    expect(screen.getByRole('radiogroup', { name: 'Bewertung' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '2,5 von 5 Sternen' })).toBeTruthy();
    expect(container.querySelector('output')?.textContent).toBe('2,5 von 5');
    expect(container.querySelector('output')?.getAttribute('aria-live')).toBe('polite');
    expect(
      container.querySelector('.tx-rating__label')?.classList.contains('tx-rating__label--hidden')
    ).toBe(true);
  });

  it('says "Not rated" when empty and clamps the star count', () => {
    const { container } = render(Rating, { props: { max: 12, showValue: true } });
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    expect(container.querySelector('output')?.textContent).toBe('Not rated');
  });

  it('submits the value with a name', async () => {
    const { container } = render(Rating, { props: { value: 3, name: 'score' } });
    const form = document.createElement('form');
    document.body.append(form);
    form.append(container);
    await Promise.resolve();
    expect(new FormData(form).get('score')).toBe('3');
    form.remove();
  });

  it('applies size and tone variants', () => {
    const { container } = render(Rating, { props: { size: 'lg', tone: 'primary' } });
    const root = container.querySelector('.tx-rating');
    expect(root?.classList.contains('tx-rating--lg')).toBe(true);
    expect(root?.classList.contains('tx-rating--primary')).toBe(true);
  });
});

describe('Rating display', () => {
  it('is a labeled image showing any fraction, with no radios', () => {
    const { container } = render(Rating, { props: { value: 4.3, display: true, showValue: true } });
    const image = screen.getByRole('img', { name: 'Rated 4.3 out of 5' });
    expect(image.getAttribute('data-tx-rating')).toBe('display');
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    const shown = fills(container);
    expect(shown.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(shown[4]).toBeCloseTo(0.3, 5);
    expect(container.querySelector('.tx-rating__value')?.getAttribute('aria-hidden')).toBe('true');
  });
});
