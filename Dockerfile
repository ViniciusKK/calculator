# syntax=docker/dockerfile:1

# Builds the React frontend and the Go API into a single image. The Go server
# serves the built frontend from the same origin, so there is one process, one
# port, and no CORS or reverse proxy to configure.

# --- Stage 1: build the frontend -------------------------------------------
FROM node:22-alpine AS frontend

WORKDIR /src/frontend

# Dependencies first, so a source-only change reuses the install layer.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# "build" runs tsc --noEmit first, so a type error fails the image build.
RUN npm run build

# --- Stage 2: build the backend --------------------------------------------
FROM golang:1.26-alpine AS backend

WORKDIR /src/backend

COPY backend/go.mod ./
RUN go mod download

COPY backend/ ./
# Static binary: no libc at runtime, so it can live in a scratch-like image.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# --- Stage 3: runtime -------------------------------------------------------
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /app

COPY --from=backend /out/server /app/server
COPY --from=frontend /src/frontend/dist /app/web

ENV PORT=8080 \
    STATIC_DIR=/app/web

EXPOSE 8080
USER nonroot:nonroot

# No shell in this image, so health checks are HTTP probes against /health
# rather than a HEALTHCHECK instruction.
ENTRYPOINT ["/app/server"]
