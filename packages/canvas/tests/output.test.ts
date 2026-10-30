import { render, screen } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';
import { describe, expect, it } from 'vitest';
import { canvasToSvg } from '../src/export/index.ts';
import { checkCanvasDraft, createCanvasPlayerHost } from '../src/host/index.ts';
import { CANVAS_LIMITS, type CanvasDocument, createCanvas } from '../src/model/index.ts';
import { CanvasViewer } from '../src/viewer/index.ts';
import { everyShape, timed } from './fixtures.ts';

const resolveImage = (ref: string) =>
  ref === 'assets/logo-1' ? 'https://example.com/logo.png' : `javascript:alert("${ref}")`;

describe('CanvasViewer', () => {
  it('paints the canvas as a named image with its structure as text in reading order', () => {
    const { container } = render(CanvasViewer, { props: { canvas: everyShape(), resolveImage } });
    const image = screen.getByRole('img', { name: 'Launch plan' });
    expect(image.tagName.toLowerCase()).toBe('svg');
    const items = [...container.querySelectorAll('figcaption li')].map((li) => li.textContent);
    expect(items[0]).toBe('Week one (Frame)');
    expect(items).toContain('Connector from Ready? (Diamond) to Review (Rectangle): yes');
    // The resolved image passed the URL policy; a refused one would paint its alt.
    expect(container.querySelector('image')?.getAttribute('href')).toBe(
      'https://example.com/logo.png'
    );
  });

  it('paints a refused image URL as its alt text, never as a link', () => {
    const doc = everyShape();
    const { container } = render(CanvasViewer, {
      props: { canvas: doc, resolveImage: () => 'javascript:alert(1)' },
    });
    expect(container.querySelector('image')).toBeNull();
    expect(container.textContent).toContain('Image unavailable: Example logo');
  });
});

describe('SVG and PNG export', () => {
  it('writes escaped SVG through the markup builders, images through the URL policy', () => {
    const doc = everyShape();
    (doc.shapes[1] as { text: string }).text = '</text><script>alert(1)</script>&';
    const svg = canvasToSvg(doc, { resolveImage });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).not.toContain('<script');
    expect(svg).toContain('&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;');
    expect(svg).toContain('href="https://example.com/logo.png"');
    expect(svg).toContain('<title id="tx-canvas-title">Launch plan</title>');
    const refused = canvasToSvg(doc, { resolveImage: () => 'javascript:alert(1)' });
    expect(refused).not.toContain('javascript:');
    expect(refused).toContain('>Example logo</text>');
    // Only the chosen shapes (and connectors between them).
    const part = canvasToSvg(doc, { ids: ['start', 'choice'] });
    expect(part).toContain('Ready?');
    expect(part).not.toContain('Week one');
  });

  it('exports the shape cap in linear time', () => {
    const shapes = Array.from({ length: CANVAS_LIMITS.shapes }, (_, i) => ({
      id: `r${i}`,
      type: 'rect' as const,
      x: (i % 100) * 20,
      y: Math.floor(i / 100) * 20,
      width: 16,
      height: 16,
      text: `<${i}>`,
    }));
    const doc: CanvasDocument = { ...createCanvas(), shapes };
    const small: CanvasDocument = { ...createCanvas(), shapes: shapes.slice(0, 500) };
    const t1 = timed(() => canvasToSvg(small));
    const t2 = timed(() => canvasToSvg(doc));
    expect(t2).toBeLessThan(5_000);
    expect(t2).toBeLessThan(t1 * 30 + 300);
  });
});

describe('the player canvas host', () => {
  it('checks canvases at the tier and refuses invalid ones', () => {
    expect(checkCanvasDraft(everyShape(), 'untrusted').ok).toBe(true);
    const bad = { ...everyShape(), shapes: [{ id: 'x', type: 'script' }] };
    const result = checkCanvasDraft(bad, 'untrusted');
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ code: 'unknown-shape', path: '$.shapes[0].type' });
  });

  it('mounts the viewer into the target and unmounts it on cleanup; invalid canvases paint nothing', async () => {
    const host = createCanvasPlayerHost({ resolveImage });
    const target = document.createElement('div');
    document.body.append(target);
    const cleanup = host.present({
      canvas: everyShape(),
      tier: 'untrusted',
      label: 'Player',
      active: true,
      target,
    });
    for (let i = 0; i < 20 && !target.querySelector('svg'); i += 1) await tick();
    flushSync();
    expect(target.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBe('Launch plan');
    cleanup?.();
    expect(target.querySelector('svg')).toBeNull();
    expect(
      host.present({
        canvas: { format: 'nope' },
        tier: 'untrusted',
        label: 'P',
        active: true,
        target,
      })
    ).toBeUndefined();
    target.remove();
  });
});
