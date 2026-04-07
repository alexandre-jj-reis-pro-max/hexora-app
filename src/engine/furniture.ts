// src/engine/furniture.ts
// Loads furniture sprites and defines the office layout (what goes where).

import { TILE_S } from './iso';

// ── Furniture item definition ─────────────────────────────────────────────────

export interface FurnitureItem {
  type: string;
  src: string;         // path to PNG
  col: number;         // tile column
  row: number;         // tile row
  tilesW: number;      // footprint in tiles
  tilesH: number;
  zRow: number;        // row used for z-sorting (usually row + tilesH - 1)
  mirror?: boolean;    // horizontal flip
}

// ── Office layout — all placed furniture ─────────────────────────────────────
// Grid: 26 cols × 14 rows.  Walls on col 0/25 and row 0/13.
// Interior: cols 1-24, rows 1-12.
// 4 desk pairs (top row=3-4, bottom row=8-9), whiteboard at (1,5).

export const OFFICE_FURNITURE: FurnitureItem[] = [
  // ── Desk pair 1 — Leo (col 4, row 4) + Nina (col 4, row 9) ─────────────
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 3,  row: 3,  tilesW: 2, tilesH: 2, zRow: 4 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_1.png',              col: 4,  row: 4,  tilesW: 1, tilesH: 1, zRow: 4 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 4, row: 5, tilesW: 1, tilesH: 1, zRow: 5 },
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 3,  row: 8,  tilesW: 2, tilesH: 2, zRow: 9 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_1.png',              col: 4,  row: 9,  tilesW: 1, tilesH: 1, zRow: 9 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 4, row: 10, tilesW: 1, tilesH: 1, zRow: 10 },

  // ── Desk pair 2 — Vitor (col 9, row 4) + Bia (col 9, row 9) ────────────
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 8,  row: 3,  tilesW: 2, tilesH: 2, zRow: 4 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_2.png',              col: 9,  row: 4,  tilesW: 1, tilesH: 1, zRow: 4 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 9, row: 5, tilesW: 1, tilesH: 1, zRow: 5 },
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 8,  row: 8,  tilesW: 2, tilesH: 2, zRow: 9 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_2.png',              col: 9,  row: 9,  tilesW: 1, tilesH: 1, zRow: 9 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 9, row: 10, tilesW: 1, tilesH: 1, zRow: 10 },

  // ── Desk pair 3 — Ju (col 14, row 4) + Fer (col 14, row 9) ─────────────
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 13, row: 3,  tilesW: 2, tilesH: 2, zRow: 4 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_3.png',              col: 14, row: 4,  tilesW: 1, tilesH: 1, zRow: 4 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 14, row: 5, tilesW: 1, tilesH: 1, zRow: 5 },
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 13, row: 8,  tilesW: 2, tilesH: 2, zRow: 9 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_3.png',              col: 14, row: 9,  tilesW: 1, tilesH: 1, zRow: 9 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 14, row: 10, tilesW: 1, tilesH: 1, zRow: 10 },

  // ── Desk pair 4 — Maya (col 19, row 4) + Ops (col 19, row 9) ───────────
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 18, row: 3,  tilesW: 2, tilesH: 2, zRow: 4 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_1.png',              col: 19, row: 4,  tilesW: 1, tilesH: 1, zRow: 4 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 19, row: 5, tilesW: 1, tilesH: 1, zRow: 5 },
  { type: 'desk',  src: '/assets/furniture/DESK/DESK_FRONT.png',               col: 18, row: 8,  tilesW: 2, tilesH: 2, zRow: 9 },
  { type: 'pc',    src: '/assets/furniture/PC/PC_FRONT_ON_1.png',              col: 19, row: 9,  tilesW: 1, tilesH: 1, zRow: 9 },
  { type: 'chair', src: '/assets/furniture/CUSHIONED_CHAIR/CUSHIONED_CHAIR_FRONT.png', col: 19, row: 10, tilesW: 1, tilesH: 1, zRow: 10 },

  // ── Lounge area (right side, cols 21-24) ────────────────────────────────
  { type: 'sofa',        src: '/assets/furniture/SOFA/SOFA_FRONT.png',          col: 22, row: 4,  tilesW: 2, tilesH: 1, zRow: 4 },
  { type: 'coffee_table',src: '/assets/furniture/COFFEE_TABLE/COFFEE_TABLE.png',col: 22, row: 5,  tilesW: 1, tilesH: 1, zRow: 5 },
  { type: 'cushion_bench',src:'/assets/furniture/CUSHIONED_BENCH/CUSHIONED_BENCH.png',col:22,row:7,tilesW:2,tilesH:1,zRow:7},

  // ── Bookshelves (against top wall) ──────────────────────────────────────
  { type: 'bookshelf',   src: '/assets/furniture/BOOKSHELF/BOOKSHELF.png',      col: 6,  row: 1,  tilesW: 1, tilesH: 2, zRow: 2 },
  // Kanban board at col 10-12 (drawn procedurally, not as furniture)
  { type: 'bookshelf',   src: '/assets/furniture/BOOKSHELF/BOOKSHELF.png',      col: 16, row: 1,  tilesW: 1, tilesH: 2, zRow: 2 },

  // ── Plants & decor ─────────────────────────────────────────────────────
  { type: 'large_plant', src: '/assets/furniture/LARGE_PLANT/LARGE_PLANT.png',  col: 1,  row: 1,  tilesW: 1, tilesH: 2, zRow: 2 },
  { type: 'plant',       src: '/assets/furniture/PLANT/PLANT.png',              col: 24, row: 1,  tilesW: 1, tilesH: 1, zRow: 1 },
  { type: 'plant2',      src: '/assets/furniture/PLANT_2/PLANT_2.png',          col: 1,  row: 11, tilesW: 1, tilesH: 1, zRow: 11 },
  { type: 'cactus',      src: '/assets/furniture/CACTUS/CACTUS.png',            col: 24, row: 11, tilesW: 1, tilesH: 1, zRow: 11 },
  { type: 'bin',         src: '/assets/furniture/BIN/BIN.png',                  col: 5,  row: 5,  tilesW: 1, tilesH: 1, zRow: 5 },
  { type: 'bin',         src: '/assets/furniture/BIN/BIN.png',                  col: 17, row: 6,  tilesW: 1, tilesH: 1, zRow: 6 },

  // ── Wall decorations ───────────────────────────────────────────────────
  { type: 'large_painting',src:'/assets/furniture/LARGE_PAINTING/LARGE_PAINTING.png',col:21,row:1,tilesW:2,tilesH:2,zRow:2},
  { type: 'small_painting',src:'/assets/furniture/SMALL_PAINTING/SMALL_PAINTING.png',col:4,row:1,tilesW:1,tilesH:1,zRow:1},
  { type: 'small_painting2',src:'/assets/furniture/SMALL_PAINTING_2/SMALL_PAINTING_2.png',col:9,row:1,tilesW:1,tilesH:1,zRow:1},
  { type: 'clock',       src: '/assets/furniture/CLOCK/CLOCK.png',              col: 17, row: 1,  tilesW: 1, tilesH: 1, zRow: 1 },
  { type: 'plant',       src: '/assets/furniture/PLANT/PLANT.png',              col: 14, row: 1,  tilesW: 1, tilesH: 1, zRow: 1 },
];

// ── Image cache ───────────────────────────────────────────────────────────────

const imgCache = new Map<string, HTMLImageElement>();
let loading = false;

export function loadFurniture(): Promise<void> {
  if (loading) return Promise.resolve();
  loading = true;

  const srcs = [...new Set(OFFICE_FURNITURE.map((f) => f.src))];

  return Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => { imgCache.set(src, img); res(); };
          img.onerror = () => res();
          img.src = src;
        }),
    ),
  ).then(() => {});
}

export function getFurnitureImg(src: string): HTMLImageElement | null {
  return imgCache.get(src) ?? null;
}

// ── Draw all furniture (sorted by zRow for proper overlap) ────────────────────

export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
) {
  ctx.imageSmoothingEnabled = false;

  const sorted = [...OFFICE_FURNITURE].sort((a, b) => a.zRow - b.zRow);

  for (const f of sorted) {
    const img = getFurnitureImg(f.src);
    if (!img?.complete || img.naturalWidth === 0) continue;

    const drawW = f.tilesW * TILE_S;
    const drawH = f.tilesH * TILE_S;
    const x = ox + f.col * TILE_S;
    const y = oy + f.row * TILE_S;

    if (f.mirror) {
      ctx.save();
      ctx.translate(x + drawW, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, drawW, drawH);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, drawW, drawH);
    }
  }
}

/** Returns furniture sorted by zRow — used for interleaved z-sorting with agents */
export function getFurnitureSorted(): FurnitureItem[] {
  return [...OFFICE_FURNITURE].sort((a, b) => a.zRow - b.zRow);
}
