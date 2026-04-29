import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

const DEFAULT_STATE = { version: 0, gridItems: [], todos: [] };

await fs.mkdir(DATA_DIR, { recursive: true });

let writeQueue = Promise.resolve();

async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      version: typeof parsed.version === 'number' ? parsed.version : 0,
      gridItems: Array.isArray(parsed.gridItems) ? parsed.gridItems : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    };
  } catch (err) {
    if (err.code === 'ENOENT') return { ...DEFAULT_STATE };
    throw err;
  }
}

function writeState(state) {
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
    return res.status(400).json({ error: 'invalid body: expected { gridItems, todos }' });
  }
  try {
    const current = await readState();
    const next = {
      version: current.version + 1,
      gridItems,
      todos,
    };
    await writeState(next);
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

app.listen(PORT, () => {
  console.log(`Vintage Story Planner listening on :${PORT}`);
  console.log(`State file: ${STATE_FILE}`);
});
