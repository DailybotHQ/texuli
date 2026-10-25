/**
 * Pointer grace area for submenus. When the pointer leaves a submenu trigger
 * heading for the submenu, it may cross other items of the parent menu; those
 * must not steal the highlight or close the submenu. The grace area is the
 * polygon from the exit point (pushed back a few pixels) to the submenu's
 * near edge; while the pointer stays inside it, the parent ignores hovers.
 */

export type Point = { x: number; y: number };
export type Rect = { left: number; top: number; right: number; bottom: number };

/** Ray casting: whether `point` is inside the polygon (edges count as inside). */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * The grace polygon from the pointer's exit point to the submenu. `side` is
 * where the submenu opens relative to its trigger (`right` in LTR, `left` in
 * RTL). The exit point moves `bleed` pixels away from the submenu so a
 * pointer that slides along the trigger's edge stays inside.
 */
export function graceArea(exit: Point, submenu: Rect, side: 'left' | 'right', bleed = 5): Point[] {
  const toward = side === 'right' ? 1 : -1;
  const near = side === 'right' ? submenu.left : submenu.right;
  const far = side === 'right' ? submenu.right : submenu.left;
  return [
    { x: exit.x - toward * bleed, y: exit.y + bleed },
    { x: exit.x - toward * bleed, y: exit.y - bleed },
    { x: near, y: submenu.top },
    { x: far, y: submenu.top },
    { x: far, y: submenu.bottom },
    { x: near, y: submenu.bottom },
  ];
}
