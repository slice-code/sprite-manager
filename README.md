# Sprite Sheet Manager

A sprite sheet editor and manager for 2D game animations. Metadata is stored in **SQLite**; frame images and generated sprite sheets are saved as **PNG files on disk**.

## Prerequisites

- Node.js 20+
- Linux build tools for native modules (`canvas`, `better-sqlite3`):
  ```bash
  sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
  ```

## Run locally

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000
- API + file server: http://localhost:3001

## Data storage

| Location | Contents |
|----------|----------|
| `data/sprite-manager.db` | SQLite database (projects, tags, file paths) |
| `data/uploads/projects/{id}/frames/` | Individual frame PNG files |
| `data/uploads/projects/{id}/sheets/` | Generated sprite sheet PNG files |

## Production

```bash
npm run build
npm start
```

The server serves the built frontend, REST API (`/api/*`), and uploaded files (`/uploads/*`).

## API uploads

Frame images and generated sprite sheets are uploaded via **multipart/form-data**:

| Endpoint | Field | Description |
|----------|-------|-------------|
| `POST /api/projects/:id/images` | `images` (multiple files) | Frame PNG/JPG/WEBP |
| `POST /api/projects/:id/sheets` | `sheet` (file) + metadata fields | Generated sprite sheet |

Sheet metadata fields: `sheetWidth`, `sheetHeight`, `frameCount`, `frameWidth`, `frameHeight`, `fps`.

## Docker

Satu container menjalankan **nginx (frontend)** + **Node API (backend)**. Keduanya di-expose melalui port **3001**.

```
Browser :3001 → nginx :3001 (UI)
                  └─ proxy /api, /uploads → Node :4000 (internal)
```

```bash
docker compose up --build -d
```

Open http://localhost:3001 (atau http://<IP-HOST>:3001)

Data persists in the `sprite-data` Docker volume (`/app/data` in the container).

```bash
docker compose down
docker compose logs -f
```

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `BIND_HOST` | `0.0.0.0` | API bind address (`127.0.0.1` in Docker) |
| `SERVE_STATIC` | `true` | Set `false` when nginx serves the UI |
