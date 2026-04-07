// src/engine/tiles.ts
// Loads furniture/tile assets, removes solid background, caches for drawFloor.

const ASSET_PATH: Record<string, string> = {
  floor:          '/tiles/floor.jpg',
  carpet:         '/tiles/carpet.jpg',
  wall:           '/tiles/wall.jpg',
  'wall-window':  '/tiles/wall-window.jpg',
  desk:           '/tiles/desk.jpg',
  chair:          '/tiles/chair.jpg',
  plant:          '/tiles/plant.jpg',
  coffee:         '/tiles/coffee.jpg',
  'meet-table':   '/tiles/meet-table.jpg',
  bookshelf:      '/tiles/bookshelf.jpg',
  server:         '/tiles/server.jpg',
  lousa:          '/tiles/lousa.jpg',
};

export type TileAssets = Record<string, HTMLCanvasElement>;

const assetCache: TileAssets = {};
const pending = new Map<string, Promise<HTMLCanvasElement>>();

// ── Background removal (flood-fill from borders, HSL-based) ────────────────

function getLuminance(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return (max + min) / 2;
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const l = (max + min) / 2;
  return (max - min) / (l > 0.5 ? 2 - max - min : max + min);
}

function isBgPixel(r: number, g: number, b: number): boolean {
  const l = getLuminance(r, g, b);
  const s = getSaturation(r, g, b);
  // Background = light (l > 0.45) AND low saturation (s < 0.22)
  // This catches white, light gray, and light gradient backgrounds
  return l > 0.45 && s < 0.22;
}

function removeBackground(src: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.naturalWidth; c.height = src.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const px = imgData.data;
  const w = c.width, h = c.height;

  // Flood fill from all border pixels
  const removed = new Uint8Array(w * h); // 1 = background
  const queue: number[] = [];

  const seed = (x: number, y: number) => {
    const idx = y * w + x;
    if (removed[idx]) return;
    const pi = idx * 4;
    if (isBgPixel(px[pi], px[pi + 1], px[pi + 2])) {
      removed[idx] = 1;
      queue.push(idx);
    }
  };

  // Seed all 4 borders
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { seed(0, y); seed(w - 1, y); }

  // BFS flood fill (4-connected)
  let qi = 0;
  while (qi < queue.length) {
    const idx = queue[qi++];
    const x = idx % w, y = Math.floor(idx / w);
    const neighbors = [
      y > 0     ? idx - w : -1,
      y < h - 1 ? idx + w : -1,
      x > 0     ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
    ];
    for (const ni of neighbors) {
      if (ni < 0 || removed[ni]) continue;
      const pi = ni * 4;
      if (isBgPixel(px[pi], px[pi + 1], px[pi + 2])) {
        removed[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // Pass 2: lenient threshold expansion — catches JPG-blended border pixels
  const expand = (minL: number, maxS: number) => {
    const toAdd: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (removed[i]) continue;
      const xi = i % w, yi = Math.floor(i / w);
      const ns = [yi > 0 ? i - w : -1, yi < h - 1 ? i + w : -1, xi > 0 ? i - 1 : -1, xi < w - 1 ? i + 1 : -1];
      for (const ni of ns) {
        if (ni < 0 || !removed[ni]) continue;
        const pi = i * 4;
        const r = px[pi], g = px[pi + 1], b = px[pi + 2];
        const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
        const l = (mx + mn) / 2;
        const s = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
        if (l > minL && s < maxS) toAdd.push(i);
        break;
      }
    }
    for (const i of toAdd) removed[i] = 1;
  };
  expand(0.40, 0.35); // first expansion — light-colored fringe
  expand(0.32, 0.40); // second expansion — slightly darker blended edge

  // Pass 3: unconditional 1px erosion — removes all remaining fringe regardless of color
  const toShrink: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (removed[i]) continue;
    const xi = i % w, yi = Math.floor(i / w);
    const ns = [yi > 0 ? i - w : -1, yi < h - 1 ? i + w : -1, xi > 0 ? i - 1 : -1, xi < w - 1 ? i + 1 : -1];
    for (const ni of ns) { if (ni >= 0 && removed[ni]) { toShrink.push(i); break; } }
  }
  for (const i of toShrink) removed[i] = 1;

  // Apply: erase all removed pixels (hard edge — better for pixel art)
  for (let i = 0; i < w * h; i++) {
    if (removed[i]) px[i * 4 + 3] = 0;
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

// ── Load ────────────────────────────────────────────────────────────────────

function loadAsset(name: string): Promise<HTMLCanvasElement> {
  if (assetCache[name]) return Promise.resolve(assetCache[name]);
  if (pending.has(name)) return pending.get(name)!;

  const path = ASSET_PATH[name];
  if (!path) return Promise.reject(new Error(`No asset: ${name}`));

  const p = new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = removeBackground(img);
      assetCache[name] = c;
      resolve(c);
    };
    img.onerror = () => reject(new Error(`Failed: ${path}`));
    img.src = path;
  });
  pending.set(name, p);
  return p;
}

/** Load all tile assets. Returns the cache map when done. */
export async function loadAllTiles(): Promise<TileAssets> {
  await Promise.allSettled(Object.keys(ASSET_PATH).map(loadAsset));
  return assetCache;
}

/** Get cached asset synchronously (null if not yet loaded). */
export function getTile(name: string): HTMLCanvasElement | null {
  return assetCache[name] ?? null;
}

// ── Draw helper ─────────────────────────────────────────────────────────────

/**
 * Draw a tile asset anchored at the bottom-center of (cx, cy).
 * w and h define the display size.
 * Returns true if the sprite was drawn, false if not yet loaded.
 */
export function drawTileSprite(
  c: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  w: number,
  h: number,
): boolean {
  const asset = getTile(name);
  if (!asset) return false;
  c.drawImage(asset, cx - w / 2, cy - h, w, h);
  return true;
}
