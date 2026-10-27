import { describe, expect, it } from 'vitest';
import displaySource from '../src/display/ChatMessageDisplay.svelte?raw';
import listSource from '../src/thread/MessageList.svelte?raw';

// The package ships its Svelte source, so the style block in the component
// file is the shipped CSS. The bubble tail is direction-aware visual grammar:
// it must sit on the message's inline-end so it flips under RTL. It is
// therefore painted with logical border-radius properties, never a physical
// four-corner shorthand that would keep the tail on one fixed side.
function styleBlock(source: string): string {
  const open = source.indexOf('<style>');
  const close = source.indexOf('</style>', open);
  return open === -1 || close === -1 ? '' : source.slice(open + 7, close);
}

describe('logical bubble tails (RTL)', () => {
  it('points MessageList bubble tails with logical border-radius properties', () => {
    const css = styleBlock(listSource);
    expect(css).toContain('border-end-start-radius');
    expect(css).toContain('border-end-end-radius');
    expect(css).not.toContain('1rem 1rem 1rem 0.25rem');
    expect(css).not.toContain('1rem 1rem 0.25rem 1rem');
  });

  it('points display transcript bubble tails with logical border-radius properties', () => {
    const css = styleBlock(displaySource);
    expect(css).toContain('border-end-start-radius');
    expect(css).toContain('border-end-end-radius');
    expect(css).not.toContain('1rem 1rem 1rem 0.25rem');
    expect(css).not.toContain('1rem 1rem 0.25rem 1rem');
  });
});
