import { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, Check, Trash2, GripVertical, Link } from 'lucide-react';
import type { Todo } from '../types';

interface TodoListProps {
  todos: Todo[];
  onAddTodo: (text: string) => void;
  onUpdateTodo: (id: string, updates: Partial<Todo>) => void;
  onRemoveTodo: (id: string) => void;
  onReorder: (startIndex: number, endIndex: number) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}

export function TodoList({
  todos,
  onAddTodo,
  onUpdateTodo,
  onRemoveTodo,
  onReorder,
  hoveredId,
  onHover
}: TodoListProps) {
  const [newTodoText, setNewTodoText] = useState('');
  const [expandedTodos, setExpandedTodos] = useState<Set<string>>(new Set());
  const [editingTodo, setEditingTodo] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  const handleAddTodo = () => {
    if (newTodoText.trim()) {
      onAddTodo(newTodoText.trim());
      setNewTodoText('');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTodos(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addSubItem = (todoId: string) => {
    const text = prompt('Enter sub-item:');
    if (text) {
      const todo = todos.find(t => t.id === todoId);
      if (todo) {
        onUpdateTodo(todoId, {
          subItems: [...todo.subItems, {
            id: `sub-${Date.now()}`,
            text,
            completed: false
          }]
        });
        setExpandedTodos(prev => new Set(prev).add(todoId));
      }
    }
  };

  const toggleSubItem = (todoId: string, subItemId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
      onUpdateTodo(todoId, {
        subItems: todo.subItems.map(si =>
          si.id === subItemId ? { ...si, completed: !si.completed } : si
        )
      });
    }
  };

  const removeSubItem = (todoId: string, subItemId: string) => {
    const todo = todos.find(t => t.id === todoId);
    if (todo) {
      onUpdateTodo(todoId, {
        subItems: todo.subItems.filter(si => si.id !== subItemId)
      });
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  const visibleTodos = showCompleted
    ? todos
    : todos.filter(t => !t.completed);

  return (
    <div
      className="h-full bg-[#e8e4d9] rounded-lg shadow-xl flex flex-col"
      style={{
        border: '4px solid #8b7355',
        transform: 'rotate(0.3deg)',
        fontFamily: "'Patrick Hand', 'Caveat', cursive"
      }}
    >
      <div className="p-4 border-b-3" style={{ borderColor: '#8b7355' }}>
        <h2 className="text-[#5a4a3a] mb-3" style={{ fontSize: '22px', fontWeight: 700 }}>Tasks</h2>

        {/* Add new todo */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            placeholder="New task..."
            className="flex-1 px-3 py-2 bg-white/70 rounded-lg focus:outline-none"
            style={{
              border: '2px solid rgba(139, 115, 85, 0.4)',
              transform: 'rotate(-0.3deg)',
              fontSize: '15px'
            }}
          />
          <button
            onClick={handleAddTodo}
            className="p-2 bg-[#8b7355] text-white rounded-lg hover:bg-[#7a6449] transition-all shadow-md border-2 border-[#5a4a3a]"
            style={{ transform: 'rotate(0.5deg)' }}
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Show completed toggle */}
        <label className="flex items-center gap-2 mt-3 text-sm text-[#5a4a3a] cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded"
          />
          Show completed
        </label>
      </div>

      {/* Todo list */}
      <div className="flex-1 overflow-y-auto p-4">
        {visibleTodos.map((todo, index) => {
          const isExpanded = expandedTodos.has(todo.id);
          const isLinked = !!todo.linkedItemId;
          const isHovered = hoveredId === todo.id || hoveredId === todo.linkedItemId;

          return (
            <div
              key={todo.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onMouseEnter={() => todo.linkedItemId && onHover(todo.linkedItemId)}
              onMouseLeave={() => onHover(null)}
              className={`mb-2 bg-white/70 rounded-lg transition-all ${
                draggedIndex === index ? 'opacity-50' : ''
              }`}
              style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: isHovered ? '#8b7355' : 'rgba(139, 115, 85, 0.3)',
                transform: `rotate(${(index % 2 === 0 ? -0.3 : 0.3)}deg)`,
                boxShadow: isHovered
                  ? '0 6px 12px rgba(139, 115, 85, 0.3)'
                  : '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <div className="flex items-start gap-2 p-3">
                <button className="cursor-move mt-1 text-[#8b7355]/50 hover:text-[#8b7355]">
                  <GripVertical size={16} />
                </button>

                <button
                  onClick={() => onUpdateTodo(todo.id, { completed: !todo.completed })}
                  className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    todo.completed
                      ? 'bg-[#8b7355] border-[#8b7355]'
                      : 'border-[#8b7355]/30 hover:border-[#8b7355]'
                  }`}
                >
                  {todo.completed && <Check size={14} className="text-white" />}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`flex-1 ${todo.completed ? 'line-through text-[#5a4a3a]/50' : 'text-[#5a4a3a]'}`}>
                      {todo.text}
                    </span>
                    {isLinked && (
                      <Link size={14} className="text-[#8b7355]" title="Linked to building" />
                    )}
                  </div>

                  {/* Sub-items */}
                  {isExpanded && (
                    <div className="mt-2 ml-2 space-y-1">
                      {todo.subItems.map(subItem => (
                        <div key={subItem.id} className="flex items-center gap-2 text-sm">
                          <button
                            onClick={() => toggleSubItem(todo.id, subItem.id)}
                            className={`w-4 h-4 rounded border flex items-center justify-center ${
                              subItem.completed
                                ? 'bg-[#8b7355]/70 border-[#8b7355]/70'
                                : 'border-[#8b7355]/30'
                            }`}
                          >
                            {subItem.completed && <Check size={10} className="text-white" />}
                          </button>
                          <span className={subItem.completed ? 'line-through text-[#5a4a3a]/50' : 'text-[#5a4a3a]'}>
                            {subItem.text}
                          </span>
                          <button
                            onClick={() => removeSubItem(todo.id, subItem.id)}
                            className="ml-auto p-0.5 hover:bg-red-100 rounded"
                          >
                            <Trash2 size={12} className="text-red-600" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addSubItem(todo.id)}
                        className="text-xs text-[#8b7355] hover:underline"
                      >
                        + Add sub-item
                      </button>
                    </div>
                  )}
                </div>

                {todo.subItems.length > 0 && (
                  <button
                    onClick={() => toggleExpanded(todo.id)}
                    className="mt-1 text-[#5a4a3a]/50 hover:text-[#5a4a3a]"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}

                {!isLinked && (
                  <button
                    onClick={() => onRemoveTodo(todo.id)}
                    className="mt-1 p-1 hover:bg-red-100 rounded transition-colors"
                  >
                    <Trash2 size={14} className="text-red-600" />
                  </button>
                )}
              </div>

              {!isExpanded && todo.subItems.length > 0 && (
                <button
                  onClick={() => addSubItem(todo.id)}
                  className="w-full px-3 pb-2 text-xs text-[#8b7355] hover:underline text-left"
                >
                  + Add sub-item
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
