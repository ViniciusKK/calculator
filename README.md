# calculator

Two-part project:

- `frontend/` — React app scaffolded with Vite.
- `backend/` — REST API written in Go (standard library only).

## Backend

Requires Go 1.22+.

```bash
cd backend
go run ./cmd/server   # listens on :8080, override with PORT
go test ./...
```

### Endpoints

| Method | Path       | Body               | Response                              |
| ------ | ---------- | ------------------ | ------------------------------------- |
| GET    | `/health`  | —                  | `{"status":"ok"}`                     |
| POST   | `/api/add` | `{"a": 2, "b": 3}` | `{"op":"add","a":2,"b":3,"result":5}` |

Subtract/multiply/divide aren't implemented yet.

Errors come back as `{"error":"..."}` — `400` for a malformed body, `422` for a
non-finite result.

```bash
curl -X POST localhost:8080/api/add -d '{"a":2,"b":3}'
```

## Frontend

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

The dev server proxies `/api/*` to `http://localhost:8080`, so run the backend
alongside it and fetch from `/api/add` directly with no CORS setup needed.
