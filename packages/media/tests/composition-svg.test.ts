import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CompositionSvg from '../src/composition-svg/CompositionSvg.svelte';
import {
  compositionToSvgString,
  escapeXml,
  renderCompositionSvg,
  serializeSvg,
} from '../src/composition-svg/index.ts';

afterEach(() => cleanup());

function scene(layers: unknown[] = []) {
  return { version: 1, width: 400, height: 300, layers };
}

function frame(x = 10, y = 20, width = 100, height = 80) {
  return { x, y, width, height };
}

describe('escapeXml', () => {
  it('escapes markup characters', () => {
    expect(escapeXml(`a&b<c>"d"'e'`)).toBe('a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;');
  });
});

describe('renderCompositionSvg', () => {
  it('renders shapes, text as text, and safe images into an accessible SVG', () => {
    const result = renderCompositionSvg(
      scene([
        {
          id: 'bg',
          type: 'shape',
          shape: 'rectangle',
          frame: frame(0, 0, 400, 300),
          fill: {
            kind: 'linear-gradient',
            angle: 90,
            stops: [
              { offset: 0, color: '#16324f' },
              { offset: 1, color: '#4c91a8' },
            ],
          },
        },
        {
          id: 'dot',
          type: 'shape',
          shape: 'ellipse',
          frame: frame(40, 40, 60, 60),
          fill: { kind: 'solid', color: '#ffffff' },
          opacity: 0.9,
        },
        {
          id: 'headline',
          type: 'text',
          frame: frame(20, 120, 360, 60),
          text: 'Hello <script>',
          paint: { kind: 'solid', color: '#ffffff' },
          fontSize: 24,
          fontWeight: 700,
          align: 'center',
        },
        {
          id: 'photo',
          type: 'image',
          frame: frame(280, 20, 100, 100),
          src: '/assets/portrait.webp',
          alt: 'Fictional portrait',
          fit: 'cover',
        },
      ])
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.root.tag).toBe('svg');
    expect(result.root.attrs.role).toBe('img');
    expect(result.root.attrs.tabindex).toBe('0');
    expect(result.root.attrs['aria-label']).toBe('Composition');

    const svg = serializeSvg(result.root);
    expect(svg).toContain('<text');
    expect(svg).toContain('Hello &lt;script&gt;');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('linearGradient');
    expect(svg).toContain('href="/assets/portrait.webp"');
    expect(svg).toContain('aria-label="Fictional portrait"');
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });

  it('rejects unsafe image sources during validation', () => {
    const result = renderCompositionSvg(
      scene([
        {
          id: 'bad',
          type: 'image',
          frame: frame(),
          src: 'javascript:alert(1)',
          alt: 'x',
        },
      ])
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'unsafe-source')).toBe(true);
  });

  it('applies masks and numeric transforms', () => {
    const result = renderCompositionSvg(
      scene([
        {
          id: 'masked',
          type: 'shape',
          shape: 'rectangle',
          frame: frame(0, 0, 200, 200),
          fill: { kind: 'solid', color: '#ff0000' },
          transform: { rotateDeg: 15, scaleX: 1.2 },
          mask: { layerId: 'hole', mode: 'alpha' },
        },
        {
          id: 'hole',
          type: 'shape',
          shape: 'ellipse',
          frame: frame(40, 40, 120, 120),
          fill: { kind: 'solid', color: '#ffffff' },
        },
      ])
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const svg = serializeSvg(result.root);
    expect(svg).toContain('mask="url(#tx-mask-hole)"');
    expect(svg).toContain('id="tx-mask-hole"');
    expect(svg).toContain('rotate(15');
    expect(svg).toContain('scale(1.2');
  });

  it('compositionToSvgString returns a full document string', () => {
    const result = compositionToSvgString(
      scene([
        {
          id: 'line',
          type: 'shape',
          shape: 'line',
          frame: frame(0, 0, 50, 50),
          stroke: { kind: 'solid', color: '#000000' },
          strokeWidth: 2,
        },
      ]),
      { title: 'Line art' }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('<title>Line art</title>');
    expect(result.svg).toContain('<line');
  });
});

describe('CompositionSvg component', () => {
  it('mounts an svg with text content and a focusable shell', () => {
    const composition = scene([
      {
        id: 'label',
        type: 'text',
        frame: frame(10, 40, 200, 40),
        text: 'Accessible text',
        paint: { kind: 'solid', color: '#111111' },
        fontSize: 18,
      },
    ]);
    const { container } = render(CompositionSvg, {
      props: { composition, title: 'Demo scene' },
    });
    const shell = container.querySelector('[data-tx-composition-svg="true"]');
    expect(shell?.tagName.toLowerCase()).toBe('figure');
    expect(shell?.getAttribute('aria-label')).toBe('Demo scene');
    expect(shell?.getAttribute('tabindex')).toBe('0');
    expect(shell?.querySelector('svg text')?.textContent).toBe('Accessible text');
  });

  it('shows an alert when the composition is invalid', () => {
    const { container } = render(CompositionSvg, {
      props: {
        composition: scene([
          {
            id: 'bad',
            type: 'image',
            frame: frame(),
            src: 'javascript:alert(1)',
            alt: 'x',
          },
        ]),
      },
    });
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.getAttribute('data-tx-composition-ok')).toBe('false');
  });
});
