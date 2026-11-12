import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Design {
  shortcode: string;
  group: 'face' | 'object' | 'person' | 'composition' | 'flag';
}

const DESIGNS: readonly Design[] = [
  ...[
    'grinning_face',
    'grinning_face_with_big_eyes',
    'grinning_face_with_smiling_eyes',
    'grinning_squinting_face',
    'grinning_face_with_sweat',
    'slightly_smiling_face',
    'smiling_face_with_smiling_eyes',
    'smiling_face_with_halo',
    'smiling_face_with_hearts',
    'smiling_face_with_heart_eyes',
    'star_struck',
    'smiling_face',
    'smiling_face_with_tear',
    'smiling_face_with_open_hands',
    'smiling_face_with_sunglasses',
    'thinking_face',
    'face_with_raised_eyebrow',
    'crying_face',
    'loudly_crying_face',
    'angry_face',
    'face_screaming_in_fear',
    'ghost',
  ].map((name) => ({ shortcode: `:${name}:`, group: 'face' as const })),
  ...[
    'red_heart',
    'pink_heart',
    'orange_heart',
    'yellow_heart',
    'green_heart',
    'blue_heart',
    'purple_heart',
    'white_heart',
    'rocket',
    'tulip',
    'sunflower',
    'hibiscus',
    'closed_book',
    'open_book',
    'hot_beverage',
    'pizza',
    'sun',
    'crescent_moon',
    'fire',
    'star',
    'wrapped_gift',
    'teddy_bear',
    'balloon',
    'camera',
    'musical_note',
  ].map((name) => ({ shortcode: `:${name}:`, group: 'object' as const })),
  ...[
    'thumbs_up_light_skin_tone',
    'thumbs_up_medium_light_skin_tone',
    'thumbs_up_medium_skin_tone',
    'thumbs_up_medium_dark_skin_tone',
    'thumbs_up_dark_skin_tone',
    'woman',
    'woman_light_skin_tone',
    'woman_medium_light_skin_tone',
    'woman_medium_skin_tone',
    'woman_medium_dark_skin_tone',
    'woman_dark_skin_tone',
  ].map((name) => ({ shortcode: `:${name}:`, group: 'person' as const })),
  ...[
    'woman_technologist',
    'man_technologist',
    'heart_on_fire',
    'family_man_woman_girl',
    'rainbow_flag',
    'woman_and_man_holding_hands',
  ].map((name) => ({ shortcode: `:${name}:`, group: 'composition' as const })),
  ...[
    'flag_united_states',
    'flag_canada',
    'flag_united_kingdom',
    'flag_japan',
    'flag_brazil',
    'flag_germany',
    'flag_france',
    'flag_england',
  ].map((name) => ({ shortcode: `:${name}:`, group: 'flag' as const })),
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CATALOG_PATH = resolve(ROOT, 'packages/emojis/src/data/catalog.json');
const OUT = resolve(ROOT, 'artwork/emojis/originals');
const PROVENANCE = resolve(ROOT, 'artwork/emojis/provenance.json');
const DATE = '2026-11-12';
const TONE_HEX: Readonly<Record<string, string>> = {
  '1f3fb': '#fff0dc',
  '1f3fc': '#f6d6bd',
  '1f3fd': '#e3b48f',
  '1f3fe': '#bc805a',
  '1f3ff': '#80513b',
};
const TONE_NAMES: Readonly<Record<string, string>> = {
  light_skin_tone: '1f3fb',
  medium_light_skin_tone: '1f3fc',
  medium_skin_tone: '1f3fd',
  medium_dark_skin_tone: '1f3fe',
  dark_skin_tone: '1f3ff',
};
const FACE_COLORS = ['#ffc94a', '#ffcc55', '#ffd166', '#ffbf47', '#ffd27a'];

function shape(tag: string, attrs: Record<string, string | number>): string {
  return `<${tag} ${Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ')} />`;
}
const circle = (
  cx: number,
  cy: number,
  r: number,
  fill: string,
  extra: Record<string, string | number> = {}
) => shape('circle', { cx, cy, r, fill, ...extra });
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  rx = 0,
  extra: Record<string, string | number> = {}
) => shape('rect', { x, y, width, height, rx, fill, ...extra });
const path = (d: string, fill: string, extra: Record<string, string | number> = {}) =>
  shape('path', { d, fill, ...extra });

function faceArt(index: number, shortcode: string): string {
  const parts = [
    circle(32, 33, 25, FACE_COLORS[index % FACE_COLORS.length], {
      stroke: '#b86631',
      'stroke-width': 1.5,
    }),
  ];
  if (shortcode === ':smiling_face_with_halo:')
    parts.push(
      shape('ellipse', {
        cx: 32,
        cy: 7,
        rx: 14,
        ry: 4,
        fill: 'none',
        stroke: '#fff5c2',
        'stroke-width': 3,
      })
    );
  if (shortcode.includes('heart')) {
    parts.push(path('M22 23 C18 17 9 20 12 27 L22 36 L32 27 C35 20 26 17 22 23 Z', '#f06a83'));
    parts.push(path('M42 23 C38 17 29 20 32 27 L42 36 L52 27 C55 20 46 17 42 23 Z', '#f06a83'));
  } else if (shortcode === ':star_struck:') {
    parts.push(
      path('M20 17 L22 23 L28 23 L23 27 L25 33 L20 29 L15 33 L17 27 L12 23 L18 23 Z', '#fff9e8')
    );
    parts.push(
      path('M43 17 L45 23 L51 23 L46 27 L48 33 L43 29 L38 33 L40 27 L35 23 L41 23 Z', '#fff9e8')
    );
  } else if (shortcode === ':smiling_face_with_sunglasses:') {
    parts.push(rect(10, 23, 19, 10, '#4b3d58', 4));
    parts.push(rect(35, 23, 19, 10, '#4b3d58', 4));
    parts.push(
      shape('line', { x1: 29, y1: 27, x2: 35, y2: 27, stroke: '#4b3d58', 'stroke-width': 3 })
    );
  } else {
    const eyeY = shortcode === ':face_screaming_in_fear:' ? 26 : 29;
    const eyeR = shortcode === ':grinning_face_with_big_eyes:' ? 3.7 : 2.4;
    if (
      shortcode === ':grinning_face_with_smiling_eyes:' ||
      shortcode === ':grinning_squinting_face:'
    ) {
      parts.push(
        path('M17 29 Q23 35 29 29 M35 29 Q41 35 47 29', 'none', {
          stroke: '#342f43',
          'stroke-width': 2.5,
          'stroke-linecap': 'round',
        })
      );
    } else {
      parts.push(circle(23, eyeY, eyeR, '#342f43'), circle(41, eyeY, eyeR, '#342f43'));
    }
  }
  if (shortcode === ':face_with_raised_eyebrow:')
    parts.push(
      path('M16 20 Q22 15 29 20 M37 18 L48 18', 'none', {
        stroke: '#6e493a',
        'stroke-width': 2.5,
        'stroke-linecap': 'round',
      })
    );
  if (shortcode === ':thinking_face:')
    parts.push(
      path('M41 42 Q48 40 49 47 L42 50', 'none', {
        stroke: '#805c47',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      })
    );
  if (shortcode === ':angry_face:') {
    parts.push(
      path('M15 21 L27 24 M37 24 L49 21', 'none', {
        stroke: '#8e423c',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      })
    );
    parts.push(
      path('M22 46 Q32 37 42 46', 'none', {
        stroke: '#55333b',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      })
    );
  } else if (shortcode === ':crying_face:' || shortcode === ':loudly_crying_face:') {
    parts.push(
      path('M22 34 Q32 40 42 34', 'none', {
        stroke: '#55333b',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      })
    );
    parts.push(
      path('M22 33 Q17 40 21 46 Q25 42 22 33 M42 33 Q37 40 41 46 Q45 42 42 33', '#62aee7')
    );
  } else if (shortcode === ':face_screaming_in_fear:') {
    parts.push(circle(32, 43, 7, '#593748'));
  } else {
    parts.push(
      path('M20 38 Q32 52 44 38', 'none', {
        stroke: '#633d37',
        'stroke-width': 3,
        'stroke-linecap': 'round',
      })
    );
  }
  parts.push(circle(17, 18, 4, '#fff0b7', { opacity: 0.65 }));
  if (shortcode === ':grinning_face_with_sweat:')
    parts.push(path('M49 11 C45 17 45 20 49 22 C53 20 53 17 49 11 Z', '#5daee7'));
  if (shortcode === ':smiling_face_with_tear:')
    parts.push(path('M47 34 C43 40 43 43 47 45 C51 43 51 40 47 34 Z', '#5daee7'));
  if (shortcode === ':ghost:') {
    return [
      path(
        'M11 52 L11 26 C11 13 21 6 32 6 C43 6 53 13 53 26 L53 53 L44 47 L36 53 L28 47 L20 53 Z',
        '#fbf7ff',
        { stroke: '#8778a7', 'stroke-width': 2 }
      ),
      circle(24, 29, 3, '#534c69'),
      circle(40, 29, 3, '#534c69'),
      path('M26 39 Q32 44 38 39', 'none', { stroke: '#6b5877', 'stroke-width': 2 }),
    ].join('');
  }
  return parts.join('');
}

function handArt(tone: string): string {
  const skin = TONE_HEX[tone] ?? '#e9b88f';
  return `<g>${path('M28 53 C24 51 22 47 22 40 L22 27 C22 23 28 23 29 27 L30 34 L31 16 C31 11 37 11 38 16 L38 33 L40 21 C41 17 46 18 46 22 L45 35 L48 28 C50 25 55 28 53 32 L51 44 C50 51 45 55 38 56 Z', skin, { stroke: '#704938', 'stroke-width': 1.7, 'stroke-linejoin': 'round' })}${path('M32 36 L32 42 M39 35 L39 42 M46 36 L45 41', 'none', { stroke: '#b98263', 'stroke-width': 1.2, 'stroke-linecap': 'round' })}</g>`;
}

function personArt(shortcode: string): string {
  const toneName = Object.keys(TONE_NAMES).find((item) => shortcode.includes(item));
  const tone = toneName ? (TONE_NAMES[toneName] ?? '1f3fc') : '1f3fc';
  const skin = TONE_HEX[tone] ?? '#f6d6bd';
  if (shortcode.startsWith(':thumbs_up_')) return handArt(tone);
  const isWoman = shortcode.includes('woman');
  return [
    shape('ellipse', { cx: 32, cy: 22, rx: 15, ry: 17, fill: isWoman ? '#4b355a' : '#594754' }),
    circle(32, 25, 12, skin, { stroke: '#795a4a', 'stroke-width': 1 }),
    rect(12, 41, 40, 23, isWoman ? '#9474c9' : '#606ba9', 12),
    circle(28, 24, 1.3, '#342f43'),
    circle(36, 24, 1.3, '#342f43'),
    path('M28 31 Q32 34 36 31', 'none', {
      stroke: '#704938',
      'stroke-width': 1.6,
      'stroke-linecap': 'round',
    }),
    ...(isWoman ? [path('M17 22 Q16 5 32 5 Q49 6 47 25 L41 17 L24 16 Z', '#4b355a')] : []),
  ].join('');
}

function objectArt(shortcode: string, index: number): string {
  const hearts: Record<string, string> = {
    ':red_heart:': '#ef5b70',
    ':pink_heart:': '#f088a8',
    ':orange_heart:': '#f28c45',
    ':yellow_heart:': '#f4c94f',
    ':green_heart:': '#60b886',
    ':blue_heart:': '#5e9de1',
    ':purple_heart:': '#9870c9',
    ':white_heart:': '#fff7ef',
  };
  if (hearts[shortcode])
    return path(
      'M32 55 C27 49 8 35 8 22 C8 7 25 5 32 18 C40 5 56 8 56 22 C56 35 39 49 32 55 Z',
      hearts[shortcode] ?? '#ef5b70',
      { stroke: '#8f526d', 'stroke-width': 2 }
    );
  switch (shortcode) {
    case ':rocket:':
      return [
        path('M22 42 C19 27 28 10 45 7 C48 23 39 39 22 42 Z', '#f2f0ff', {
          stroke: '#69588b',
          'stroke-width': 2,
        }),
        circle(37, 20, 5, '#73c8dc', { stroke: '#665a89', 'stroke-width': 2 }),
        path('M22 42 L11 52 L12 39 L22 31 Z M22 42 L34 48 L29 38 Z', '#df8d73'),
        path('M20 45 L16 56 L27 49 Z', '#f6bd4d'),
      ].join('');
    case ':tulip:':
    case ':sunflower:':
    case ':hibiscus:': {
      const petals = Array.from({ length: shortcode === ':sunflower:' ? 10 : 5 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / (shortcode === ':sunflower:' ? 10 : 5);
        const x = 32 + Math.cos(angle) * 14;
        const y = 23 + Math.sin(angle) * 14;
        return shape('ellipse', {
          cx: x.toFixed(1),
          cy: y.toFixed(1),
          rx: 6,
          ry: 10,
          fill: shortcode === ':sunflower:' ? '#f6bd4d' : '#e979a5',
          transform: `rotate(${((angle * 180) / Math.PI).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`,
        });
      }).join('');
      return `${path('M32 37 Q27 47 28 60 L36 60 Q35 47 32 37', '#64aa77')}${path('M31 48 Q21 40 16 46 Q22 53 31 52', '#76bd83')}${petals}${circle(32, 23, 7, shortcode === ':sunflower:' ? '#765036' : '#f6bd4d')}`;
    }
    case ':closed_book:':
      return [
        rect(14, 9, 37, 47, '#9368b9', 4, { stroke: '#574376', 'stroke-width': 2 }),
        rect(20, 9, 4, 47, '#f8e9cf'),
        path('M30 22 L41 22 M30 29 L43 29 M30 36 L40 36', 'none', {
          stroke: '#f5d986',
          'stroke-width': 2,
        }),
      ].join('');
    case ':open_book:':
      return [
        path('M8 16 Q20 11 32 19 L32 55 Q20 47 8 52 Z', '#fff3d5', {
          stroke: '#76618b',
          'stroke-width': 2,
        }),
        path('M56 16 Q44 11 32 19 L32 55 Q44 47 56 52 Z', '#f6e7c7', {
          stroke: '#76618b',
          'stroke-width': 2,
        }),
        path('M14 25 L26 27 M14 32 L26 34 M38 27 L50 25 M38 34 L50 32', 'none', {
          stroke: '#bd9e72',
          'stroke-width': 1.5,
        }),
      ].join('');
    case ':hot_beverage:':
      return [
        path('M18 23 L46 23 L43 51 Q32 58 21 51 Z', '#b46d56', {
          stroke: '#6b5064',
          'stroke-width': 2,
        }),
        shape('ellipse', { cx: 32, cy: 24, rx: 14, ry: 4, fill: '#51384b' }),
        shape('ellipse', {
          cx: 50,
          cy: 35,
          rx: 7,
          ry: 9,
          fill: 'none',
          stroke: '#6b5064',
          'stroke-width': 3,
        }),
        path('M24 16 Q19 10 24 5 M33 16 Q28 10 33 5 M41 16 Q36 10 41 5', 'none', {
          stroke: '#ad8cba',
          'stroke-width': 2,
          'stroke-linecap': 'round',
        }),
      ].join('');
    case ':pizza:':
      return [
        path('M8 17 L53 12 L39 57 Z', '#f7c64f', {
          stroke: '#996247',
          'stroke-width': 2,
          'stroke-linejoin': 'round',
        }),
        path('M11 20 L49 16', 'none', { stroke: '#d95f55', 'stroke-width': 4 }),
        circle(25, 29, 3, '#d94c4f'),
        circle(39, 26, 3, '#d94c4f'),
        circle(30, 42, 3, '#d94c4f'),
        circle(20, 21, 1.7, '#f2e6b9'),
      ].join('');
    case ':sun:':
      return (
        Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI * i) / 4;
          return shape('line', {
            x1: 32 + Math.cos(a) * 19,
            y1: 32 + Math.sin(a) * 19,
            x2: 32 + Math.cos(a) * 25,
            y2: 32 + Math.sin(a) * 25,
            stroke: '#e79b42',
            'stroke-width': 4,
            'stroke-linecap': 'round',
          });
        }).join('') + circle(32, 32, 17, '#f7c94f', { stroke: '#e79b42', 'stroke-width': 2 })
      );
    case ':crescent_moon:':
      return path('M47 9 C22 11 15 42 35 54 C21 53 10 42 10 29 C10 13 26 2 42 7 Z', '#f5d477', {
        stroke: '#a98a59',
        'stroke-width': 2,
      });
    case ':fire:':
      return [
        path(
          'M32 58 C8 55 17 31 29 23 C27 38 37 35 39 27 C48 35 53 47 44 55 C41 57 37 58 32 58 Z',
          '#ef754d',
          { stroke: '#a8544c', 'stroke-width': 2 }
        ),
        path('M32 53 C23 50 28 41 34 37 C34 45 42 43 41 38 C48 47 42 54 32 53 Z', '#ffd36a'),
      ].join('');
    case ':star:':
      return path(
        'M32 5 L39 23 L58 24 L43 36 L48 55 L32 44 L16 55 L21 36 L6 24 L25 23 Z',
        '#f5c957',
        { stroke: '#ae7e49', 'stroke-width': 2, 'stroke-linejoin': 'round' }
      );
    case ':wrapped_gift:':
      return [
        rect(10, 25, 44, 32, '#da7184', 3, { stroke: '#80546f', 'stroke-width': 2 }),
        rect(8, 20, 48, 10, '#f28e8a', 3),
        rect(28, 20, 8, 37, '#f4d46e'),
        path(
          'M32 20 C17 20 17 8 24 8 C30 8 32 14 32 20 C32 14 39 6 45 10 C51 15 43 21 32 20',
          '#f4d46e',
          { stroke: '#99764e', 'stroke-width': 1.5 }
        ),
      ].join('');
    case ':teddy_bear:':
      return [
        circle(32, 31, 20, '#b98061', { stroke: '#765147', 'stroke-width': 2 }),
        circle(18, 15, 8, '#b98061', { stroke: '#765147', 'stroke-width': 2 }),
        circle(46, 15, 8, '#b98061', { stroke: '#765147', 'stroke-width': 2 }),
        circle(32, 38, 12, '#e8c79e'),
        circle(25, 29, 2, '#493a42'),
        circle(39, 29, 2, '#493a42'),
        path('M29 36 Q32 33 35 36 L32 39 Z', '#5a3f47'),
        path('M32 39 L32 43 M27 45 Q32 49 37 45', 'none', {
          stroke: '#765147',
          'stroke-width': 1.5,
        }),
      ].join('');
    case ':balloon:':
      return [
        shape('ellipse', {
          cx: 31,
          cy: 25,
          rx: 17,
          ry: 21,
          fill: '#e77c9b',
          stroke: '#985c87',
          'stroke-width': 2,
        }),
        path('M30 46 L32 53 L27 56 M32 53 Q36 57 33 61', 'none', {
          stroke: '#806688',
          'stroke-width': 1.7,
        }),
        path('M22 12 Q17 20 18 25', 'none', {
          stroke: '#ffd7de',
          'stroke-width': 2,
          'stroke-linecap': 'round',
        }),
      ].join('');
    case ':camera:':
      return [
        rect(8, 19, 48, 32, '#8871ad', 6, { stroke: '#574d70', 'stroke-width': 2 }),
        rect(18, 13, 15, 8, '#6d5a8c', 2),
        circle(34, 35, 12, '#4d4865', { stroke: '#f4d7a4', 'stroke-width': 3 }),
        circle(34, 35, 6, '#82c5d8'),
        circle(47, 25, 2, '#f4d36a'),
      ].join('');
    case ':musical_note:':
      return [
        path(
          'M38 10 L50 7 L50 39 C50 45 44 49 38 47 C31 45 33 38 39 36 C42 35 45 36 47 37 L47 17 L38 19 Z',
          '#8871ad',
          { stroke: '#5c4e79', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }
        ),
        shape('ellipse', {
          cx: 25,
          cy: 47,
          rx: 8,
          ry: 5,
          fill: '#d97885',
          transform: 'rotate(-20 25 47)',
        }),
        circle(17, 20, 3, '#f4c94f'),
        circle(22, 14, 2, '#6db49a'),
      ].join('');
    default:
      return path(
        `M32 8 C${14 + (index % 5)} 24 ${22 + (index % 9)} 36 32 56 C42 36 ${50 - (index % 7)} 24 32 8 Z`,
        ['#7f72c3', '#e18477', '#6db49a', '#e4b75e'][index % 4] ?? '#7f72c3'
      );
  }
}

function compositionArt(shortcode: string): string {
  if (shortcode === ':heart_on_fire:')
    return [
      path(
        'M32 56 C25 48 11 39 11 25 C11 12 27 8 32 21 C38 8 53 12 53 25 C53 39 39 49 32 56 Z',
        '#ec6580',
        { stroke: '#8b4d6a', 'stroke-width': 2 }
      ),
      path('M32 48 C20 42 30 31 30 25 C39 32 45 39 37 48 Z', '#f5b44d'),
      path('M31 42 C27 37 33 33 33 30 C38 36 39 39 35 43 Z', '#ffe28d'),
    ].join('');
  if (shortcode === ':rainbow_flag:')
    return [
      rect(11, 14, 42, 30, '#fff9f1', 3, { stroke: '#81698e', 'stroke-width': 1.5 }),
      rect(12, 15, 40, 5, '#ed6a6e'),
      rect(12, 20, 40, 5, '#f2ad4e'),
      rect(12, 25, 40, 5, '#f4d05e'),
      rect(12, 30, 40, 5, '#69b98c'),
      rect(12, 35, 40, 8, '#718ed2'),
      path('M18 44 L14 61 M46 44 L50 61 M14 61 L50 61', 'none', {
        stroke: '#75618a',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      }),
    ].join('');
  if (shortcode === ':family_man_woman_girl:')
    return [
      circle(21, 22, 8, '#e6b58d'),
      circle(42, 22, 8, '#c98e66'),
      circle(32, 31, 6, '#f5d3b2'),
      rect(12, 32, 18, 25, '#5c7fc0', 7),
      rect(34, 32, 17, 25, '#a16ec0', 7),
      rect(27, 40, 11, 17, '#e6a86e', 5),
      path(
        'M13 18 Q14 8 22 12 Q29 11 29 23 L25 18 Z M35 18 Q36 8 44 12 Q51 11 51 23 L47 18 Z',
        '#54425f'
      ),
    ].join('');
  const people = [
    circle(21, 20, 9, '#e9b98f'),
    circle(43, 20, 9, '#c98e66'),
    path('M7 58 Q8 34 21 33 Q34 34 35 58 Z', '#9171c3'),
    path('M29 58 Q30 34 43 33 Q56 34 57 58 Z', '#6e8fca'),
    circle(18, 20, 1.5, '#453c4e'),
    circle(24, 20, 1.5, '#453c4e'),
    circle(40, 20, 1.5, '#453c4e'),
    circle(46, 20, 1.5, '#453c4e'),
    path('M18 26 Q21 29 24 26 M40 26 Q43 29 46 26', 'none', {
      stroke: '#684b45',
      'stroke-width': 1.5,
    }),
    path('M25 39 L32 47 L38 40', 'none', {
      stroke: '#efcc72',
      'stroke-width': 3,
      'stroke-linecap': 'round',
    }),
  ];
  return people.join('');
}

function flagArt(shortcode: string): string {
  const frame = rect(7, 14, 50, 36, '#fffdf9', 2, { stroke: '#806b8b', 'stroke-width': 1.5 });
  const inside: string[] = [];
  switch (shortcode) {
    case ':flag_united_states:':
      for (let i = 0; i < 7; i++) inside.push(rect(8, 15 + i * 5, 48, 2.6, '#d8666f'));
      inside.push(rect(8, 15, 22, 17, '#6478a8'));
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 4; col++)
          inside.push(circle(11 + col * 5, 18 + row * 5, 0.8, '#fff4df'));
      break;
    case ':flag_canada:':
      inside.push(
        rect(8, 15, 11, 34, '#d85261'),
        rect(19, 15, 26, 34, '#fffdf9'),
        rect(45, 15, 11, 34, '#d85261')
      );
      inside.push(
        path(
          'M32 20 L35 26 L40 25 L37 31 L40 36 L34 35 L32 42 L29 35 L24 36 L27 31 L24 26 L30 27 Z',
          '#d85261'
        )
      );
      break;
    case ':flag_united_kingdom:':
      inside.push(
        rect(8, 15, 48, 34, '#53688f'),
        path(
          'M8 15 L14 15 L56 43 L56 49 L50 49 L8 21 Z M50 15 L56 15 L56 21 L14 49 L8 49 L8 43 Z',
          '#fffdf9'
        ),
        rect(8, 27, 48, 10, '#fffdf9'),
        rect(26, 15, 12, 34, '#fffdf9'),
        rect(8, 29, 48, 6, '#d45b66'),
        rect(29, 15, 6, 34, '#d45b66')
      );
      break;
    case ':flag_japan:':
      inside.push(circle(32, 32, 11, '#d95763'));
      break;
    case ':flag_brazil:':
      inside.push(
        rect(8, 15, 48, 34, '#58a77c'),
        path('M32 18 L51 32 L32 46 L13 32 Z', '#f2cf58'),
        circle(32, 32, 9, '#5677ad')
      );
      break;
    case ':flag_germany:':
      inside.push(
        rect(8, 15, 48, 11, '#45414d'),
        rect(8, 26, 48, 12, '#d35c61'),
        rect(8, 38, 48, 11, '#e9bf55')
      );
      break;
    case ':flag_france:':
      inside.push(
        rect(8, 15, 16, 34, '#5878ad'),
        rect(24, 15, 16, 34, '#fffdf9'),
        rect(40, 15, 16, 34, '#d86670')
      );
      break;
    default:
      inside.push(
        rect(8, 15, 48, 34, '#fffdf9'),
        rect(28, 15, 9, 34, '#d65c68'),
        rect(8, 27, 48, 9, '#d65c68')
      );
      break;
  }
  return frame + inside.join('');
}

function render(group: Design['group'], shortcode: string, index: number): string {
  if (group === 'face') return faceArt(index, shortcode);
  if (group === 'person') return personArt(shortcode);
  if (group === 'composition') return compositionArt(shortcode);
  if (group === 'flag') return flagArt(shortcode);
  return objectArt(shortcode, index);
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(dirname(PROVENANCE), { recursive: true });
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as {
    records: { id: string; shortcode: string; name: string; codepoints: string[] }[];
  };
  const byShortcode = new Map(catalog.records.map((record) => [record.shortcode, record]));
  const records = DESIGNS.map((design, index) => {
    const emoji = byShortcode.get(design.shortcode);
    if (!emoji) throw new Error(`seed design shortcode not found in catalog: ${design.shortcode}`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">${render(design.group, design.shortcode, index)}</svg>\n`;
    const file = `${emoji.id}.svg`;
    writeFileSync(resolve(OUT, file), svg);
    return {
      id: emoji.id,
      shortcode: emoji.shortcode,
      name: emoji.name,
      source: `originals/${file}`,
      sha256: createHash('sha256').update(svg).digest('hex'),
      author: 'agent lane local:wH:p2R',
      date: DATE,
      method:
        'Original vector geometry authored from the Unicode/CLDR semantic label; no vendor glyph or source artwork used.',
      review:
        'Reviewed against ART_DIRECTION.md for silhouette, palette, transparency, small-scale readability and cultural accuracy; pending independent owner approval.',
      status: 'reviewed-candidate',
      proposedLicense: 'CC BY 4.0 (pending owner sign-off)',
    };
  });
  writeFileSync(
    PROVENANCE,
    `${JSON.stringify({ schemaVersion: 'texuli-emoji-art-provenance/v1', records }, null, 2)}\n`
  );
  console.log(`authored ${records.length} original SVG candidates`);
}

main();
