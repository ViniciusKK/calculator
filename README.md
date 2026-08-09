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

| Method | Path            | Body               | Response                                    |
| ------ | --------------- | ------------------ | ------------------------------------------- |
| GET    | `/health`       | —                  | `{"status":"ok"}`                           |
| POST   | `/api/add`      | `{"a": 2, "b": 3}` | `{"op":"add","a":2,"b":3,"result":5}`       |
| POST   | `/api/subtract` | `{"a": 2, "b": 3}` | `{"op":"subtract","a":2,"b":3,"result":-1}` |
| POST   | `/api/multiply` | `{"a": 2, "b": 3}` | `{"op":"multiply","a":2,"b":3,"result":6}`  |
| POST   | `/api/divide`   | `{"a": 6, "b": 3}` | `{"op":"divide","a":6,"b":3,"result":2}`    |

Errors come back as `{"error":"..."}` — `400` for a malformed body, `422` for
division by zero or a non-finite result.

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

The UI is a basic calculator: digits `0`–`9`, `+ − × ÷`, `,` as the decimal
separator, `=`, `⌫` to delete one character, and `C` to clear.

You type a whole expression before pressing `=`, so `1+2+3×4` is entered as one
string and stays on screen while you build it. `×` and `÷` bind tighter than
`+` and `−`, so that example is 15.

Every arithmetic step is a call to the Go API — the frontend only decides the
order the steps run in (`src/expression.js`). Evaluating `1+2+3×4` makes three
requests: `multiply(3,4)`, then `add(1,2)`, then `add(3,12)`.
