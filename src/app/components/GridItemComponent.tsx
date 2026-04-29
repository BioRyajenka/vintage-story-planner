import { X, Edit2, Move } from 'lucide-react';
import type { GridItem } from '../types';

interface GridItemComponentProps {
  item: GridItem;
  gridSize: number;
  isHovered: boolean;
  isMoving: boolean;
  onHover: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<GridItem>) => void;
  onRemove: (id: string) => void;
  onStartMove: (id: string) => void;
}

export function GridItemComponent({
  item,
  gridSize,
  isHovered,
  isMoving,
  onHover,
  onUpdate,
  onRemove,
  onStartMove,
}: GridItemComponentProps) {
  const isPathway = item.type === 'pathway';

  if (isPathway) {
    return (
      <div
        className="absolute pointer-events-none"
        style={{
          left: item.x * gridSize,
          top: item.y * gridSize,
          width: item.width * gridSize,
          height: item.height * gridSize,
          backgroundColor: item.color,
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.08) 5px, rgba(0,0,0,0.08) 10px)',
          zIndex: 1,
        }}
      />
    );
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newLabel = prompt('Enter new name:', item.label || '');
    if (newLabel !== null && newLabel.trim()) {
      onUpdate(item.id, { label: newLabel.trim() });
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove(item.id);
  };

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStartMove(item.id);
  };

  const getPattern = () => {
    if (item.type === 'field') {
      return 'repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,0,0,0.08) 4px, rgba(0,0,0,0.08) 8px)';
    }
    return undefined;
  };

  const isLarge = item.width > 1 || item.height > 1;
  const canMove = item.type === 'building' || item.type === 'field';

  return (
    <div
      className="absolute group transition-all duration-200 pointer-events-none"
      style={{
        left: item.x * gridSize,
        top: item.y * gridSize,
        width: item.width * gridSize,
        height: item.height * gridSize,
        zIndex: isHovered ? 10 : 2,
        opacity: isMoving ? 0.35 : 1,
      }}
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{
          backgroundColor: item.color,
          border: `3px solid`,
          borderColor: item.color === '#8b7355' ? '#5a4a3a' : `color-mix(in srgb, ${item.color} 70%, black)`,
          borderRadius: item.type === 'small' ? '50%' : '8px',
          backgroundImage: getPattern(),
          filter: isHovered
            ? 'brightness(1.15) drop-shadow(0 0 10px rgba(139, 115, 85, 0.6))'
            : 'drop-shadow(2px 3px 4px rgba(0,0,0,0.15))',
          transform: isHovered ? 'scale(1.03) rotate(0.5deg)' : 'rotate(-0.3deg)',
          borderStyle: 'solid',
          boxShadow: `
            inset 0 1px 0 rgba(255,255,255,0.3),
            inset 0 -1px 0 rgba(0,0,0,0.1),
            2px 2px 0 rgba(0,0,0,0.05)
          `,
        }}
      />

      {item.label && (
        <div
          className="absolute whitespace-nowrap pointer-events-none select-none"
          style={{
            ...(isLarge
              ? {
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : {
                  left: '50%',
                  top: item.height * gridSize + 4,
                  transform: 'translateX(-50%)',
                }),
            opacity: isHovered ? 1 : 0.7,
            fontFamily: "'Patrick Hand', sans-serif",
            fontStyle: 'normal',
            transition: 'opacity 0.2s',
          }}
        >
          <span
            className="px-2 py-0.5 bg-white/95 rounded text-[#5a4a3a] shadow-sm"
            style={{
              fontSize: isLarge ? '16px' : '14px',
              border: '1.5px solid rgba(139, 115, 85, 0.3)',
              fontWeight: 600,
              fontStyle: 'normal',
            }}
          >
            {item.label}
          </span>
        </div>
      )}

      <div className="absolute -top-9 left-0 right-0 flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
        {(item.type === 'building' || item.type === 'small') && (
          <button
            onClick={handleEdit}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1.5 bg-white rounded-md shadow-md hover:bg-gray-100 transition-colors border-2 border-[#8b7355]/30"
            title="Edit"
            style={{ transform: 'rotate(-1deg)' }}
          >
            <Edit2 size={14} className="text-[#5a4a3a]" />
          </button>
        )}
        {canMove && (
          <button
            onClick={handleMove}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1.5 bg-white rounded-md shadow-md hover:bg-blue-50 transition-colors border-2 border-[#8b7355]/30"
            title="Move (then click target cell, Esc to cancel)"
            style={{ transform: 'rotate(0.5deg)' }}
          >
            <Move size={14} className="text-[#5a4a3a]" />
          </button>
        )}
        <button
          onClick={handleDelete}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-1.5 bg-white rounded-md shadow-md hover:bg-red-100 transition-colors border-2 border-red-300"
          title="Delete"
          style={{ transform: 'rotate(1deg)' }}
        >
          <X size={14} className="text-red-600" />
        </button>
      </div>
    </div>
  );
}
