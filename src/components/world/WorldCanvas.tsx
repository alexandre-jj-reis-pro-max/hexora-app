// src/components/world/WorldCanvas.tsx
import { useEffect, useRef, useCallback, useState } from 'react';
import { drawSprite } from '../../engine/sprites';
import { loadSprite, getSheet, drawSheet } from '../../engine/spritesheets';
import { TILE_S } from '../../engine/iso';
import { TEAM, SPD, LOUSA_POS } from '../../constants';
import { loadOfficeAssets, getTile, getFloorImg, getWallImg, MONITOR_POS, MONITOR_TILES_W, MONITOR_TILES_H, COLS, ROWS } from '../../engine/office-layout';
import { loadFurniture, drawFurniture } from '../../engine/furniture';
import { useProfileStore } from '../../store/useProfileStore';

export type BubbleMap = Map<string, { text: string; isCoord: boolean }>;

export interface RuntimeAgent {
  id: string;
  name: string;
  role: string;
  color: string;
  isCoord: boolean;
  sprite: string;
  desk: { col: number; row: number };
  gx: number;
  gy: number;
  tx: number;
  ty: number;
  dir: string;
  ws: number;
  moving: boolean;
  state: 'walking' | 'idle' | 'working';
  workTick: number;
  cooldown: number;
  bubble: string | null;
  bubbleIsCoord: boolean;
  bubbleTimer: number;
  interactTarget: (() => void) | null;
  path: Array<{ col: number; row: number }>;
}

type WorldCanvasProps = {
  onAgentClick: (agentId: string) => void;
  agentBubbles: BubbleMap;
  className?: string;
};

// ── Waypoint helpers ──────────────────────────────────────────────────────────

function buildPathTo(
  desk: { col: number; row: number },
  dest: { col: number; row: number },
): Array<{ col: number; row: number }> {
  return [
    { col: dest.col, row: desk.row },
    { col: dest.col, row: dest.row },
  ];
}

function buildPathBack(
  desk: { col: number; row: number },
  from: { col: number; row: number },
): Array<{ col: number; row: number }> {
  return [
    { col: from.col, row: desk.row },
    { col: desk.col, row: desk.row },
  ];
}

// ── Sprite dimensions (1 tile wide × 2 tiles tall at zoom 4) ─────────────────
const SPRITE_W = TILE_S;       // 64
const SPRITE_H = TILE_S * 2;   // 128
const GROUND_OFFSET = 20;      // px to shift sprite down (compensate transparent top padding)

// ── Tile rendering ────────────────────────────────────────────────────────────

function drawOffice(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  ox: number,
  oy: number,
) {
  ctx.imageSmoothingEnabled = false;

  const wallImg  = getWallImg();
  const floorImg = getFloorImg(1); // floor_1 = wood pattern (grayscale → tinted below)

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const tile = getTile(col, row);
      const x = ox + col * TILE_S;
      const y = oy + row * TILE_S;

      if (x + TILE_S < 0 || x > canvasW || y + TILE_S < 0 || y > canvasH) continue;

      if (tile === 0) {
        // ── Wall ──────────────────────────────────────────────────────────
        if (wallImg?.complete && wallImg.naturalWidth > 0) {
          ctx.drawImage(wallImg, x, y, TILE_S, TILE_S);
          // Darken wall tile
          ctx.fillStyle = 'rgba(20,10,40,0.55)';
          ctx.fillRect(x, y, TILE_S, TILE_S);
        } else {
          ctx.fillStyle = '#1a1030';
          ctx.fillRect(x, y, TILE_S, TILE_S);
          // Subtle wall pattern
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          for (let i = 0; i < TILE_S; i += 8) {
            ctx.fillRect(x, y + i, TILE_S, 1);
          }
        }
      } else {
        // ── Floor ─────────────────────────────────────────────────────────
        if (floorImg?.complete && floorImg.naturalWidth > 0) {
          // Draw grayscale tile then tint it warm using a temp canvas to avoid
          // composite bleed onto the rest of the scene
          ctx.save();
          ctx.drawImage(floorImg, x, y, TILE_S, TILE_S);
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = '#d4945a';
          ctx.fillRect(x, y, TILE_S, TILE_S);
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
        } else {
          ctx.fillStyle = '#c8865a';
          ctx.fillRect(x, y, TILE_S, TILE_S);
        }

        // Subtle tile grout line
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE_S - 1, TILE_S - 1);
      }
    }
  }

  // ── Room shadow (inner border) ─────────────────────────────────────────────
  const roomX = ox + TILE_S;
  const roomY = oy + TILE_S;
  const roomW = (COLS - 2) * TILE_S;
  ctx.shadowColor = 'transparent';
  const grad = ctx.createLinearGradient(roomX, roomY, roomX, roomY + 24);
  grad.addColorStop(0, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(roomX, roomY, roomW, 24);

}

// ── Command Monitor (procedural) ──────────────────────────────────────────────

function drawKanbanBoard(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  frame: number,
  squadAgentIds: string[],
) {
  const bx = ox + MONITOR_POS.col * TILE_S;
  const by = oy + MONITOR_POS.row * TILE_S;
  const bw = MONITOR_TILES_W * TILE_S;  // 192
  const bh = MONITOR_TILES_H * TILE_S;  // 128

  // ── Board body (dark wood frame) ──────────────────────────────────
  ctx.fillStyle = '#1c1410';
  ctx.fillRect(bx, by, bw, bh);

  // Wood frame border
  ctx.strokeStyle = '#3d2b1f';
  ctx.lineWidth = 4;
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);

  // Inner frame highlight
  ctx.strokeStyle = '#4a3628';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

  // ── Board surface (dark green chalkboard) ─────────────────────────
  const pad = 6;
  const sx = bx + pad;
  const sy = by + pad;
  const sw = bw - pad * 2;
  const sh = bh - pad * 2;

  const boardGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
  boardGrad.addColorStop(0, '#1a2a1a');
  boardGrad.addColorStop(0.5, '#1e2e1c');
  boardGrad.addColorStop(1, '#172017');
  ctx.fillStyle = boardGrad;
  ctx.fillRect(sx, sy, sw, sh);

  // Subtle chalk dust texture
  ctx.fillStyle = 'rgba(255,255,255,0.015)';
  for (let i = 0; i < 20; i++) {
    const dx = sx + ((i * 37 + 11) % sw);
    const dy = sy + ((i * 53 + 7) % sh);
    ctx.fillRect(dx, dy, 2, 1);
  }

  // ── Column headers ────────────────────────────────────────────────
  const colW = Math.floor(sw / 3);
  const headerH = 14;
  const headerY = sy + 3;

  const columns = [
    { label: 'TO DO',   color: '#ef4444' },
    { label: 'DOING',   color: '#f59e0b' },
    { label: 'DONE',    color: '#22c55e' },
  ];

  columns.forEach((col, ci) => {
    const cx = sx + ci * colW;

    // Header background
    ctx.fillStyle = col.color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(cx + 2, headerY, colW - 4, headerH);
    ctx.globalAlpha = 1;

    // Header text (chalk style)
    ctx.fillStyle = col.color;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(col.label, cx + colW / 2, headerY + 10);
  });

  // Column divider lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const lx = sx + i * colW;
    ctx.beginPath();
    ctx.moveTo(lx, sy + headerH + 5);
    ctx.lineTo(lx, sy + sh - 4);
    ctx.stroke();
  }

  // ── Post-it notes (agents as cards) ───────────────────────────────
  const agents = TEAM.filter(t => !t.isCoord);
  const cardW = colW - 8;
  const cardH = 18;
  const cardGap = 3;
  const cardsStartY = sy + headerH + 8;

  // Split agents into columns: inactive → TO DO, active → DOING
  const todoAgents = agents.filter(t => !squadAgentIds.includes(t.id));
  const doingAgents = agents.filter(t => squadAgentIds.includes(t.id));

  // Draw cards in TO DO column
  todoAgents.forEach((t, i) => {
    const cx = sx + 4;
    const cy = cardsStartY + i * (cardH + cardGap);
    if (cy + cardH > sy + sh - 4) return;

    // Post-it shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx + 1, cy + 1, cardW, cardH);

    // Post-it body (desaturated)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(cx, cy, cardW, cardH);

    // Agent color strip on left
    ctx.fillStyle = t.color;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(cx, cy, 3, cardH);
    ctx.globalAlpha = 1;

    // Role
    ctx.fillStyle = '#7a7a7a';
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(t.role, cx + 6, cy + 7);

    // Name
    ctx.fillStyle = '#9ca3af';
    ctx.font = '5px monospace';
    ctx.fillText(t.name, cx + 6, cy + 14);
  });

  // Draw cards in DOING column (active agents)
  doingAgents.forEach((t, i) => {
    const cx = sx + colW + 4;
    const cy = cardsStartY + i * (cardH + cardGap);
    if (cy + cardH > sy + sh - 4) return;

    // Subtle glow behind card
    ctx.shadowColor = t.color;
    ctx.shadowBlur = 4;

    // Post-it shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(cx + 1, cy + 1, cardW, cardH);

    // Post-it body (agent color tinted)
    ctx.fillStyle = t.color;
    ctx.globalAlpha = 0.2;
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.globalAlpha = 1;

    // Brighter border
    ctx.strokeStyle = t.color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, cardW, cardH);
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Agent color strip
    ctx.fillStyle = t.color;
    ctx.fillRect(cx, cy, 3, cardH);

    // Role (bright, highlighted)
    ctx.fillStyle = t.color;
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(t.role, cx + 6, cy + 7);

    // Name
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '5px monospace';
    ctx.fillText(t.name, cx + 6, cy + 14);

    // Subtle pulse dot
    const pulse = 0.4 + 0.6 * Math.sin(frame * 0.04 + i * 1.5);
    ctx.fillStyle = t.color;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(cx + cardW - 5, cy + cardH / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // ── Title at top (chalk text) ─────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '6px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('HEXORA', bx + bw - 10, by + bh - 5);

  ctx.textAlign = 'left';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorldCanvas({ onAgentClick, agentBubbles, className }: WorldCanvasProps) {
  const squadAgentIds = useProfileStore((s) => s.squadAgentIds);

  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const offscreenRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const agentsRef     = useRef<RuntimeAgent[]>([]);
  const rafRef        = useRef<number>(0);
  const frameRef      = useRef(0);
  const [, forceRender] = useState(0);

  // ── Load assets ───────────────────────────────────────────────────────────
  useEffect(() => {
    loadOfficeAssets();
    loadFurniture();
    TEAM.forEach((def) => { loadSprite(def.id).catch(() => {}); });
  }, []);

  // ── Offscreen sprite canvases ─────────────────────────────────────────────
  useEffect(() => {
    TEAM.filter((d) => !d.isCoord).forEach((def) => {
      const c = document.createElement('canvas');
      c.width = SPRITE_W; c.height = SPRITE_H;
      offscreenRefs.current.set(def.id, c);
    });
  }, []);

  // ── Resize canvas ─────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;
    const resize = () => { canvas.width = container.clientWidth; canvas.height = container.clientHeight; };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Init agents ───────────────────────────────────────────────────────────
  useEffect(() => {
    agentsRef.current = TEAM.map((def) => ({
      ...def,
      gx: def.desk.col, gy: def.desk.row,
      tx: def.desk.col, ty: def.desk.row,
      dir: 'down', ws: 0, moving: false,
      state: 'idle' as const, workTick: 0,
      cooldown: Math.floor(Math.random() * 80),
      bubble: null, bubbleIsCoord: false, bubbleTimer: 0,
      interactTarget: null, path: [],
    }));

    window._agents   = agentsRef.current;
    window._coordPos = LOUSA_POS;
    window._boardPos = { x: 0, y: 0 };

    window._walkToLousa = (agentId: string, onArrive?: () => void) => {
      const a = agentsRef.current.find((x) => x.id === agentId);
      if (!a || a.isCoord) return;
      a.path  = buildPathTo(a.desk, LOUSA_POS);
      a.state = 'walking';
      a.interactTarget = () => {
        onArrive?.();
        a.path = buildPathBack(a.desk, LOUSA_POS);
      };
      a.moving = false;
    };

    window._setAgentWorking = (agentId: string, working: boolean) => {
      const a = agentsRef.current.find((x) => x.id === agentId);
      if (!a || a.isCoord) return;
      if (working) { a.state = 'working'; a.workTick = 0; }
      else if (a.state === 'working') { a.state = a.moving ? 'walking' : 'idle'; }
    };
  }, []);

  // ── Step ──────────────────────────────────────────────────────────────────
  const step = useCallback((a: RuntimeAgent) => {
    if (!a.moving && a.path.length > 0) {
      const next = a.path.shift()!;
      a.tx = next.col; a.ty = next.row;
      a.moving = true;
      if (a.state !== 'working') a.state = 'walking';
    }

    if (!a.moving) {
      a.workTick++; // always tick — used for desk typing animation too
      return;
    }

    const dx = a.tx - a.gx, dy = a.ty - a.gy;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < 0.06) {
      a.gx = a.tx; a.gy = a.ty;
      a.moving = false;
      if (a.state === 'walking') a.state = 'idle';
      if (a.path.length === 0 && a.interactTarget) {
        a.interactTarget();
        a.interactTarget = null;
      }
      return;
    }

    a.gx += (dx / d) * SPD;
    a.gy += (dy / d) * SPD;
    a.dir = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    a.ws++;
  }, []);

  // ── Grid offset (centre the office in the container) ───────────────────────
  const getOffset = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return { ox: 0, oy: 0 };
    const ox = Math.max(0, Math.round((canvas.width  - COLS * TILE_S) / 2));
    const oy = Math.max(0, Math.round((canvas.height - ROWS * TILE_S) / 2));
    return { ox, oy };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const { ox, oy } = getOffset();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background (outside the office)
    ctx.fillStyle = '#0d0720';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    frameRef.current++;

    // Floor + walls
    drawOffice(ctx, canvas.width, canvas.height, ox, oy);

    // Kanban board (on wall)
    drawKanbanBoard(ctx, ox, oy, frameRef.current, squadAgentIds);

    // Furniture (desks, chairs, plants, etc.)
    drawFurniture(ctx, ox, oy);

    // Update agents
    agentsRef.current.forEach((a) => {
      if (a.cooldown > 0) a.cooldown--;
      step(a);
    });

    // Z-sort: higher row = drawn later (in front)
    const sorted = agentsRef.current
      .filter((a) => !a.isCoord)
      .sort((a, b) => a.gy - b.gy);

    sorted.forEach((a) => {
      const offscreen = offscreenRefs.current.get(a.id);
      if (!offscreen) return;

      const offCtx = offscreen.getContext('2d')!;
      offCtx.imageSmoothingEnabled = false;
      offCtx.clearRect(0, 0, SPRITE_W, SPRITE_H);

      const sheet    = getSheet(a.id);
      const inSquad  = squadAgentIds.includes(a.id);

      // Is the agent near their desk? (within 1 tile)
      const atDesk = Math.abs(a.gx - a.desk.col) < 1.2 && Math.abs(a.gy - a.desk.row) < 1.2;

      // Decide animation frame
      let wsForDraw = a.ws;
      let drawState: 'walking' | 'idle' | 'working' = a.state;

      if (a.state === 'idle' && atDesk) {
        // At desk doing nothing → typing at computer
        drawState = 'working';
        wsForDraw = Math.floor(a.workTick * 0.3);
      } else if (a.state === 'idle' && !atDesk) {
        // Standing somewhere (whiteboard, etc.) → still
        drawState = 'idle';
        wsForDraw = 0;
      } else if (a.state === 'working') {
        // LLM processing (usually at whiteboard) → stand still with glow
        drawState = 'idle';
        wsForDraw = 0;
      }
      // walking → keeps a.ws as-is

      if (sheet) {
        drawSheet(offCtx, sheet, a.dir, wsForDraw, SPRITE_W, SPRITE_H, drawState);
      } else {
        drawSprite(offCtx, a.color, a.dir, wsForDraw, a.sprite);
      }

      // Agent feet anchored to bottom of their tile
      const screenX = ox + a.gx * TILE_S;
      const screenY = oy + a.gy * TILE_S;
      const drawX   = screenX - SPRITE_W / 2 + TILE_S / 2;
      const drawY   = screenY - SPRITE_H + TILE_S + GROUND_OFFSET;

      // Seated offset only when at desk
      const yOffset = atDesk && !a.moving ? 8 : 0;

      const isLLMWorking = a.state === 'working';

      ctx.save();
      ctx.globalAlpha = inSquad ? 1 : 0.25;
      if (!inSquad) ctx.filter = 'grayscale(1)';
      if (isLLMWorking && inSquad) {
        ctx.shadowColor = a.color;
        ctx.shadowBlur  = 12 + Math.sin(a.workTick * 0.08) * 6;
      }
      ctx.drawImage(offscreen, drawX, drawY + yOffset, SPRITE_W, SPRITE_H);
      ctx.restore();

      // Working dot — only during LLM processing
      if (isLLMWorking && inSquad) {
        const pulse = 0.5 + 0.5 * Math.sin(a.workTick * 0.15);
        ctx.save();
        ctx.globalAlpha = 0.7 + 0.3 * pulse;
        ctx.fillStyle   = a.color;
        ctx.shadowColor = a.color;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(drawX + SPRITE_W / 2, drawY + yOffset - 6, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }, [step, squadAgentIds, getOffset]);

  // ── RAF loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const loop = () => {
      renderFrame();
      forceRender((v) => v + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  const handleClick = useCallback((agentId: string) => {
    const a = agentsRef.current.find((x) => x.id === agentId);
    if (!a || a.cooldown > 0) return;
    onAgentClick(agentId);
    a.cooldown = 100;
  }, [onAgentClick]);

  // ── DOM overlay positions ─────────────────────────────────────────────────
  const { ox, oy } = getOffset();

  const agentScreenPos = (a: RuntimeAgent | undefined, def: { desk: { col: number; row: number } }) => {
    const gx = a?.gx ?? def.desk.col;
    const gy = a?.gy ?? def.desk.row;
    return {
      x: ox + gx * TILE_S + TILE_S / 2,
      y: oy + gy * TILE_S + TILE_S,
    };
  };

  // Command monitor overlay position
  const monX = ox + MONITOR_POS.col * TILE_S;
  const monY = oy + MONITOR_POS.row * TILE_S;
  const monW = MONITOR_TILES_W * TILE_S;
  const monH = MONITOR_TILES_H * TILE_S;
  const coordBubble = agentBubbles.get('coord');

  return (
    <div ref={containerRef} className={className || 'relative w-full h-full overflow-hidden'}>

      {/* Single canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', top: 0, left: 0, imageRendering: 'pixelated', pointerEvents: 'none' }}
      />

      {/* Name labels (role + name) */}
      {TEAM.filter((d) => !d.isCoord).map((def) => {
        const a = agentsRef.current.find((x) => x.id === def.id);
        const { x, y } = agentScreenPos(a, def);
        const inSquad = squadAgentIds.includes(def.id);
        return (
          <div key={`name-${def.id}`} className="absolute pointer-events-none" style={{
            left: x, top: y + 2,
            transform: 'translateX(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap', zIndex: 50,
            opacity: inSquad ? 1 : 0.35,
            transition: 'opacity .3s',
          }}>
            <div style={{
              fontFamily: 'VT323, monospace', fontSize: '9px',
              color: inSquad ? def.color : '#4b5563',
              letterSpacing: '0.08em',
              textShadow: '0 1px 3px rgba(0,0,0,.95)',
              lineHeight: 1,
            }}>
              {def.role}
            </div>
            <div style={{
              fontFamily: 'VT323, monospace', fontSize: '11px',
              color: inSquad ? '#e2e8f0' : '#374151',
              letterSpacing: '0.04em',
              textShadow: `0 1px 4px rgba(0,0,0,.9)${inSquad ? `, 0 0 6px ${def.color}40` : ''}`,
              lineHeight: 1,
              marginTop: 1,
            }}>
              {def.name}
            </div>
          </div>
        );
      })}

      {/* Command Monitor click area */}
      <CommandMonitorOverlay
        x={monX} y={monY} w={monW} h={monH}
        bubble={coordBubble}
        onClick={() => handleClick('coord')}
      />

      {/* Hitboxes */}
      {TEAM.filter((d) => !d.isCoord).map((def) => {
        const a = agentsRef.current.find((x) => x.id === def.id);
        const { x, y } = agentScreenPos(a, def);
        return (
          <div key={def.id} className="absolute cursor-pointer" style={{
            left: x - SPRITE_W / 2, top: y - SPRITE_H,
            width: SPRITE_W, height: SPRITE_H, zIndex: 100,
          }} onClick={() => handleClick(def.id)} />
        );
      })}

      {/* Speech bubbles */}
      {Array.from(agentBubbles.entries()).filter(([id]) => id !== 'coord').map(([id, bubble]) => {
        const a = agentsRef.current.find((x) => x.id === id);
        if (!a) return null;
        const x = ox + a.gx * TILE_S + TILE_S / 2;
        const y = oy + a.gy * TILE_S;
        return (
          <div key={id} className="absolute pointer-events-none" style={{
            left: `${x}px`, top: `${y - 80}px`,
            transform: 'translateX(-50%)', zIndex: 10000,
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b, #0f172a)', color: '#f1f5f9',
              fontFamily: 'VT323, monospace', fontSize: '14px',
              padding: '8px 16px', borderRadius: '20px',
              border: '1px solid #334155', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              whiteSpace: 'nowrap', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', bottom: '-8px', left: '50%',
                transform: 'translateX(-50%)',
                borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
                borderTop: '8px solid #1e1b4b',
              }} />
              💬 {bubble.text}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Command Monitor Overlay ───────────────────────────────────────────────────

type CommandMonitorOverlayProps = {
  x: number; y: number; w: number; h: number;
  bubble?: { text: string; isCoord: boolean };
  onClick: () => void;
};

function CommandMonitorOverlay({ x, y, w, h, bubble, onClick }: CommandMonitorOverlayProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <>
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute',
          left: x, top: y, width: w, height: h,
          zIndex: 200, cursor: 'pointer',
          transition: 'filter .2s',
          filter: hovered ? 'drop-shadow(0 0 20px rgba(124,58,237,.5))' : 'none',
          border: `2px solid ${hovered ? 'rgba(124,58,237,.5)' : 'transparent'}`,
          borderRadius: 4,
          boxSizing: 'border-box',
        }}
      >
        {hovered && (
          <div style={{
            position: 'absolute', top: -18, left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'VT323, monospace', fontSize: '11px',
            letterSpacing: '0.12em', color: '#a78bfa',
            textShadow: '0 1px 6px rgba(0,0,0,.8)',
            whiteSpace: 'nowrap',
          }}>
            KANBAN ▶
          </div>
        )}
      </div>

      {bubble && (
        <div className="pointer-events-none" style={{
          position: 'absolute',
          left: x + w / 2,
          top: y - 45,
          transform: 'translateX(-50%)',
          zIndex: 10000,
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#f1f5f9',
            fontFamily: 'VT323, monospace', fontSize: '14px',
            padding: '8px 16px', borderRadius: '20px',
            border: '1px solid #a78bfa', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', bottom: '-8px', left: '50%', transform: 'translateX(-50%)',
              borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
              borderTop: '8px solid #7c3aed',
            }} />
            🎯 {bubble.text}
          </div>
        </div>
      )}
    </>
  );
}
