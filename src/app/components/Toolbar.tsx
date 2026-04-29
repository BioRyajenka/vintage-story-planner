import { Home, Square, Sprout, Circle, ListTodo } from 'lucide-react';
import type { ItemType } from '../types';

interface ToolbarProps {
  selectedTool: ItemType;
  onToolChange: (tool: ItemType) => void;
  selectedColor: string;
  onColorChange: (color: string) => void;
  onToggleTodoList: () => void;
  showTodoList: boolean;
}

const COLORS = [
  { name: 'Wood', value: '#8b7355' },
  { name: 'Stone', value: '#6b7280' },
  { name: 'Dirt', value: '#9d7652' },
  { name: 'Green', value: '#6b8e23' },
  { name: 'Blue', value: '#4682b4' },
  { name: 'Red', value: '#a0522d' },
];

export function Toolbar({
  selectedTool,
  onToolChange,
  selectedColor,
  onColorChange,
  onToggleTodoList,
  showTodoList
}: ToolbarProps) {
  return (
    <div
      className="h-16 bg-[#e8e4d9] border-b-4 flex items-center px-6 gap-6"
      style={{
        borderColor: '#8b7355',
        boxShadow: '0 4px 6px rgba(139, 115, 85, 0.15)',
        fontFamily: "'Patrick Hand', 'Caveat', cursive"
      }}
    >
      <div className="flex gap-2">
        <button
          onClick={() => onToolChange('building')}
          className={`p-2 rounded-lg transition-all border-2 ${
            selectedTool === 'building'
              ? 'bg-[#8b7355] text-white border-[#5a4a3a] shadow-md'
              : 'bg-white/70 text-[#5a4a3a] hover:bg-white border-[#8b7355]/30'
          }`}
          style={{ transform: selectedTool === 'building' ? 'rotate(-1deg) scale(1.05)' : 'rotate(0.5deg)' }}
          title="Building"
        >
          <Home size={20} />
        </button>
        <button
          onClick={() => onToolChange('pathway')}
          className={`p-2 rounded-lg transition-all border-2 ${
            selectedTool === 'pathway'
              ? 'bg-[#8b7355] text-white border-[#5a4a3a] shadow-md'
              : 'bg-white/70 text-[#5a4a3a] hover:bg-white border-[#8b7355]/30'
          }`}
          style={{ transform: selectedTool === 'pathway' ? 'rotate(1deg) scale(1.05)' : 'rotate(-0.5deg)' }}
          title="Pathway"
        >
          <Square size={20} />
        </button>
        <button
          onClick={() => onToolChange('field')}
          className={`p-2 rounded-lg transition-all border-2 ${
            selectedTool === 'field'
              ? 'bg-[#8b7355] text-white border-[#5a4a3a] shadow-md'
              : 'bg-white/70 text-[#5a4a3a] hover:bg-white border-[#8b7355]/30'
          }`}
          style={{ transform: selectedTool === 'field' ? 'rotate(-1deg) scale(1.05)' : 'rotate(0.5deg)' }}
          title="Farm Field"
        >
          <Sprout size={20} />
        </button>
        <button
          onClick={() => onToolChange('small')}
          className={`p-2 rounded-lg transition-all border-2 ${
            selectedTool === 'small'
              ? 'bg-[#8b7355] text-white border-[#5a4a3a] shadow-md'
              : 'bg-white/70 text-[#5a4a3a] hover:bg-white border-[#8b7355]/30'
          }`}
          style={{ transform: selectedTool === 'small' ? 'rotate(1deg) scale(1.05)' : 'rotate(-0.5deg)' }}
          title="Small Item"
        >
          <Circle size={20} />
        </button>
      </div>

      <div className="h-8 w-0.5 bg-[#8b7355]/40" style={{ transform: 'rotate(1deg)' }} />

      <div className="flex gap-2">
        {COLORS.map((color, i) => (
          <button
            key={color.value}
            onClick={() => onColorChange(color.value)}
            className={`w-8 h-8 rounded-lg border-3 transition-all ${
              selectedColor === color.value
                ? 'scale-110 shadow-md'
                : 'hover:scale-105'
            }`}
            style={{
              backgroundColor: color.value,
              borderWidth: '3px',
              borderColor: selectedColor === color.value ? '#5a4a3a' : 'rgba(139, 115, 85, 0.3)',
              transform: `rotate(${(i % 2 === 0 ? -1 : 1) * 2}deg)`,
              boxShadow: selectedColor === color.value
                ? '0 4px 8px rgba(0,0,0,0.2)'
                : '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title={color.name}
          />
        ))}
      </div>

      <div className="flex-1" />

      <button
        onClick={onToggleTodoList}
        className={`p-2 rounded-lg transition-all border-2 ${
          showTodoList
            ? 'bg-[#8b7355] text-white border-[#5a4a3a] shadow-md'
            : 'bg-white/70 text-[#5a4a3a] hover:bg-white border-[#8b7355]/30'
        }`}
        style={{ transform: showTodoList ? 'rotate(1deg) scale(1.05)' : 'rotate(-0.5deg)' }}
        title={showTodoList ? 'Hide Todo List' : 'Show Todo List'}
      >
        <ListTodo size={20} />
      </button>
    </div>
  );
}
