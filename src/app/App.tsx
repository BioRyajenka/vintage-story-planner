import { useState, useCallback } from 'react';
import { Grid } from './components/Grid';
import { Toolbar } from './components/Toolbar';
import { TodoList } from './components/TodoList';
import { useSharedData } from './useSharedData';
import type { GridItem, Todo, ItemType } from './types';

export default function App() {
  const { data, setGridItems, setTodos } = useSharedData();
  const [selectedTool, setSelectedTool] = useState<ItemType>('building');
  const [selectedColor, setSelectedColor] = useState('#8b7355');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showTodoList, setShowTodoList] = useState(true);

  const addGridItem = useCallback((item: GridItem) => {
    setGridItems(prev => [...prev, item]);

    if (item.type === 'building' && item.label) {
      const newTodo: Todo = {
        id: item.id,
        text: item.label,
        completed: false,
        linkedItemId: item.id,
        subItems: []
      };
      setTodos(prev => [...prev, newTodo]);
    }
  }, [setGridItems, setTodos]);

  const updateGridItem = useCallback((id: string, updates: Partial<GridItem>) => {
    setGridItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));

    if (updates.label) {
      setTodos(prev => prev.map(todo =>
        todo.linkedItemId === id ? { ...todo, text: updates.label as string } : todo
      ));
    }
  }, [setGridItems, setTodos]);

  const removeGridItem = useCallback((id: string) => {
    setGridItems(prev => prev.filter(item => item.id !== id));
    setTodos(prev => prev.map(todo =>
      todo.linkedItemId === id ? { ...todo, linkedItemId: undefined } : todo
    ));
  }, [setGridItems, setTodos]);

  const replacePathways = useCallback((removeIds: string[], add: GridItem[]) => {
    if (removeIds.length === 0 && add.length === 0) return;
    setGridItems(prev => {
      const removeSet = new Set(removeIds);
      const kept = prev.filter(item => !removeSet.has(item.id));
      return [...kept, ...add];
    });
  }, [setGridItems]);

  const addTodo = useCallback((text: string) => {
    const newTodo: Todo = {
      id: `todo-${Date.now()}`,
      text,
      completed: false,
      subItems: []
    };
    setTodos(prev => [...prev, newTodo]);
  }, [setTodos]);

  const updateTodo = useCallback((id: string, updates: Partial<Todo>) => {
    setTodos(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const current = prev[idx];
      const next = { ...current, ...updates };
      const completionChanged =
        updates.completed !== undefined && updates.completed !== current.completed;

      if (!completionChanged) {
        return prev.map(t => (t.id === id ? next : t));
      }

      const others = prev.filter(t => t.id !== id);
      if (next.completed) {
        const firstCompletedIdx = others.findIndex(t => t.completed);
        const insertAt = firstCompletedIdx === -1 ? others.length : firstCompletedIdx;
        return [...others.slice(0, insertAt), next, ...others.slice(insertAt)];
      }
      const lastIncompleteIdx = others.reduce(
        (acc, t, i) => (t.completed ? acc : i),
        -1
      );
      const insertAt = lastIncompleteIdx + 1;
      return [...others.slice(0, insertAt), next, ...others.slice(insertAt)];
    });
  }, [setTodos]);

  const removeTodo = useCallback((id: string) => {
    setTodos(prev => {
      const todo = prev.find(t => t.id === id);
      if (todo?.linkedItemId) return prev;
      return prev.filter(t => t.id !== id);
    });
  }, [setTodos]);

  const reorderTodos = useCallback((startIndex: number, endIndex: number) => {
    setTodos(prev => {
      const result = Array.from(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result;
    });
  }, [setTodos]);

  if (!data) {
    return (
      <div
        className="size-full flex items-center justify-center"
        style={{
          backgroundColor: '#f5f1e8',
          fontFamily: "'Patrick Hand', sans-serif",
          color: '#5a4a3a',
          fontSize: 22,
        }}
      >
        Loading…
      </div>
    );
  }

  const { gridItems, todos } = data;

  return (
    <div
      className="size-full flex flex-col overflow-hidden relative"
      style={{
        backgroundColor: '#f5f1e8',
        backgroundImage: `
          linear-gradient(rgba(139, 115, 85, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139, 115, 85, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px'
      }}
    >
      <Toolbar
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        selectedColor={selectedColor}
        onColorChange={setSelectedColor}
        onToggleTodoList={() => setShowTodoList(!showTodoList)}
        showTodoList={showTodoList}
      />

      <div className="flex-1 overflow-auto p-8">
        <Grid
          items={gridItems}
          selectedTool={selectedTool}
          selectedColor={selectedColor}
          onAddItem={addGridItem}
          onUpdateItem={updateGridItem}
          onRemoveItem={removeGridItem}
          onReplacePathways={replacePathways}
          hoveredId={hoveredId}
          onHover={setHoveredId}
        />
      </div>

      {showTodoList && (
        <div className="absolute top-16 right-4 w-80 h-[calc(100%-5rem)] z-50">
          <TodoList
            todos={todos}
            onAddTodo={addTodo}
            onUpdateTodo={updateTodo}
            onRemoveTodo={removeTodo}
            onReorder={reorderTodos}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        </div>
      )}
    </div>
  );
}
