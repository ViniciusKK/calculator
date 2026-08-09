# Prompts

Every prompt given while building this project, in order, verbatim.

## 1

````
This repo only has a README. I'm building a web calculator.

Goal: a calculator UI in the browser that sends expressions to a Go
backend, which evaluates them and returns the result. All arithmetic
logic lives in Go — the frontend only tokenizes/validates input and
renders.

Stack, decided:
- frontend/  React + TypeScript + Vite, tested with Vitest
- backend/   Go, REST, tested with the standard testing package

Before writing any code, propose:
1. the folder structure for both projects
2. the HTTP contract (routes, request/response JSON, error shape)

I'll confirm, then we build.
````

## 2

````
The plan looks good. Set up the toolchain first so nothing has to be
retrofitted later:

- install Go and confirm the version
- scaffold both projects with the structure we agreed
- Biome for lint + format on the frontend, with a `lint` script
- Vitest configured with @vitest/coverage-v8 and a `test:coverage` script
- a Makefile or scripts to run frontend, backend, and all tests

Standing rule for the rest of this project: every behavior change ships
with tests on whichever side owns the logic, and the code stays clean
under Biome. Don't ask me each time.
````

## 3

````
Implement the first vertical slice end to end so we can validate the
contract early: POST an expression, get a result back, addition only.

Include:
- the Go handler, with unit tests covering success and malformed input
- a typed frontend API client with tests that mock the transport
- one integration test that boots the real Go server and hits it, so the
  operation names can't drift between the two sides

Nothing else — no UI yet.
````

## 4

````
Now the full evaluator in Go. It must handle expressions of arbitrary
length, not just two operands:

- + - * / with correct precedence
- parentheses, nested
- unary minus
- exponentiation, square root, percentage
- decimal values

Tell me the grammar you're implementing and how you're defining
percentage (I want `50 + 10%` spelled out explicitly), then implement it
with table-driven tests, including division by zero, sqrt of a negative,
and unbalanced parentheses.
````

## 5

````
Build the calculator UI. Keep it dumb — it composes an expression string
and sends it to the backend.

Buttons: 0-9, + - x / , ( ) ^ √ % C =
Use `,` as the decimal separator in the display and translate to `.` at
the API boundary.

The display shows the expression being typed, then the result after `=`.
Errors from the backend render in the display, not in an alert.
````

## 6

````
Two display details I want handled now rather than discovered later:

- results in scientific notation must round-trip: whatever `format`
  produces has to be accepted by `tokenize` if I keep operating on it
- very long expressions must not overflow the display

Add tests for the round-trip specifically.
````

## 7

````
Add keyboard input: digits, operators, Enter for =, Escape and C to
clear, Backspace to delete.

Validation is shared responsibility — the frontend must reject anything
that isn't a valid character or a valid position for that character (I
should not be able to type letters or two operators in a row), and the
backend must reject the same input independently, because the API is
public. Tests on both sides.
````

## 8

````
Handle the request lifecycle properly:

- render a busy state while a request is in flight
- C and Escape still work while busy, and cancel the pending request
- add a timeout to the fetch, with a distinct error message on timeout
- network failure shows a retryable message, not a crash

Tests for the busy path and the timeout path.
````

## 9

````
Now the visual design. Dark, minimal, this palette:

Background:       #121212 (charcoal black)
Primary text:     #E0E0E0 (light gray)
Secondary text:   #B0B0B0 (medium gray)
Borders/dividers: #444444 (dark gray)
Accent:           #888888 (soft gray)

Mobile-first: on phones the keypad fills the available space with
comfortable tap targets and no scrolling. On desktop it becomes a
centered rectangle with a max width. Verify at 375px and 1440px.
````

## 10

````
Quality pass before packaging:

- run the full suite and paste the coverage numbers, frontend and Go
- document `npm run test:coverage` and `go test -cover` in the README
- delete the stale Vite template README and fix any dead file references
- confirm Biome passes clean with no suppressions

If coverage is thin anywhere meaningful, tell me where instead of
padding it.
````

## 11

````
Containerize for deployment: a single Dockerfile that builds the Vite
bundle, builds the Go binary, and runs both together — Go serving the
static assets and the API on one port. Multi-stage, small final image.
Document the build and run commands in the README.
````

## 12

````
Finally, write every prompt I gave you into PROMPTS.md, in order,
verbatim, in the format you've been keeping.
````