package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/astra-os/api-gateway/internal/auth"
	"github.com/astra-os/api-gateway/internal/config"
	"github.com/astra-os/api-gateway/internal/database"
	"github.com/astra-os/api-gateway/internal/graphql"
	"github.com/astra-os/api-gateway/internal/redis"
	"github.com/astra-os/api-gateway/internal/routes"
)

func main() {
	cfg := config.Load()

	// Initialize database
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize Redis (optional - graceful degradation)
	rdb, err := redis.Connect(cfg.RedisURL)
	if err != nil {
		log.Printf("Warning: Redis not available: %v (running without cache/sessions)", err)
		rdb = redis.NewNoop()
	}
	defer rdb.Close()

	// Initialize auth service
	authService := auth.NewService(db, rdb, cfg)

	// Setup router
	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Timeout(60 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"api-gateway"}`))
	})

	// Auth routes
	r.Route("/auth", func(r chi.Router) {
		r.Post("/signup", authService.HandleSignup)
		r.Post("/login", authService.HandleLogin)
		r.Post("/refresh", authService.HandleRefresh)
		r.Post("/logout", authService.HandleLogout)
		r.Post("/forgot-password", authService.HandleForgotPassword)
		r.Post("/reset-password", authService.HandleResetPassword)
		r.Post("/verify-email", authService.HandleVerifyEmail)

		// OAuth routes
		r.Get("/oauth/gmail/callback", func(w http.ResponseWriter, r *http.Request) {
			// Proxy Gmail OAuth callback to AI service
			http.Redirect(w, r, "http://localhost:8082/api/v1/gmail/callback?"+r.URL.RawQuery, http.StatusTemporaryRedirect)
		})
		r.Get("/oauth/{provider}", authService.HandleOAuthRedirect)
		r.Get("/oauth/{provider}/callback", authService.HandleOAuthCallback)

		// 2FA routes
		r.Group(func(r chi.Router) {
			r.Use(authService.AuthMiddleware)
			r.Post("/2fa/enable", authService.HandleEnable2FA)
			r.Post("/2fa/verify", authService.HandleVerify2FA)
			r.Post("/2fa/disable", authService.HandleDisable2FA)
		})
	})

	// Protected routes
	r.Group(func(r chi.Router) {
		r.Use(authService.AuthMiddleware)

		// Session management
		r.Get("/auth/sessions", authService.HandleListSessions)
		r.Delete("/auth/sessions/{id}", authService.HandleRevokeSession)

		// GraphQL endpoint
		r.Handle("/graphql", graphql.NewHandler(db, rdb, authService))
		r.Get("/graphql/playground", graphql.PlaygroundHandler())

		// REST API routes
		api := routes.NewAPI(db, rdb)
		api.Mount(r)
	})

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("API Gateway starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}
	log.Println("Server stopped")
}
