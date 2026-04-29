# Deploy

## First-time setup on the server

```bash
git clone <repo-url> vintage-story-planner
cd vintage-story-planner
docker compose up -d --build
```

Open `http://<server>:3000`.

State is persisted in `./data/state.json` on the host (mounted into the container at `/data`). Back up that file to back up the planner.

## Update workflow

Local:

```bash
git push
```

Server:

```bash
cd vintage-story-planner
git pull
docker compose up -d --build
```

`--build` rebuilds the image; the `./data` volume keeps state across rebuilds.

## Local development

Two terminals:

```bash
npm run dev:server   # API + persistence on :3000
npm run dev          # Vite dev server on :5173 (proxies /api → :3000)
```

If the API server isn't running, the app falls back to in-memory state (no persistence).

## Notes

- Concurrency model is last-write-wins with ~4s polling. Fine for a small group; not a CRDT.
- Change the host port by editing `docker-compose.yml`'s `ports:` line.
- Logs: `docker compose logs -f app`.
