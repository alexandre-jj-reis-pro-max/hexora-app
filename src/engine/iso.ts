// src/engine/iso.ts
// Orthogonal (top-down) tile projection — replaces the old isometric engine.

export const TILE_SIZE = 16; // native pixel size of each tile
export const ZOOM      = 4;  // scale factor
export const TILE_S    = TILE_SIZE * ZOOM; // 64px per tile on screen

/** Convert tile grid position to screen pixel coordinates.
 *  Returns the top-left corner of the tile cell.
 *  offsetX/offsetY allow panning (default 0). */
export function tileToScreen(
  col: number,
  row: number,
  offsetX = 0,
  offsetY = 0,
): { x: number; y: number } {
  return {
    x: offsetX + col * TILE_S,
    y: offsetY + row * TILE_S,
  };
}

/** Legacy alias — kept so existing call-sites don't break during migration.
 *  The third argument (viewportW) is ignored in the orthogonal projection. */
export function isoToScreen(
  col: number,
  row: number,
  _viewportW?: number,
): { x: number; y: number } {
  return tileToScreen(col, row);
}
