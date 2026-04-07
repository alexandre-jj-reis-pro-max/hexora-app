// src/engine/office-layout.ts
// Static office tile map + floor/wall image loader
// Tile values: 0 = wall | 1-9 = floor pattern index

export const COLS = 26;
export const ROWS = 14;

// 0 = wall, 1 = floor (wood pattern)
// prettier-ignore
const RAW: number[] = [
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,
  0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,
];

export function getTile(col: number, row: number): number {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return 0;
  return RAW[row * COLS + col];
}

// ── Asset loading ─────────────────────────────────────────────────────────────

const floorImgs: HTMLImageElement[] = [];
let wallImg:      HTMLImageElement | null = null;
let loaded = false;

export function loadOfficeAssets(): Promise<void> {
  if (loaded) return Promise.resolve();
  const promises: Promise<void>[] = [];

  // Load floor patterns 1-9
  for (let i = 1; i <= 9; i++) {
    const img = new Image();
    promises.push(new Promise((res) => {
      img.onload = () => res();
      img.onerror = () => res();
      img.src = `/assets/floors/floor_${i - 1}.png`;
    }));
    floorImgs[i] = img;
  }

  // Load wall texture
  const wImg = new Image();
  promises.push(new Promise((res) => {
    wImg.onload = () => { wallImg = wImg; res(); };
    wImg.onerror = () => res();
    wImg.src = '/assets/walls/wall_0.png';
  }));

  return Promise.all(promises).then(() => { loaded = true; });
}

export function getFloorImg(patternIndex: number): HTMLImageElement | null {
  return floorImgs[patternIndex] ?? null;
}

export function getWallImg(): HTMLImageElement | null {
  return wallImg;
}

// Kanban board occupies 3×2 tiles on the top wall (replaces double bookshelf)
export const MONITOR_POS = { col: 10, row: 1 };
export const MONITOR_TILES_W = 3;
export const MONITOR_TILES_H = 2;
