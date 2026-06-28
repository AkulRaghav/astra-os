package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"

	"github.com/astra-os/ws-gateway/internal/hub"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379/0"
	}

	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("Failed to parse Redis URL: %v", err)
	}
	rdb := redis.NewClient(opts)
	defer rdb.Close()

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Printf("Warning: Redis not available: %v (running without pub/sub)", err)
	}

	h := hub.New()
	go h.Run()

	// Subscribe to Redis for cross-instance messaging
	go subscribeRedis(rdb, h)

	r := chi.NewRouter()

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"healthy","service":"ws-gateway"}`))
	})

	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(h, w, r)
	})

	// REST endpoint to push notifications from other services
	r.Post("/internal/notify", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UserID string      `json:"user_id"`
			Event  string      `json:"event"`
			Data   interface{} `json:"data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", 400)
			return
		}
		h.PublishToUser(req.UserID, req.Event, req.Data)
		w.WriteHeader(http.StatusAccepted)
	})

	// REST endpoint to publish to a channel
	r.Post("/internal/publish", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Channel string      `json:"channel"`
			Event   string      `json:"event"`
			Data    interface{} `json:"data"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", 400)
			return
		}
		h.Publish(&hub.ChannelMessage{
			Channel: req.Channel,
			Event:   req.Event,
			Data:    req.Data,
		})
		w.WriteHeader(http.StatusAccepted)
	})

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", port),
		Handler: r,
	}

	go func() {
		log.Printf("WebSocket Gateway starting on port %s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down WS Gateway...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func handleWebSocket(h *hub.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	userID := r.URL.Query().Get("user_id")
	token := r.URL.Query().Get("token")
	if userID == "" && token == "" {
		userID = "anonymous"
	}
	// TODO: Validate JWT token in production

	client := hub.NewClient(h, conn, userID)
	h.Register(client)

	// Auto-subscribe to user's personal channel
	h.Subscribe(client, "user:"+userID)
	// Auto-subscribe to presence
	h.Subscribe(client, "presence")

	go client.ReadPump()
	go client.WritePump()
}

func subscribeRedis(rdb *redis.Client, h *hub.Hub) {
	ctx := context.Background()
	pubsub := rdb.Subscribe(ctx,
		"astra:notifications",
		"astra:presence",
		"astra:collaboration",
		"astra:files",
		"astra:tasks",
	)
	defer pubsub.Close()

	for msg := range pubsub.Channel() {
		var payload struct {
			Channel string      `json:"channel"`
			Event   string      `json:"event"`
			Data    interface{} `json:"data"`
			UserID  string      `json:"user_id,omitempty"`
		}
		if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
			continue
		}

		if payload.UserID != "" {
			h.PublishToUser(payload.UserID, payload.Event, payload.Data)
		} else if payload.Channel != "" {
			h.Publish(&hub.ChannelMessage{
				Channel: payload.Channel,
				Event:   payload.Event,
				Data:    payload.Data,
			})
		}
	}
}
