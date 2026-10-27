import { render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_LABELS } from '../src/labels.ts';
import { PLAYER_LOADERS } from '../src/loaders.ts';
import { applyMediaPolicy, TRUST_PINNED_IDS } from '../src/media-policy.ts';
import Player from '../src/Player.svelte';

const labels = DEFAULT_PLAYER_LABELS;
const page = (children: unknown[]) => ({ id: 'layout-page', props: { title: 'Media' }, children });

async function paint(children: unknown[], extra: Record<string, unknown> = {}) {
  const view = render(Player, {
    props: { blueprint: page(children), loaders: PLAYER_LOADERS, ...extra },
  });
  await screen.findByRole('heading', { level: 1, name: 'Media' }, { timeout: 5000 });
  await waitFor(
    () => expect(view.container.querySelector('[data-tx-player-skeleton]')).toBeNull(),
    {
      timeout: 10_000,
    }
  );
  return view;
}

describe('media policy', () => {
  it('pins trust to untrusted on every id that takes it', () => {
    for (const id of TRUST_PINNED_IDS) {
      expect(applyMediaPolicy(id, { trust: 'developer', alt: 'x' }, labels).trust).toBe(
        'untrusted'
      );
      expect(applyMediaPolicy(id, { alt: 'x' }, labels).trust).toBe('untrusted');
    }
  });

  it('leaves non-media props as the same object', () => {
    const props = { title: 'Card', trust: 'developer' };
    expect(applyMediaPolicy('layout-card', props, labels)).toBe(props);
    const image = { block: { type: 'image', src: 'media/a.png', alt: 'A' } };
    expect(applyMediaPolicy('blocks-media', image, labels)).toBe(image);
  });

  it('turns off video autoplay and keeps its controls on', () => {
    const out = applyMediaPolicy(
      'blocks-media',
      {
        block: {
          type: 'video',
          src: 'media/v.mp4',
          label: 'Demo',
          autoplay: true,
          muted: true,
          controls: false,
        },
      },
      labels
    );
    expect(out.block).toMatchObject({ autoplay: false, controls: true, muted: true });
  });

  it('gives a blank media-image alt the host’s no-description label', () => {
    expect(applyMediaPolicy('media-image', { alt: '  ' }, labels).alt).toBe(labels.mediaNoAlt);
    expect(applyMediaPolicy('media-image', { alt: 'Harbor' }, labels).alt).toBe('Harbor');
  });
});

describe('media nodes painted in the player', () => {
  it('never autoplays agent video and keeps it keyboard-operable', async () => {
    const { container } = await paint([
      {
        id: 'blocks-media',
        props: {
          block: {
            type: 'video',
            src: 'media/demo.mp4',
            width: 640,
            height: 360,
            label: 'Fictional demo',
            autoplay: true,
            muted: true,
            controls: false,
          },
        },
      },
    ]);
    const video = await waitFor(() => {
      const element = container.querySelector('video');
      expect(element).not.toBeNull();
      return element as HTMLVideoElement;
    });
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.autoplay).toBe(false);
    expect(video.hasAttribute('controls')).toBe(true);
    expect(video.getAttribute('aria-label')).toBe('Fictional demo');
  });

  it('keeps media-image on the untrusted policy whatever trust the blueprint claims', async () => {
    const { container } = await paint(
      [
        {
          id: 'media-image',
          props: {
            src: 'https://images.example/harbor.png',
            srcset: 'http://images.example/harbor-2x.png 2x',
            alt: 'Fictional harbor',
            trust: 'developer',
          },
        },
      ],
      // Let the developer tier validate the HTTP candidate so this exercises
      // the player's paint-time clamp back to untrusted media policy.
      { tier: 'developer' }
    );
    const img = await waitFor(() => {
      const element = container.querySelector('img');
      expect(element).not.toBeNull();
      return element as HTMLImageElement;
    });
    expect(img.getAttribute('src')).toBe('https://images.example/harbor.png');
    // An HTTP srcset passes only developer trust; untrusted drops it.
    expect(img.getAttribute('srcset')).toBeNull();
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.getAttribute('alt')).toBe('Fictional harbor');
  });

  it('exposes a text alternative for a media-image with a blank alt', async () => {
    const { container } = await paint([
      { id: 'media-image', props: { src: 'https://images.example/a.png', alt: '' } },
    ]);
    const img = await waitFor(() => {
      const element = container.querySelector('img');
      expect(element).not.toBeNull();
      return element as HTMLImageElement;
    });
    expect(img.getAttribute('alt')).toBe('Image without a description');
  });

  it('keeps the block alt contract: decorative is silent, undescribed is refused', async () => {
    const { container } = await paint([
      {
        id: 'blocks-media',
        props: {
          block: { type: 'image', src: 'media/line.png', decorative: true, width: 640, height: 4 },
        },
      },
    ]);
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('alt')).toBe(''));
    const refused = render(Player, {
      props: {
        blueprint: page([
          {
            id: 'blocks-media',
            props: { block: { type: 'image', src: 'media/a.png', width: 640, height: 360 } },
          },
        ]),
        loaders: PLAYER_LOADERS,
      },
    });
    expect(refused.container.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be validated'
    );
    expect(refused.container.querySelector('img')).toBeNull();
  });

  it('keeps media inert until its painter resolves', async () => {
    const { container } = render(Player, {
      props: {
        blueprint: page([
          {
            id: 'blocks-media',
            props: {
              block: { type: 'video', src: 'media/m.mp4', label: 'Clip', width: 640, height: 360 },
            },
          },
        ]),
        loaders: { ...PLAYER_LOADERS, 'blocks-media': () => new Promise(() => {}) },
        loadTimeoutMs: 0,
      },
    });
    await screen.findByRole('heading', { level: 1, name: 'Media' }, { timeout: 5000 });
    const skeleton = container.querySelector('[data-tx-player-skeleton="blocks-media"]');
    expect(skeleton?.hasAttribute('inert')).toBe(true);
    expect(container.querySelector('video')).toBeNull();
  });
});
