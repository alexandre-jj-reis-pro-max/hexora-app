// src/engine/spritesheets.ts
// Loads character spritesheets from pixel-agents format:
//   3 rows (directions) × 7 cols (frames)
//   Row 0 → down | Row 1 → up | Row 2 → right  (left = mirror of right)
//   Frames 0-2 → walk  |  Frames 3-4 → typing  |  Frames 5-6 → reading
//   Native frame size: 16 × 32px (scales up at draw time)

// Map agent id → char sprite file
const SPRITE_PATH: Record<string, string> = {
  'dev-back':  '/sprites/char_0.png',
  'dev-front': '/sprites/char_1.png',
  'eng-dados': '/sprites/char_2.png',
  'qa':        '/sprites/char_3.png',
  'pm':        '/sprites/char_4.png',
  'po':        '/sprites/char_5.png',
  'design':    '/sprites/char_1.png', // reuse — will be tinted differently
  'devops':    '/sprites/char_0.png', // reuse
};

const FRAMES_TOTAL = 7;
const DIR_ROW: Record<string, number> = { down: 0, up: 1, right: 2, left: 2 };

// Walk frames cycle: 0 → 1 → 2 → 1
const WALK_CYCLE = [0, 1, 2, 1];
// Typing frames cycle: 3 → 4
const TYPE_CYCLE = [3, 4];

export interface Sheet {
  canvas: HTMLCanvasElement;
  frameW: number;
  frameH: number;
  mirrorCanvas: HTMLCanvasElement; // pre-mirrored for left direction
}

const sheetCache   = new Map<string, Sheet>();
const pendingCache = new Map<string, Promise<Sheet>>();

// ── Background removal (flood-fill from borders) ─────────────────────────────

function isBgPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 10) return true; // already transparent
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min);
  return l > 0.45 && s < 0.22;
}

function removeBackground(src: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.naturalWidth;
  c.height = src.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const px = imgData.data;
  const w = c.width, h = c.height;

  const removed = new Uint8Array(w * h);
  const queue: number[] = [];

  const seed = (x: number, y: number) => {
    const idx = y * w + x;
    if (removed[idx]) return;
    const pi = idx * 4;
    if (isBgPixel(px[pi], px[pi + 1], px[pi + 2], px[pi + 3])) {
      removed[idx] = 1;
      queue.push(idx);
    }
  };

  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { seed(0, y); seed(w - 1, y); }

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
      if (isBgPixel(px[pi], px[pi + 1], px[pi + 2], px[pi + 3])) {
        removed[ni] = 1;
        queue.push(ni);
      }
    }
  }

  // Pass 2: lenient expansion
  const expand = (minL: number, maxS: number) => {
    const toAdd: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (removed[i]) continue;
      const xi = i % w, yi = Math.floor(i / w);
      const ns = [yi > 0 ? i - w : -1, yi < h - 1 ? i + w : -1, xi > 0 ? i - 1 : -1, xi < w - 1 ? i + 1 : -1];
      for (const ni of ns) {
        if (ni < 0 || !removed[ni]) continue;
        const pi = i * 4;
        const r = px[pi], g = px[pi + 1], b = px[pi + 2], a = px[pi + 3];
        if (a < 128) { toAdd.push(i); break; }
        const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
        const l = (mx + mn) / 2;
        const s = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
        if (l > minL && s < maxS) { toAdd.push(i); break; }
      }
    }
    for (const i of toAdd) removed[i] = 1;
  };
  expand(0.40, 0.35);
  expand(0.32, 0.40);

  // Pass 3: 1px erosion
  const toShrink: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (removed[i]) continue;
    const xi = i % w, yi = Math.floor(i / w);
    const ns = [yi > 0 ? i - w : -1, yi < h - 1 ? i + w : -1, xi > 0 ? i - 1 : -1, xi < w - 1 ? i + 1 : -1];
    for (const ni of ns) { if (ni >= 0 && removed[ni]) { toShrink.push(i); break; } }
  }
  for (const i of toShrink) removed[i] = 1;

  for (let i = 0; i < w * h; i++) {
    if (removed[i]) px[i * 4 + 3] = 0;
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

// ── Build mirrored canvas for left direction ──────────────────────────────────

function buildMirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const m = document.createElement('canvas');
  m.width  = src.width;
  m.height = src.height;
  const ctx = m.getContext('2d')!;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return m;
}

// ── Load ──────────────────────────────────────────────────────────────────────

export function loadSprite(agentId: string): Promise<Sheet> {
  if (sheetCache.has(agentId))   return Promise.resolve(sheetCache.get(agentId)!);
  if (pendingCache.has(agentId)) return pendingCache.get(agentId)!;

  const path = SPRITE_PATH[agentId];
  if (!path) return Promise.reject(new Error(`No sprite for agent: ${agentId}`));

  const p = new Promise<Sheet>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Check if the image already has transparency (PNG from pixel-agents)
      const test = document.createElement('canvas');
      test.width = img.naturalWidth;
      test.height = img.naturalHeight;
      const tCtx = test.getContext('2d')!;
      tCtx.drawImage(img, 0, 0);
      const corner = tCtx.getImageData(0, 0, 1, 1).data;
      const hasAlpha = corner[3] < 128; // top-left pixel is transparent

      const canvas = hasAlpha ? test : removeBackground(img);
      const sheet: Sheet = {
        canvas,
        frameW: Math.floor(canvas.width  / FRAMES_TOTAL),
        frameH: Math.floor(canvas.height / 3),
        mirrorCanvas: buildMirror(canvas),
      };
      sheetCache.set(agentId, sheet);
      resolve(sheet);
    };
    img.onerror = () => reject(new Error(`Failed to load: ${path}`));
    img.src = path;
  });

  pendingCache.set(agentId, p);
  return p;
}

export function getSheet(agentId: string): Sheet | null {
  return sheetCache.get(agentId) ?? null;
}

// ── Draw ──────────────────────────────────────────────────────────────────────

export function drawSheet(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  dir: string,
  ws: number,
  dw: number,
  dh: number,
  state: 'walking' | 'idle' | 'working' = 'walking',
) {
  const row      = DIR_ROW[dir] ?? 0;
  const isLeft   = dir === 'left';
  const src      = isLeft ? sheet.mirrorCanvas : sheet.canvas;

  let frame: number;
  if (state === 'idle') {
    frame = 0;
  } else if (state === 'working') {
    frame = TYPE_CYCLE[Math.floor(ws / 8) % TYPE_CYCLE.length];
  } else {
    frame = WALK_CYCLE[Math.floor(ws / 6) % WALK_CYCLE.length];
  }

  ctx.drawImage(
    src,
    frame * sheet.frameW, row * sheet.frameH,
    sheet.frameW, sheet.frameH,
    0, 0, dw, dh,
  );
}

export function drawPreview(agentId: string, dest: HTMLCanvasElement) {
  const sheet = sheetCache.get(agentId);
  if (!sheet) return;
  const ctx = dest.getContext('2d')!;
  ctx.clearRect(0, 0, dest.width, dest.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    sheet.canvas,
    0, 0, sheet.frameW, sheet.frameH,
    0, 0, dest.width, dest.height,
  );
}
