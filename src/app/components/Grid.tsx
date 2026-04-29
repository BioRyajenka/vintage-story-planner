import { useState, useRef, useCallback, useEffect } from 'react';
import type { GridItem, ItemType } from '../types';
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
}

const GRID_SIZE = 40;
const GRID_COLS = 30;
const GRID_ROWS = 30;

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

  const makeSeg = (s: number, e: number, idSuffix = ''): GridItem => {
    const len = e - s + 1;
    const baseId = `pathway-${Date.now()}${idSuffix}`;
    if (horizontal) {
      return {
        id: baseId,
        type: 'pathway',
        x: s,
        y: axis,
        width: len,
        height: 1,
        color,
      };
    }
    return {
      id: baseId,
      type: 'pathway',
      x: axis,
      y: s,
      width: 1,
      height: len,
      color,
    };
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

  return {
    remove: Array.from(mergedIds),
    add: [makeSeg(mergeStart, mergeEnd)],
  };
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
}: GridProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startCell, setStartCell] = useState<{ x: number; y: number } | null>(null);
  const [currentCell, setCurrentCell] = useState<{ x: number; y: number } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveCell, setMoveCell] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const movingItem = movingId ? items.find((i) => i.id === movingId) ?? null : null;

  const getCellFromEvent = useCallback((e: React.MouseEvent) => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE);
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE);
    if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return null;
    return { x, y };
  }, []);

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

  const handleStartMove = useCallback((id: string) => {
    setMovingId(id);
    setMoveCell(null);
    setIsDrawing(false);
    setStartCell(null);
    setCurrentCell(null);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const cell = getCellFromEvent(e);
      if (!cell) return;

      if (movingItem) {
        const x = Math.max(0, Math.min(GRID_COLS - movingItem.width, cell.x));
        const y = Math.max(0, Math.min(GRID_ROWS - movingItem.height, cell.y));
        onUpdateItem(movingItem.id, { x, y });
        setMovingId(null);
        setMoveCell(null);
        return;
      }

      setIsDrawing(true);
      setStartCell(cell);
      setCurrentCell(cell);
    },
    [getCellFromEvent, movingItem, onUpdateItem]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const cell = getCellFromEvent(e);
      if (movingItem) {
        if (cell) setMoveCell(cell);
        return;
      }
      if (!isDrawing || !startCell) return;
      if (cell) setCurrentCell(cell);
    },
    [isDrawing, startCell, getCellFromEvent, movingItem]
  );

  const finishDrawing = useCallback(() => {
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

    let label: string | undefined = undefined;

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

    const newItem: GridItem = {
      id: `item-${Date.now()}`,
      type: selectedTool,
      x,
      y,
      width: finalWidth,
      height: finalHeight,
      color: selectedColor,
      label,
    };

    onAddItem(newItem);
    setIsDrawing(false);
    setStartCell(null);
    setCurrentCell(null);
  }, [
    isDrawing,
    startCell,
    currentCell,
    selectedTool,
    selectedColor,
    items,
    onAddItem,
    onReplacePathways,
  ]);

  const getPathwayPreview = () => {
    if (!startCell || !currentCell) return null;
    const dx = Math.abs(currentCell.x - startCell.x);
    const dy = Math.abs(currentCell.y - startCell.y);
    const horizontal = dx >= dy;
    if (horizontal) {
      const x = Math.min(startCell.x, currentCell.x);
      const width = dx + 1;
      return { x, y: startCell.y, width, height: 1 };
    }
    const y = Math.min(startCell.y, currentCell.y);
    const height = dy + 1;
    return { x: startCell.x, y, width: 1, height };
  };

  const getPreviewRect = () => {
    if (!startCell || !currentCell) return null;
    if (selectedTool === 'pathway') return getPathwayPreview();
    const x = Math.min(startCell.x, currentCell.x);
    const y = Math.min(startCell.y, currentCell.y);
    const width = Math.abs(currentCell.x - startCell.x) + 1;
    const height = Math.abs(currentCell.y - startCell.y) + 1;
    const finalWidth = selectedTool === 'small' ? 1 : width;
    const finalHeight = selectedTool === 'small' ? 1 : height;
    return { x, y, width: finalWidth, height: finalHeight };
  };

  const previewRect = isDrawing ? getPreviewRect() : null;

  const movePreviewRect = movingItem
    ? (() => {
        const target = moveCell ?? { x: movingItem.x, y: movingItem.y };
        const x = Math.max(0, Math.min(GRID_COLS - movingItem.width, target.x));
        const y = Math.max(0, Math.min(GRID_ROWS - movingItem.height, target.y));
        return { x, y, width: movingItem.width, height: movingItem.height };
      })()
    : null;

  return (
    <div
      className="inline-block bg-[#fdfbf7] p-8 rounded-lg shadow-xl border-3"
      style={{
        borderWidth: '4px',
        borderColor: '#8b7355',
        borderStyle: 'solid',
        transform: 'rotate(-0.2deg)',
        boxShadow: '4px 4px 0 rgba(139, 115, 85, 0.1), 8px 8px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div
        ref={gridRef}
        className={movingItem ? 'relative cursor-move' : 'relative cursor-crosshair'}
        style={{
          width: GRID_COLS * GRID_SIZE,
          height: GRID_ROWS * GRID_SIZE,
          backgroundImage: `
            linear-gradient(to right, rgba(139, 115, 85, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 115, 85, 0.25) 1px, transparent 1px)
          `,
          backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          boxShadow: 'inset 0 0 20px rgba(139, 115, 85, 0.05)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={finishDrawing}
        onMouseLeave={() => {
          if (isDrawing) finishDrawing();
        }}
      >
        {items.map((item) => (
          <GridItemComponent
            key={item.id}
            item={item}
            gridSize={GRID_SIZE}
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
              left: previewRect.x * GRID_SIZE,
              top: previewRect.y * GRID_SIZE,
              width: previewRect.width * GRID_SIZE,
              height: previewRect.height * GRID_SIZE,
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
              left: movePreviewRect.x * GRID_SIZE,
              top: movePreviewRect.y * GRID_SIZE,
              width: movePreviewRect.width * GRID_SIZE,
              height: movePreviewRect.height * GRID_SIZE,
              border: '3px dashed #5a4a3a',
              backgroundColor: 'rgba(139, 115, 85, 0.25)',
              borderRadius: '8px',
              zIndex: 50,
            }}
          />
        )}
      </div>
    </div>
  );
}
