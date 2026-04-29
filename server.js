import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const PEER_COLORS = [
  '#e57373', '#64b5f6', '#81c784', '#ffb74d',
  '#ba68c8', '#4dd0e1', '#f06292', '#9575cd',
];

await fs.mkdir(DATA_DIR, { recursive: true });

let writeQueue = Promise.resolve();
let cachedState = null;

async function readState() {
  if (cachedState) return cachedState;
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    cachedState = {
      version: typeof parsed.version === 'number' ? parsed.version : 0,
      gridItems: Array.isArray(parsed.gridItems) ? parsed.gridItems : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    cachedState = { version: 0, gridItems: [], todos: [] };
  }
  return cachedState;
}

function writeState(state) {
  cachedState = state;
  writeQueue = writeQueue.then(async () => {
    const tmp = STATE_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(state));
    await fs.rename(tmp, STATE_FILE);
  });
  return writeQueue;
}

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/api/state', async (_req, res) => {
  try {
    res.json(await readState());
  } catch (err) {
    console.error('readState failed', err);
    res.status(500).json({ error: 'read failed' });
  }
});

app.put('/api/state', async (req, res) => {
  const { gridItems, todos } = req.body ?? {};
  if (!Array.isArray(gridItems) || !Array.isArray(todos)) {
    return res.status(400).json({ error: 'invalid body' });
  }
  try {
    const current = await readState();
    const next = { version: current.version + 1, gridItems, todos };
    await writeState(next);
    broadcast({ type: 'state', state: next, senderId: null });
    res.json(next);
  } catch (err) {
    console.error('writeState failed', err);
    res.status(500).json({ error: 'write failed' });
  }
});

app.use(express.static(DIST_DIR));
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
    if (err) res.status(404).end();
  });
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

const peers = new Map();
let colorCursor = 0;

function broadcast(msg, exceptWs = null) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client === exceptWs) continue;
    if (client.readyState !== client.OPEN) continue;
    try { client.send(data); } catch {}
  }
}

wss.on('connection', async (ws) => {
  const sessionId = randomUUID();
  const color = PEER_COLORS[colorCursor++ % PEER_COLORS.length];
  peers.set(sessionId, { color, cursor: null });

  try {
    const state = await readState();
    ws.send(JSON.stringify({
      type: 'init',
      sessionId,
      color,
      state,
      peers: Array.from(peers.entries())
        .filter(([id]) => id !== sessionId)
        .map(([id, p]) => ({ sessionId: id, color: p.color, cursor: p.cursor })),
    }));
  } catch (err) {
    console.error('init failed', err);
    ws.close();
    return;
  }

  broadcast({ type: 'join', sessionId, color }, ws);

  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'update' && msg.state) {
      const { gridItems, todos } = msg.state;
      if (!Array.isArray(gridItems) || !Array.isArray(todos)) return;
      const current = await readState();
      const next = { version: current.version + 1, gridItems, todos };
      try {
        await writeState(next);
      } catch (err) {
        console.error('write on update failed', err);
        return;
      }
      broadcast({ type: 'state', state: next, senderId: sessionId });
    } else if (msg.type === 'cursor') {
      const cursor =
        msg.x === null || msg.x === undefined
          ? null
          : { x: Number(msg.x), y: Number(msg.y) };
      const peer = peers.get(sessionId);
      if (peer) peer.cursor = cursor;
      broadcast({ type: 'cursor', sessionId, cursor }, ws);
    }
  });

  ws.on('close', () => {
    peers.delete(sessionId);
    broadcast({ type: 'leave', sessionId });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Vintage Story Planner listening on :${PORT}`);
  console.log(`WebSocket path: /ws`);
  console.log(`State file: ${STATE_FILE}`);
});
