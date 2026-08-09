package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ViniciusKumagai/calculator/backend/internal/httpapi"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Set in the Docker image to serve the built frontend alongside the API.
	// Left unset for local development, where Vite serves the frontend.
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir != "" {
		if _, err := os.Stat(staticDir); err != nil {
			log.Fatalf("STATIC_DIR %q is not readable: %v", staticDir, err)
		}
		log.Printf("serving frontend from %s", staticDir)
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           httpapi.NewRouter(staticDir),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("calculator API listening on http://localhost:%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
}
