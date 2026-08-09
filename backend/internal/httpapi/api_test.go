package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func do(t *testing.T, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder, into any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), into); err != nil {
		t.Fatalf("decoding %q: %v", rec.Body.String(), err)
	}
}

func TestHealth(t *testing.T) {
	rec := do(t, http.MethodGet, "/health", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var body map[string]string
	decode(t, rec, &body)
	if body["status"] != "ok" {
		t.Errorf("status field = %q, want %q", body["status"], "ok")
	}
}

func TestOperations(t *testing.T) {
	tests := []struct {
		path string
		body string
		want float64
	}{
		{path: "/api/add", body: `{"a":2,"b":3}`, want: 5},
		{path: "/api/subtract", body: `{"a":2,"b":3}`, want: -1},
		{path: "/api/multiply", body: `{"a":2,"b":3}`, want: 6},
		{path: "/api/divide", body: `{"a":6,"b":3}`, want: 2},
		{path: "/api/add", body: `{"a":0.5,"b":0.25}`, want: 0.75},
		{path: "/api/multiply", body: `{"a":-4,"b":2.5}`, want: -10},
	}

	for _, tt := range tests {
		t.Run(tt.path+tt.body, func(t *testing.T) {
			rec := do(t, http.MethodPost, tt.path, tt.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d (%s), want %d", rec.Code, rec.Body.String(), http.StatusOK)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", ct)
			}
			var body calcResponse
			decode(t, rec, &body)
			if body.Result != tt.want {
				t.Errorf("result = %v, want %v", body.Result, tt.want)
			}
		})
	}
}

func TestRejectsBadInput(t *testing.T) {
	tests := []struct {
		name string
		body string
	}{
		{name: "not json", body: `hello`},
		{name: "letters for numbers", body: `{"a":"x","b":2}`},
		{name: "numeric strings", body: `{"a":"2","b":"3"}`},
		{name: "missing b", body: `{"a":2}`},
		{name: "missing both", body: `{}`},
		{name: "null operand", body: `{"a":2,"b":null}`},
		{name: "unknown field", body: `{"a":2,"b":3,"c":4}`},
		{name: "empty body", body: ``},
		{name: "array instead of object", body: `[1,2]`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, http.MethodPost, "/api/add", tt.body)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("status = %d (%s), want %d", rec.Code, rec.Body.String(), http.StatusBadRequest)
			}
			var body errorResponse
			decode(t, rec, &body)
			if body.Error == "" {
				t.Error("expected a non-empty error message")
			}
		})
	}
}

func TestUnprocessableResults(t *testing.T) {
	tests := []struct {
		name string
		path string
		body string
		want string
	}{
		{name: "divide by zero", path: "/api/divide", body: `{"a":1,"b":0}`, want: "division by zero"},
		{name: "overflow to infinity", path: "/api/add", body: `{"a":1e308,"b":1e308}`, want: "result is not a finite number"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, http.MethodPost, tt.path, tt.body)
			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("status = %d (%s), want %d", rec.Code, rec.Body.String(), http.StatusUnprocessableEntity)
			}
			var body errorResponse
			decode(t, rec, &body)
			if body.Error != tt.want {
				t.Errorf("error = %q, want %q", body.Error, tt.want)
			}
		})
	}
}

func TestRouting(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		want   int
	}{
		{name: "GET on an operation", method: http.MethodGet, path: "/api/add", want: http.StatusMethodNotAllowed},
		{name: "POST on health", method: http.MethodPost, path: "/health", want: http.StatusMethodNotAllowed},
		{name: "unknown operation", method: http.MethodPost, path: "/api/modulo", want: http.StatusNotFound},
		{name: "unknown path", method: http.MethodGet, path: "/nope", want: http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := do(t, tt.method, tt.path, `{"a":1,"b":2}`)
			if rec.Code != tt.want {
				t.Errorf("status = %d, want %d", rec.Code, tt.want)
			}
		})
	}
}

func TestCORS(t *testing.T) {
	rec := do(t, http.MethodOptions, "/api/add", "")
	if rec.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want %d", rec.Code, http.StatusNoContent)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Allow-Origin = %q, want %q", got, "*")
	}

	rec = do(t, http.MethodPost, "/api/add", `{"a":1,"b":2}`)
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Allow-Origin on a real request = %q, want %q", got, "*")
	}
}
