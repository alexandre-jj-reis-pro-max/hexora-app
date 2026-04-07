function shade(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + a));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + a));
  const b = Math.max(0, Math.min(255, (n & 255) + a));
  return `rgb(${r},${g},${b})`;
}

function drawBase(ctx: CanvasRenderingContext2D, color: string, dir: string, ws: number) {
  const sk = '#fcd3a5', dk = shade(color, -40), lp = Math.sin(ws * 0.32) * 2.5;
  ctx.clearRect(0, 0, 20, 36);
  ctx.fillStyle = 'rgba(0,0,0,.2)';
  ctx.beginPath(); ctx.ellipse(10, 35, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = dk;
  ctx.fillRect(5, 23, 4, 8 + Math.round(lp));
  ctx.fillRect(11, 23, 4, 8 - Math.round(lp));
  ctx.fillStyle = '#1c1917';
  ctx.fillRect(4, 30 + Math.round(lp), 6, 2);
  ctx.fillRect(10, 30 - Math.round(lp), 6, 2);
  ctx.fillStyle = color; ctx.fillRect(3, 13, 14, 11);
  const ap = Math.sin(ws * 0.32) * 1.8;
  if (dir === 'left') {
    ctx.fillStyle = color; ctx.fillRect(0, 14 + ap, 3, 8); ctx.fillRect(17, 14 - ap, 3, 7);
    ctx.fillStyle = sk; ctx.fillRect(0, 22 + ap, 3, 2); ctx.fillRect(17, 21 - ap, 3, 2);
  } else if (dir === 'right') {
    ctx.fillStyle = color; ctx.fillRect(17, 14 + ap, 3, 8); ctx.fillRect(0, 14 - ap, 3, 7);
    ctx.fillStyle = sk; ctx.fillRect(17, 22 + ap, 3, 2); ctx.fillRect(0, 21 - ap, 3, 2);
  } else {
    ctx.fillStyle = color; ctx.fillRect(0, 14, 3, 8); ctx.fillRect(17, 14, 3, 8);
    ctx.fillStyle = sk; ctx.fillRect(0, 22, 3, 2); ctx.fillRect(17, 22, 3, 2);
  }
  ctx.fillStyle = sk; ctx.fillRect(5, 3, 11, 11);
  ctx.fillStyle = dk; ctx.fillRect(5, 3, 11, 3); ctx.fillRect(4, 5, 1, 3); ctx.fillRect(16, 5, 1, 3);
  ctx.fillStyle = '#1a0a2e';
  if (dir === 'left') { ctx.fillRect(7, 9, 2, 2); ctx.fillRect(11, 9, 2, 2); }
  else if (dir === 'right') { ctx.fillRect(8, 9, 2, 2); ctx.fillRect(12, 9, 2, 2); }
  else { ctx.fillRect(7, 9, 2, 2); ctx.fillRect(12, 9, 2, 2); }
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  if (dir === 'left') { ctx.fillRect(7, 9, 1, 1); ctx.fillRect(11, 9, 1, 1); }
  else { ctx.fillRect(8, 9, 1, 1); ctx.fillRect(12, 9, 1, 1); }
}

type SpriteExtra = (ctx: CanvasRenderingContext2D, color: string) => void;

const SPRITE_EXTRAS: Record<string, SpriteExtra> = {
  coord(ctx) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(6, 1, 2, 3); ctx.fillRect(9, 0, 3, 3); ctx.fillRect(13, 1, 2, 3);
    ctx.fillStyle = 'rgba(251,191,36,.3)'; ctx.fillRect(5, 2, 11, 2);
  },
  dev(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(3, 13, 14, 3);
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(6, 9, 3, 1); ctx.fillRect(11, 9, 3, 1); ctx.fillRect(9, 9, 2, 1);
    ctx.fillStyle = 'rgba(96,165,250,.6)'; ctx.fillRect(7, 17, 6, 4);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(7, 17, 6, 1);
  },
  front(ctx) {
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(4, 4, 2, 5); ctx.fillRect(14, 4, 2, 5); ctx.fillRect(4, 4, 12, 2);
    ctx.fillRect(4, 7, 3, 3); ctx.fillRect(13, 7, 3, 3);
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.fillRect(3, 15, 14, 1); ctx.fillRect(3, 18, 14, 1);
  },
  data(ctx) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(5, 8, 5, 3); ctx.fillRect(10, 8, 1, 1); ctx.fillRect(11, 8, 5, 3);
    ctx.fillStyle = 'rgba(56,189,248,.5)'; ctx.fillRect(6, 9, 3, 1); ctx.fillRect(12, 9, 3, 1);
    ctx.fillStyle = 'rgba(56,189,248,.5)';
    ctx.fillRect(6, 19, 2, 2); ctx.fillRect(9, 17, 2, 4); ctx.fillRect(12, 15, 2, 6);
  },
  qa(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(7, 15, 6, 6);
    ctx.fillStyle = 'rgba(74,222,128,.7)'; ctx.fillRect(8, 16, 2, 1); ctx.fillRect(8, 18, 2, 1); ctx.fillRect(8, 20, 2, 1);
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(11, 16, 2, 1); ctx.fillRect(11, 18, 2, 1); ctx.fillRect(11, 20, 1, 1);
    ctx.fillStyle = '#f87171'; ctx.fillRect(7, 2, 1, 2); ctx.fillRect(12, 2, 1, 2);
    ctx.fillRect(6, 1, 2, 1); ctx.fillRect(12, 1, 2, 1);
  },
  pm(ctx) {
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(9, 13, 2, 1); ctx.fillRect(8, 14, 4, 5); ctx.fillRect(9, 19, 2, 2);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, 18, 3, 2);
  },
  po(ctx) {
    ctx.fillStyle = '#fde68a'; ctx.fillRect(4, 14, 4, 4);
    ctx.fillStyle = '#86efac'; ctx.fillRect(12, 16, 4, 4);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fillRect(5, 15, 2, 1); ctx.fillRect(5, 16, 3, 1);
    ctx.fillRect(13, 17, 2, 1); ctx.fillRect(13, 18, 3, 1);
  },
  design(ctx) {
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(4, 2, 13, 3); ctx.fillRect(3, 3, 1, 2); ctx.fillRect(16, 3, 1, 2); ctx.fillRect(9, 0, 5, 3);
    ctx.fillStyle = '#f472b6'; ctx.fillRect(12, 14, 4, 4);
    ctx.fillStyle = '#7c3aed'; ctx.fillRect(13, 15, 2, 1);
    ctx.fillStyle = '#34d399'; ctx.fillRect(13, 17, 2, 1);
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(15, 16, 1, 1);
  },
};

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  color: string,
  dir: string,
  ws: number,
  spriteKey: string
) {
  drawBase(ctx, color, dir, ws);
  const extra = SPRITE_EXTRAS[spriteKey];
  if (extra) extra(ctx, color);
}

export function makePreview(color: string, spriteKey: string): string {
  const c = document.createElement('canvas');
  c.width = 20; c.height = 36;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawBase(ctx, color, 'down', 0);
  const extra = SPRITE_EXTRAS[spriteKey];
  if (extra) extra(ctx, color);
  return c.toDataURL();
}
