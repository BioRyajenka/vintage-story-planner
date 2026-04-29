import { useCallback, useEffect, useRef, useState } from 'react';
import type { GridItem, Todo } from './types';

export type SharedData = { gridItems: GridItem[]; todos: Todo[] };

const EMPTY: SharedData = { gridItems: [], todos: [] };
const SAVE_DEBOUNCE_MS = 400;
const POLL_INTERVAL_MS = 4000;

function normalize(raw: unknown): SharedData {
  const obj = (raw ?? {}) as Partial<SharedData>;
  return {
    gridItems: Array.isArray(obj.gridItems) ? obj.gridItems : [],
    todos: Array.isArray(obj.todos) ? obj.todos : [],
  };
}

export function useSharedData() {
  const [data, setData] = useState<SharedData | null>(null);
  const lastSyncedJson = useRef<string>('');
  const pendingWrite = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next = normalize(await res.json());
        if (cancelled) return;
        lastSyncedJson.current = JSON.stringify(next);
        setData(next);
      } catch (err) {
        console.warn('Falling back to in-memory state (backend unreachable):', err);
        if (cancelled) return;
        lastSyncedJson.current = JSON.stringify(EMPTY);
        setData({ ...EMPTY });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const json = JSON.stringify(data);
    if (json === lastSyncedJson.current) return;

    pendingWrite.current = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: json,
        });
        if (res.ok) lastSyncedJson.current = json;
      } catch (err) {
        console.warn('Save failed:', err);
      } finally {
        pendingWrite.current = false;
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    const id = setInterval(async () => {
      if (pendingWrite.current) return;
      try {
        const res = await fetch('/api/state');
        if (!res.ok) return;
        const next = normalize(await res.json());
        const json = JSON.stringify(next);
        if (json === lastSyncedJson.current) return;
        lastSyncedJson.current = json;
        setData(next);
      } catch {
        /* ignore transient poll failures */
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const setGridItems = useCallback(
    (updater: GridItem[] | ((prev: GridItem[]) => GridItem[])) => {
      setData((prev) => {
        if (!prev) return prev;
        const next =
          typeof updater === 'function'
            ? (updater as (p: GridItem[]) => GridItem[])(prev.gridItems)
            : updater;
        if (next === prev.gridItems) return prev;
        return { ...prev, gridItems: next };
      });
    },
    []
  );

  const setTodos = useCallback(
    (updater: Todo[] | ((prev: Todo[]) => Todo[])) => {
      setData((prev) => {
        if (!prev) return prev;
        const next =
          typeof updater === 'function'
            ? (updater as (p: Todo[]) => Todo[])(prev.todos)
            : updater;
        if (next === prev.todos) return prev;
        return { ...prev, todos: next };
      });
    },
    []
  );

  return { data, setGridItems, setTodos };
}
