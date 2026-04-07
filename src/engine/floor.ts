import { ISO } from '../constants';
import { isoToScreen } from './iso';
import { drawTileSprite } from './tiles';

const { TW, TH, COLS, ROWS } = ISO;

// ── Helpers ────────────────────────────────────────────────────────────────

function ambientLight(
  c: CanvasRenderingContext2D,
  x: number, y: number, r: number, color: string,
) {
  const g = c.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}

// ── Floor tile ─────────────────────────────────────────────────────────────

function tile(c: CanvasRenderingContext2D, col: number, row: number, vw: number) {
  const { x, y } = isoToScreen(col, row, vw);
  const hw = TW / 2, th = TH / 2;

  const isOffice = col >= 2 && col <= 19 && row >= 2 && row <= 14;

  // Always procedural — tile sprites don't clip cleanly to the iso diamond
  const fill: string = isOffice
    ? (Math.floor(col / 2) + Math.floor(row / 2)) % 2 === 0 ? '#1d1260' : '#170e4e'
    : (col + row) % 2 === 0 ? '#0f0b28' : '#0c0820';
  const gridStroke: string = isOffice ? 'rgba(88,28,220,.09)' : 'rgba(60,20,140,.07)';

  c.beginPath();
  c.moveTo(x, y - th); c.lineTo(x + hw, y); c.lineTo(x, y + th); c.lineTo(x - hw, y);
  c.closePath(); c.fillStyle = fill; c.fill();
  c.strokeStyle = gridStroke; c.lineWidth = 0.5; c.stroke();
  c.beginPath(); c.moveTo(x - hw, y); c.lineTo(x, y - th);
  c.strokeStyle = 'rgba(255,255,255,.032)'; c.lineWidth = 0.7; c.stroke();

  if (isOffice && (col === 2 || col === 19 || row === 2 || row === 14)) {
    c.strokeStyle = 'rgba(139,92,246,.22)'; c.lineWidth = 0.8; c.stroke();
  }
}

// ── Walls ──────────────────────────────────────────────────────────────────
// Each wall is ONE continuous parallelogram — no per-tile panels, no seams.
// Back wall  → runs along the col axis at row = WALL_ROW (right face in iso)
// Left wall  → runs along the row axis at col = WALL_COL (left face in iso)

const WALL_H = 120;

function walls(c: CanvasRenderingContext2D, vw: number) {
  const hw = TW / 2, th = TH / 2;

  // ── Back wall: col 0 → COLS at row = 0 (full grid width) ─────────────────
  // Use the left-vertex (x − hw, y) — they form a perfect iso slope line.
  const bL  = isoToScreen(0,    0, vw);
  const bR  = isoToScreen(COLS, 0, vw);
  const bx0 = bL.x - hw, by0 = bL.y;   // bottom-left corner
  const bx1 = bR.x - hw, by1 = bR.y;   // bottom-right corner

  // Main face
  const gB = c.createLinearGradient(0, by0 - WALL_H, 0, by0);
  gB.addColorStop(0, '#200e62'); gB.addColorStop(0.35, '#150942'); gB.addColorStop(1, '#0c0428');
  c.beginPath();
  c.moveTo(bx0, by0); c.lineTo(bx0, by0 - WALL_H);
  c.lineTo(bx1, by1 - WALL_H); c.lineTo(bx1, by1);
  c.closePath(); c.fillStyle = gB; c.fill();
  c.strokeStyle = 'rgba(88,28,220,.10)'; c.lineWidth = 0.5; c.stroke();

  // Baseboard
  c.beginPath();
  c.moveTo(bx0, by0); c.lineTo(bx0, by0 - 7);
  c.lineTo(bx1, by1 - 7); c.lineTo(bx1, by1);
  c.closePath(); c.fillStyle = '#5b21b6'; c.fill();

  // Ceiling trim
  c.beginPath();
  c.moveTo(bx0, by0 - WALL_H); c.lineTo(bx0, by0 - WALL_H + 9);
  c.lineTo(bx1, by1 - WALL_H + 9); c.lineTo(bx1, by1 - WALL_H);
  c.closePath(); c.fillStyle = 'rgba(139,92,246,.20)'; c.fill();

  // Thin highlight seam at the very top (back wall — no windows here)
  c.beginPath(); c.moveTo(bx0, by0 - WALL_H); c.lineTo(bx1, by1 - WALL_H);
  c.strokeStyle = '#7c3aed'; c.lineWidth = 1.5; c.stroke();

  // ── Left wall: row 0 → ROWS at col = 0 — windows go on THIS wall ─────────
  // Use the right-vertex (x + hw, y) — also a perfect iso slope line.
  const lT  = isoToScreen(0, 0,    vw);
  const lB  = isoToScreen(0, ROWS, vw);
  const lx0 = lT.x + hw, ly0 = lT.y;  // top corner (shared with back wall)
  const lx1 = lB.x + hw, ly1 = lB.y;  // bottom corner

  const gL = c.createLinearGradient(0, ly0 - WALL_H, 0, ly0);
  gL.addColorStop(0, '#170a44'); gL.addColorStop(0.35, '#0f062e'); gL.addColorStop(1, '#09031f');
  c.beginPath();
  c.moveTo(lx0, ly0); c.lineTo(lx0, ly0 - WALL_H);
  c.lineTo(lx1, ly1 - WALL_H); c.lineTo(lx1, ly1);
  c.closePath(); c.fillStyle = gL; c.fill();
  c.strokeStyle = 'rgba(88,28,220,.10)'; c.lineWidth = 0.5; c.stroke();

  // Baseboard
  c.beginPath();
  c.moveTo(lx0, ly0); c.lineTo(lx0, ly0 - 7);
  c.lineTo(lx1, ly1 - 7); c.lineTo(lx1, ly1);
  c.closePath(); c.fillStyle = '#4c1d95'; c.fill();

  // Ceiling trim
  c.beginPath();
  c.moveTo(lx0, ly0 - WALL_H); c.lineTo(lx0, ly0 - WALL_H + 9);
  c.lineTo(lx1, ly1 - WALL_H + 9); c.lineTo(lx1, ly1 - WALL_H);
  c.closePath(); c.fillStyle = 'rgba(109,40,217,.18)'; c.fill();

  // Top seam
  c.beginPath(); c.moveTo(lx0, ly0 - WALL_H); c.lineTo(lx1, ly1 - WALL_H);
  c.strokeStyle = '#6d28d9'; c.lineWidth = 1.5; c.stroke();


  // ── Corner cap: fills the gap between the two wall faces at the corner ────
  const corner = isoToScreen(0, 0, vw);
  const cx = corner.x, cy = corner.y - th;
  c.beginPath();
  c.moveTo(bx0, by0); c.lineTo(bx0, by0 - WALL_H);   // back wall left edge
  c.lineTo(cx,  cy  - WALL_H);                         // top corner
  c.lineTo(lx0, ly0 - WALL_H);                         // left wall top edge
  c.lineTo(lx0, ly0);                                   // left wall bottom
  c.lineTo(cx,  cy);                                    // corner top vertex (floor)
  c.closePath();
  const gCorner = c.createLinearGradient(bx0, by0 - WALL_H, lx0, ly0);
  gCorner.addColorStop(0, '#1c0c50'); gCorner.addColorStop(1, '#130838');
  c.fillStyle = gCorner; c.fill();
}

// ── Furniture (sprite-first, procedural fallback) ──────────────────────────

function desk(c: CanvasRenderingContext2D, col: number, row: number, vw: number) {
  const { x, y } = isoToScreen(col, row, vw);

  // Chair first (drawn behind desk)
  if (!drawTileSprite(c, 'chair', x - 14, y + 6, 62, 72)) {
    // procedural chair
    c.beginPath(); c.moveTo(x - 6, y + 4); c.lineTo(x, y); c.lineTo(x - 6, y - 4); c.lineTo(x - 12, y); c.closePath();
    c.fillStyle = '#1e1060'; c.fill();
  }

  // Desk
  if (!drawTileSprite(c, 'desk', x + 6, y, 108, 82)) {
    // procedural desk fallback
    const hw = TW / 2 - 7, dhh = TH / 2 - 4, top = -14;
    const dg = c.createLinearGradient(x - hw, y + top, x + hw, y + top);
    dg.addColorStop(0, '#28187a'); dg.addColorStop(1, '#1c1060');
    c.beginPath();
    c.moveTo(x, y - dhh + top); c.lineTo(x + hw, y + top); c.lineTo(x, y + dhh + top); c.lineTo(x - hw, y + top);
    c.closePath(); c.fillStyle = dg; c.fill(); c.strokeStyle = '#5b21b6'; c.lineWidth = 0.7; c.stroke();
  }
}

function plant(c: CanvasRenderingContext2D, col: number, row: number, vw: number) {
  const { x, y } = isoToScreen(col, row, vw);
  if (!drawTileSprite(c, 'plant', x, y, 52, 72)) {
    // procedural fallback
    c.beginPath(); c.ellipse(x, y + 6, 9, 5, 0, 0, Math.PI * 2); c.fillStyle = '#581c87'; c.fill();
    [[0,-12,7,'#14532d'],[-7,-17,6,'#15803d'],[7,-16,5,'#166534'],[0,-22,7,'#16a34a']].forEach(([dx, dy, r, color]) => {
      c.beginPath(); c.arc(x + (dx as number), y + (dy as number), r as number, 0, Math.PI * 2); c.fillStyle = color as string; c.fill();
    });
  }
}

// ── Main export ────────────────────────────────────────────────────────────

export function drawFloor(canvas: HTMLCanvasElement) {
  const vw = canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const c = canvas.getContext('2d')!;
  c.clearRect(0, 0, vw, canvas.height);

  for (let r = 0; r < ROWS; r++)
    for (let col = 0; col < COLS; col++)
      tile(c, col, r, vw);

  // Ceiling ambient lights — one per desk cluster
  ([
    [4,  6, 'rgba(160,140,255,.05)', 110],
    [8,  6, 'rgba(140,120,255,.04)', 100],
    [12, 6, 'rgba(150,130,255,.04)', 100],
    [16, 6, 'rgba(160,140,255,.05)', 110],
  ] as [number, number, string, number][]).forEach(([col, row, color, r]) => {
    const { x, y } = isoToScreen(col, row, vw);
    ambientLight(c, x, y, r, color);
  });

  walls(c, vw);

  // 4×2 desk grid: cols 4/8/12/16, rows 4/8
  [[4,4],[8,4],[12,4],[16,4],[4,8],[8,8],[12,8],[16,8]].forEach(([col, row]) => desk(c, col, row, vw));

  // 2 plants — inside the wall boundary
  [[3,2],[17,12]].forEach(([col, row]) => plant(c, col, row, vw));
}
