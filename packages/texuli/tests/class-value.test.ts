// @vitest-environment happy-dom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ClassValueHarness from './fixtures/ClassValueHarness.svelte';

describe('ClassValue on styled roots', () => {
  it('renders string, array (with falsy) and object class maps on Button, Badge, Card and Input', () => {
    render(ClassValueHarness);

    const buttonString = screen.getByTestId('cv-button-string');
    expect(buttonString.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['tx-button', 'cv-string'])
    );

    const buttonArray = screen.getByTestId('cv-button-array');
    const arrayClasses = buttonArray.className.split(/\s+/);
    expect(arrayClasses).toEqual(expect.arrayContaining(['tx-button', 'cv-full', 'cv-array']));
    expect(arrayClasses).not.toContain('cv-quiet');

    const buttonObject = screen.getByTestId('cv-button-object');
    const objectClasses = buttonObject.className.split(/\s+/);
    expect(objectClasses).toEqual(expect.arrayContaining(['tx-button', 'cv-object']));
    expect(objectClasses).not.toContain('cv-off');

    const badge = screen.getByTestId('cv-badge');
    expect(badge.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['tx-badge', 'cv-badge', 'cv-full'])
    );

    const card = screen.getByTestId('cv-card');
    expect(card.className.split(/\s+/)).toEqual(expect.arrayContaining(['tx-card', 'cv-card']));

    const input = screen.getByTestId('cv-input');
    const inputClasses = input.className.split(/\s+/);
    expect(inputClasses).toEqual(expect.arrayContaining(['cv-input']));
    expect(inputClasses).not.toContain('cv-quiet');
  });
});
