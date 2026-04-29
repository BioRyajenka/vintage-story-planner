import { useCallback, useEffect, useRef, useState } from 'react';
import type { GridItem, Todo, Peer, PeerCursor } from './types';

export type SharedData = { gridItems: GridItem[]; todos: Todo[] };

const EMPTY: SharedData = { gridItems: [], todos: [] };
const SAVE_DEBOUNCE_MS = 150;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 5000;
const CURSOR_THROTTLE_MS = 50;

function normalize(raw: unknown): SharedData {
  const obj = (raw ?? {}) as Partial<SharedData>;
  return {
    gridItems: Array.isArray(obj.gridItems) ? obj.gridItems : [],
    todos: Array.isArray(obj.todos) ? obj.todos : [],
  };
}

function wsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

export function useSharedData() {
  const [data, setData] = useState<SharedData | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mySessionRef = useRef<string | null>(null);
  const lastSyncedJson = useRef<string>('');
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempt = useRef(0);
  const lastCursorSentAt = useRef(0);
  const lastCursor = useRef<PeerCursor | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        if (cancelled || !raw) return;
        setData((prev) => {
          if (prev) return prev;
          const next = normalize(raw);
          lastSyncedJson.current = JSON.stringify(next);
          return next;
        });
      })
      .catch(() => {});

    const fallbackTimer = setTimeout(() => {
      if (cancelled) return;
      setData((prev) => {
        if (prev) return prev;
        lastSyncedJson.current = JSON.stringify(EMPTY);
        return { ...EMPTY };
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        reconnectAttempt.current = 0;
        setConnected(true);
      });

      ws.addEventListener('message', (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === 'init') {
          mySessionRef.current = msg.sessionId;
          setMySessionId(msg.sessionId);
          const next = normalize(msg.state);
          lastSyncedJson.current = JSON.stringify(next);
          setData(next);
          const peersMap: Record<string, Peer> = {};
          for (const p of msg.peers ?? []) {
            peersMap[p.sessionId] = {
              sessionId: p.sessionId,
              color: p.color,
              cursor: p.cursor ?? null,
            };
          }
          setPeers(peersMap);
        } else if (msg.type === 'state') {
          if (msg.senderId && msg.senderId === mySessionRef.current) return;
          const next = normalize(msg.state);
          lastSyncedJson.current = JSON.stringify(next);
          setData(next);
        } else if (msg.type === 'join') {
          setPeers((prev) => ({
            ...prev,
            [msg.sessionId]: { sessionId: msg.sessionId, color: msg.color, cursor: null },
          }));
        } else if (msg.type === 'leave') {
          setPeers((prev) => {
            if (!prev[msg.sessionId]) return prev;
            const next = { ...prev };
            delete next[msg.sessionId];
            return next;
          });
        } else if (msg.type === 'cursor') {
          setPeers((prev) => {
            const existing = prev[msg.sessionId];
            if (!existing) return prev;
            return {
              ...prev,
              [msg.sessionId]: { ...existing, cursor: msg.cursor ?? null },
            };
          });
        }
      });

      ws.addEventListener('close', () => {
        setConnected(false);
        wsRef.current = null;
        if (cancelled) return;
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** reconnectAttempt.current
        );
        reconnectAttempt.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      });

      ws.addEventListener('error', () => {
        try { ws.close(); } catch {}
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const json = JSON.stringify(data);
    if (json === lastSyncedJson.current) return;

    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'update', state: data }));
          lastSyncedJson.current = json;
        } catch {}
      } else {
        fetch('/api/state', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: json,
        })
          .then((res) => {
            if (res.ok) lastSyncedJson.current = json;
          })
          .catch(() => {});
      }
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    };
  }, [data]);

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

  const sendCursor = useCallback((cursor: PeerCursor | null) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = performance.now();
    if (cursor && lastCursor.current) {
      const dx = Math.abs(cursor.x - lastCursor.current.x);
      const dy = Math.abs(cursor.y - lastCursor.current.y);
      if (dx < 0.01 && dy < 0.01) return;
    }
    if (now - lastCursorSentAt.current < CURSOR_THROTTLE_MS && cursor) return;
    lastCursorSentAt.current = now;
    lastCursor.current = cursor;
    try {
      ws.send(
        JSON.stringify(
          cursor === null
            ? { type: 'cursor', x: null, y: null }
            : { type: 'cursor', x: cursor.x, y: cursor.y }
        )
      );
    } catch {}
  }, []);

  return {
    data,
    setGridItems,
    setTodos,
    peers,
    mySessionId,
    connected,
    sendCursor,
  };
}
