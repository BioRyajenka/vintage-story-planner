import { useEffect, useRef, useState, useCallback } from 'react';
import type { GridItem, ItemType, Peer, PeerCursor } from '../types';
import { GridItemComponent } from './GridItemComponent';

interface GridProps {
  items: GridItem[];
  selectedTool: ItemType;
  selectedColor: string;
  onAddItem: (item: GridItem) => void;
  onUpdateItem: (id: string, updates: Partial<GridItem>) => void;
  onRemoveItem: (id: string) => void;
  onReplacePathways: (removeIds: string[], add: GridItem[]) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  zoom: number;
  onZoomChange: (next: number, anchor?: { px: number; py: number }) => void;
  peers: Record<string, Peer>;
  mySessionId: string | null;
  onCursor: (cursor: PeerCursor | null) => void;
}

export const BASE_CELL = 40;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;

type PathwayMutation = { remove: string[]; add: GridItem[] };

function planPathwayMutation(
  startCell: { x: number; y: number },
  endCell: { x: number; y: number },
  color: string,
  existing: GridItem[]
): PathwayMutation | null {
  const dx = Math.abs(endCell.x - startCell.x);
  const dy = Math.abs(endCell.y - startCell.y);
  const horizontal = dx >= dy;

  const axis = horizontal ? startCell.y : startCell.x;
  let segStart: number;
  let segEnd: number;
  if (horizontal) {
    segStart = Math.min(startCell.x, endCell.x);
    segEnd = Math.max(startCell.x, endCell.x);
  } else {
    segStart = Math.min(startCell.y, endCell.y);
    segEnd = Math.max(startCell.y, endCell.y);
  }

  const colinear = existing.filter((it) => {
    if (it.type !== 'pathway') return false;
    if (horizontal) return it.height === 1 && it.y === axis;
    return it.width === 1 && it.x === axis;
  });

  const rangeOf = (it: GridItem): [number, number] => {
    if (horizontal) return [it.x, it.x + it.width - 1];
    return [it.y, it.y + it.height - 1];
  };

  const container = colinear.find((it) => {
    const [s, e] = rangeOf(it);
    return s <= segStart && e >= segEnd;
  });

  const makeSeg = (s: number, e: number, suffix = ''): GridItem => {
    const len = e - s + 1;
    const baseId = `pathway-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${suffix}`;
    if (horizontal) {
      return { id: baseId, type: 'pathway', x: s, y: axis, width: len, height: 1, color };
    }
    return { id: baseId, type: 'pathway', x: axis, y: s, width: 1, height: len, color };
  };

  if (container) {
    const [cs, ce] = rangeOf(container);
    const add: GridItem[] = [];
    if (segStart > cs) add.push(makeSeg(cs, segStart - 1, '-a'));
    if (segEnd < ce) add.push(makeSeg(segEnd + 1, ce, '-b'));
    return { remove: [container.id], add };
  }

  let mergeStart = segStart;
  let mergeEnd = segEnd;
  const mergedIds = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of colinear) {
      if (mergedIds.has(it.id)) continue;
      const [s, e] = rangeOf(it);
      if (e >= mergeStart - 1 && s <= mergeEnd + 1) {
        mergeStart = Math.min(mergeStart, s);
        mergeEnd = Math.max(mergeEnd, e);
        mergedIds.add(it.id);
        changed = true;
      }
    }
  }

  return { remove: Array.from(mergedIds), add: [makeSeg(mergeStart, mergeEnd)] };
}

export function Grid({
  items,
  selectedTool,
  selectedColor,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onReplacePathways,
  hoveredId,
  onHover,
  zoom,
  onZoomChange,
  peers,
  mySessionId,
  onCursor,
}: GridProps) {
  const cellPx = BASE_CELL * zoom;

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startCell, setStartCell] = useState<{ x: number; y: number } | null>(null);
  const [currentCell, setCurrentCell] = useState<{ x: number; y: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveCell, setMoveCell] = useState<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const movingItem = movingId ? items.find((i) => i.id === movingId) ?? null : null;

  const cellFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = viewportRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      return {
        x: Math.floor((px - pan.x) / cellPx),
        y: Math.floor((py - pan.y) / cellPx),
        worldX: (px - pan.x) / cellPx,
        worldY: (py - pan.y) / cellPx,
        px,
        py,
      };
    },
    [pan, cellPx]
  );

  useEffect(() => {
    if (!movingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMovingId(null);
        setMoveCell(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [movingId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0025);
        const rect = el.getBoundingClientRect();
        onZoomChange(
          Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor)),
          { px: e.clientX - rect.left, py: e.clientY - rect.top }
        );
      } else {
        e.preventDefault();
        setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoom, onZoomChange]);

  const handleStartMove = useCallback((id: string) => {
    setMovingId(id);
    setMoveCell(null);
    setIsDrawing(false);
    setStartCell(null);
    setCurrentCell(null);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const c = cellFromClient(e.clientX, e.clientY);
      if (!c) return;

      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        return;
      }
      if (e.button !== 0) return;

      if (movingItem) {
        onUpdateItem(movingItem.id, { x: c.x, y: c.y });
        setMovingId(null);
        setMoveCell(null);
        return;
      }

      setIsDrawing(true);
      setStartCell({ x: c.x, y: c.y });
      setCurrentCell({ x: c.x, y: c.y });
    },
    [cellFromClient, movingItem, onUpdateItem, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const c = cellFromClient(e.clientX, e.clientY);
      if (c) onCursor({ x: c.worldX, y: c.worldY });
      if (isPanning && panStart.current) {
        setPan({
          x: panStart.current.px + (e.clientX - panStart.current.x),
          y: panStart.current.py + (e.clientY - panStart.current.y),
        });
        return;
      }
      if (movingItem && c) {
        setMoveCell({ x: c.x, y: c.y });
        return;
      }
      if (isDrawing && startCell && c) {
        setCurrentCell({ x: c.x, y: c.y });
      }
    },
    [cellFromClient, isDrawing, isPanning, movingItem, onCursor, startCell]
  );

  const finishDrawing = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
      return;
    }
    if (!isDrawing || !startCell || !currentCell) {
      setIsDrawing(false);
      setStartCell(null);
      setCurrentCell(null);
      return;
    }

    if (selectedTool === 'pathway') {
      const mutation = planPathwayMutation(startCell, currentCell, selectedColor, items);
      if (mutation) onReplacePathways(mutation.remove, mutation.add);
      setIsDrawing(false);
      setStartCell(null);
      setCurrentCell(null);
      return;
    }

    const x = Math.min(startCell.x, currentCell.x);
    const y = Math.min(startCell.y, currentCell.y);
    const width = Math.abs(currentCell.x - startCell.x) + 1;
    const height = Math.abs(currentCell.y - startCell.y) + 1;

    const finalWidth = selectedTool === 'small' ? 1 : width;
    const finalHeight = selectedTool === 'small' ? 1 : height;

    let label: string | undefined;

    if (selectedTool === 'building') {
      const input = prompt('Enter building name:');
      if (!input || !input.trim()) {
        setIsDrawing(false);
        setStartCell(null);
        setCurrentCell(null);
        return;
      }
      label = input.trim();
    } else if (selectedTool === 'small') {
      const input = prompt('Enter item name:');
      if (!input || !input.trim()) {
        setIsDrawing(false);
        setStartCell(null);
        setCurrentCell(null);
        return;
      }
      label = input.trim();
    }

    onAddItem({
      id: `item-${Date.now()}`,
      type: selectedTool,
      x,
      y,
      width: finalWidth,
      height: finalHeight,
      color: selectedColor,
      label,
    });
    setIsDrawing(false);
    setStartCell(null);
    setCurrentCell(null);
  }, [
    isDrawing,
    isPanning,
    startCell,
    currentCell,
    selectedTool,
    selectedColor,
    items,
    onAddItem,
    onReplacePathways,
  ]);

  const previewRect = (() => {
    if (!isDrawing || !startCell || !currentCell) return null;
    if (selectedTool === 'pathway') {
      const dx = Math.abs(currentCell.x - startCell.x);
      const dy = Math.abs(currentCell.y - startCell.y);
      const horizontal = dx >= dy;
      if (horizontal) {
        return {
          x: Math.min(startCell.x, currentCell.x),
          y: startCell.y,
          width: dx + 1,
          height: 1,
        };
      }
      return {
        x: startCell.x,
        y: Math.min(startCell.y, currentCell.y),
        width: 1,
        height: dy + 1,
      };
    }
    const x = Math.min(startCell.x, currentCell.x);
    const y = Math.min(startCell.y, currentCell.y);
    const width = Math.abs(currentCell.x - startCell.x) + 1;
    const height = Math.abs(currentCell.y - startCell.y) + 1;
    return {
      x,
      y,
      width: selectedTool === 'small' ? 1 : width,
      height: selectedTool === 'small' ? 1 : height,
    };
  })();

  const movePreviewRect = movingItem
    ? {
        x: moveCell?.x ?? movingItem.x,
        y: moveCell?.y ?? movingItem.y,
        width: movingItem.width,
        height: movingItem.height,
      }
    : null;

  const peerList = Object.values(peers).filter(
    (p) => p.sessionId !== mySessionId && p.cursor
  );

  return (
    <div
      ref={viewportRef}
      className={
        'absolute inset-0 select-none ' +
        (movingItem ? 'cursor-move' : isPanning ? 'cursor-grabbing' : 'cursor-crosshair')
      }
      style={{
        backgroundColor: '#fdfbf7',
        backgroundImage: `
          linear-gradient(to right, rgba(139, 115, 85, 0.25) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(139, 115, 85, 0.25) 1px, transparent 1px)
        `,
        backgroundSize: `${cellPx}px ${cellPx}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        boxShadow: 'inset 0 0 20px rgba(139, 115, 85, 0.05)',
        overflow: 'hidden',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishDrawing}
      onMouseLeave={() => {
        if (isDrawing || isPanning) finishDrawing();
        onCursor(null);
      }}
    >
      <div
        className="absolute"
        style={{
          left: pan.x,
          top: pan.y,
          width: 0,
          height: 0,
        }}
      >
        {items.map((item) => (
          <GridItemComponent
            key={item.id}
            item={item}
            gridSize={cellPx}
            isHovered={hoveredId === item.id}
            isMoving={movingId === item.id}
            onHover={onHover}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
            onStartMove={handleStartMove}
          />
        ))}

        {previewRect && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: previewRect.x * cellPx,
              top: previewRect.y * cellPx,
              width: previewRect.width * cellPx,
              height: previewRect.height * cellPx,
              border: '3px dashed',
              borderColor: selectedColor,
              backgroundColor: `${selectedColor}40`,
              borderRadius: selectedTool === 'small' ? '50%' : '8px',
              transform: 'rotate(-0.5deg)',
              zIndex: 50,
            }}
          />
        )}

        {movePreviewRect && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: movePreviewRect.x * cellPx,
              top: movePreviewRect.y * cellPx,
              width: movePreviewRect.width * cellPx,
              height: movePreviewRect.height * cellPx,
              border: '3px dashed #5a4a3a',
              backgroundColor: 'rgba(139, 115, 85, 0.25)',
              borderRadius: '8px',
              zIndex: 50,
            }}
          />
        )}

        {peerList.map((p) => (
          <PeerCursorMarker
            key={p.sessionId}
            color={p.color}
            x={p.cursor!.x * cellPx}
            y={p.cursor!.y * cellPx}
          />
        ))}
      </div>
    </div>
  );
}

function PeerCursorMarker({ color, x, y }: { color: string; x: number; y: number }) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        zIndex: 100,
        transition: 'left 80ms linear, top 80ms linear',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
        <path
          d="M2 2 L18 8 L9 10 L7 18 Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
