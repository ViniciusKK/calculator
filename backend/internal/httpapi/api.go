// Package httpapi wires the calculator domain to REST endpoints.
package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"math"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/ViniciusKumagai/calculator/backend/internal/calc"
)

type calcRequest struct {
	A *float64 `json:"a"`
	B *float64 `json:"b"`
}

type calcResponse struct {
	Op     string  `json:"op"`
	A      float64 `json:"a"`
	B      float64 `json:"b"`
	Result float64 `json:"result"`
}

type unaryRequest struct {
	A *float64 `json:"a"`
}

type unaryResponse struct {
	Op     string  `json:"op"`
	A      float64 `json:"a"`
	Result float64 `json:"result"`
}

type errorResponse struct {
	Error string `json:"error"`
}

// NewRouter returns the HTTP handler for the whole API. Pass a non-empty
// staticDir to also serve a built frontend from the same origin, which is how
// the Docker image runs; pass "" for the API alone.
func NewRouter(staticDir string) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("POST /api/add", handleOp(calc.Add))
	mux.HandleFunc("POST /api/subtract", handleOp(calc.Subtract))
	mux.HandleFunc("POST /api/multiply", handleOp(calc.Multiply))
	mux.HandleFunc("POST /api/divide", handleOp(calc.Divide))
	mux.HandleFunc("POST /api/power", handleOp(calc.Power))
	mux.HandleFunc("POST /api/sqrt", handleSqrt)

	if staticDir != "" {
		mux.Handle("GET /", handleStatic(staticDir))
	}

	return withCORS(mux)
}

// handleStatic serves the built frontend, falling back to index.html so client
// routing keeps working. Unmatched /api/ paths stay JSON 404s rather than
// silently returning the app shell.
func handleStatic(dir string) http.HandlerFunc {
	files := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")

	return func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			writeError(w, http.StatusNotFound, "unknown endpoint")
			return
		}

		// path.Clean resolves any "..", so the join cannot escape dir.
		requested := filepath.Join(dir, filepath.FromSlash(path.Clean(r.URL.Path)))
		if info, err := os.Stat(requested); err == nil && !info.IsDir() {
			// Vite fingerprints asset filenames, so they are safe to pin.
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			files.ServeHTTP(w, r)
			return
		}

		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, index)
	}
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleOp(op calc.Op) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req calcRequest
		dec := json.NewDecoder(r.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, `invalid JSON body: expected {"a": number, "b": number}`)
			return
		}
		if req.A == nil || req.B == nil {
			writeError(w, http.StatusBadRequest, `both "a" and "b" are required`)
			return
		}

		result, err := calc.Apply(op, *req.A, *req.B)
		if errors.Is(err, calc.ErrDivideByZero) {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		// JSON cannot represent Inf/NaN, so reject rather than emit invalid output.
		if math.IsInf(result, 0) || math.IsNaN(result) {
			writeError(w, http.StatusUnprocessableEntity, "result is not a finite number")
			return
		}

		writeJSON(w, http.StatusOK, calcResponse{
			Op:     string(op),
			A:      *req.A,
			B:      *req.B,
			Result: result,
		})
	}
}

func handleSqrt(w http.ResponseWriter, r *http.Request) {
	var req unaryRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, `invalid JSON body: expected {"a": number}`)
		return
	}
	if req.A == nil {
		writeError(w, http.StatusBadRequest, `"a" is required`)
		return
	}

	result, err := calc.Sqrt(*req.A)
	if errors.Is(err, calc.ErrNegativeRoot) {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, unaryResponse{
		Op:     "sqrt",
		A:      *req.A,
		Result: result,
	})
}

// withCORS lets the Vite dev server call the API from another origin.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write response: %v", err)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, errorResponse{Error: msg})
}
