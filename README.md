# calculator

Two-part project:

- `frontend/` — React + TypeScript app scaffolded with Vite.
- `backend/` — REST API written in Go (standard library only).

## Backend

Requires Go 1.22+.

```bash
cd backend
go run ./cmd/server   # listens on :8080, override with PORT
go test ./...
```

### Endpoints

| Method | Path            | Body                | Response                                      |
| ------ | --------------- | ------------------- | --------------------------------------------- |
| GET    | `/health`       | —                   | `{"status":"ok"}`                             |
| POST   | `/api/add`      | `{"a": 2, "b": 3}`  | `{"op":"add","a":2,"b":3,"result":5}`         |
| POST   | `/api/subtract` | `{"a": 2, "b": 3}`  | `{"op":"subtract","a":2,"b":3,"result":-1}`   |
| POST   | `/api/multiply` | `{"a": 2, "b": 3}`  | `{"op":"multiply","a":2,"b":3,"result":6}`    |
| POST   | `/api/divide`   | `{"a": 6, "b": 3}`  | `{"op":"divide","a":6,"b":3,"result":2}`      |
| POST   | `/api/power`    | `{"a": 2, "b": 10}` | `{"op":"power","a":2,"b":10,"result":1024}`   |
| POST   | `/api/sqrt`     | `{"a": 9}`          | `{"op":"sqrt","a":9,"result":3}`              |

`sqrt` is the one unary endpoint, so it takes `a` only and rejects a `b`.

Errors come back as `{"error":"..."}` — `400` for a malformed body, `422` for
division by zero, the root of a negative number, or a non-finite result.

Percent has no endpoint: it is built out of `divide` and `multiply`, because
what it means depends on the operator in front of it (see below).

```bash
curl -X POST localhost:8080/api/add -d '{"a":2,"b":3}'
```

## Frontend

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # biome check (lint + format check)
npm run lint:fix   # biome check --write
npm run format     # biome format --write
```

`npm run build` typechecks before bundling, so a type error fails the build.
`npm run lint` exits non-zero on a lint error *or* on formatting drift, so it
is safe to gate CI on.

The dev server proxies `/api/*` to `http://localhost:8080`, so run the backend
alongside it and fetch from `/api/add` directly with no CORS setup needed.

The UI is a calculator: digits `0`–`9`, `+ − × ÷ ^`, `√`, `%`, parentheses, `,`
as the decimal separator, `=`, `⌫` to delete one character, and `C` to clear.

You type a whole expression before pressing `=`, so `1+2+3×4` is entered as one
string and stays on screen while you build it.

Precedence, loosest to tightest: `+ −`, then `× ÷`, then `^`, then `√` and `%`.
`^` is right-associative, so `2^3^2` is 512. Parentheses override all of it.

Typing a value where one cannot follow another inserts a `×` for you: `2(3+4)`
becomes `2×(3+4)`, and `(2)3` becomes `(2)×3`.

### Percent

`%` is context-aware, the way a pocket calculator behaves:

| Expression | Is       | Because                        |
| ---------- | -------- | ------------------------------ |
| `50+10%`   | 55       | after `+`/`−`, 10% *of 50*     |
| `50−10%`   | 45       | same                           |
| `200×15%`  | 30       | after `×`/`÷`, a plain 0,15    |
| `50%`      | 0,5      | on its own, just ÷100          |

It keeps that meaning inside parentheses, so `2×(50+10%)` is 110.

Every arithmetic step is a call to the Go API — the frontend only decides the
order the steps run in (`src/expression.js`). Evaluating `1+2+3×4` makes three
requests: `multiply(3,4)`, then `add(1,2)`, then `add(3,12)`.

### Keyboard

| Key                  | Does              |
| -------------------- | ----------------- |
| `0`–`9`              | digit             |
| `,` or `.`           | decimal separator |
| `+` `-` `*` `/`      | `+ − × ÷`         |
| `^`                  | exponent          |
| `(` `)`              | parentheses       |
| `%`                  | percent           |
| `Enter` or `=`       | evaluate          |
| `Backspace`          | delete one char   |
| `Escape` or `Delete` | clear             |

Any other key is ignored, letters included — `1a2b+c3d` types as `12+3`. Keys
pressed with Ctrl/Cmd/Alt are left to the browser.

`√` has no ASCII key, so it is keypad-only (or the literal `√` character, which
is Option+V on macOS). Mapping a letter such as `r` to it was ruled out to keep
the "no letter keys" rule absolute.

### Layout

| File                | Holds                                                      |
| ------------------- | ---------------------------------------------------------- |
| `src/calculator.ts` | pure reducer: what each action does to the expression       |
| `src/keyboard.ts`   | `KeyboardEvent.key` → action, or `null` to ignore the key   |
| `src/expression.ts` | tokenizer, recursive-descent parser, and API call ordering  |
| `src/api.ts`        | `fetch` wrapper for the Go endpoints                        |
| `src/App.tsx`       | wiring: keypad, key listener, and the async `=`             |

The first three are side-effect free, so the input rules are unit tested
directly; `App.test.tsx` covers the wiring with simulated typing.

The two types worth knowing: `Node` in `expression.ts` (the AST union, which
makes the evaluator's switch exhaustive) and `Action` in `calculator.ts`.
`Action`'s `digit` and `operator` carry a plain `string`, not a narrow union —
they come from raw keystrokes, so the reducer still validates them at runtime.
The tests that feed it garbage cast through a `malformed()` helper to say so.
