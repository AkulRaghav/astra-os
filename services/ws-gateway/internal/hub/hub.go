package hub

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Hub struct {
	clients    map[string]*Client
	channels   map[string]map[string]*Client
	presence   map[string]*PresenceInfo
	register   chan *Client
	unregister chan *Client
	broadcast  chan *ChannelMessage
	mu         sync.RWMutex
}

type Client struct {
	ID       string
	UserID   string
	Conn     *websocket.Conn
	Send     chan []byte
	Channels map[string]bool
	Hub      *Hub
}

type PresenceInfo struct {
	UserID   string `json:"user_id"`
	Status   string `json:"status"`
	LastSeen int64  `json:"last_seen"`
}

type ChannelMessage struct {
	Channel string      `json:"channel"`
	Event   string      `json:"event"`
	Data    interface{} `json:"data"`
	Sender  string      `json:"-"`
}

type WSMessage struct {
	Type    string          `json:"type"`
	Channel string          `json:"channel,omitempty"`
	Event   string          `json:"event,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`
}

func New() *Hub {
	return &Hub{
		clients:    make(map[string]*Client),
		channels:   make(map[string]map[string]*Client),
		presence:   make(map[string]*PresenceInfo),
		register:   make(chan *Client, 64),
		unregister: make(chan *Client, 64),
		broadcast:  make(chan *ChannelMessage, 256),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.presence[client.UserID] = &PresenceInfo{
				UserID:   client.UserID,
				Status:   "online",
				LastSeen: time.Now().Unix(),
			}
			h.mu.Unlock()
			log.Printf("Client connected: %s (user: %s)", client.ID, client.UserID)
			h.broadcastPresence(client.UserID, "online")

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				for ch := range client.Channels {
					if clients, exists := h.channels[ch]; exists {
						delete(clients, client.ID)
						if len(clients) == 0 {
							delete(h.channels, ch)
						}
					}
				}
				close(client.Send)
				// Check if user has other connections
				hasOther := false
				for _, c := range h.clients {
					if c.UserID == client.UserID {
						hasOther = true
						break
					}
				}
				if !hasOther {
					if p, exists := h.presence[client.UserID]; exists {
						p.Status = "offline"
						p.LastSeen = time.Now().Unix()
					}
				}
			}
			h.mu.Unlock()
			log.Printf("Client disconnected: %s", client.ID)
			h.broadcastPresence(client.UserID, "offline")

		case msg := <-h.broadcast:
			h.mu.RLock()
			if clients, exists := h.channels[msg.Channel]; exists {
				data, _ := json.Marshal(msg)
				for _, client := range clients {
					if client.ID == msg.Sender {
						continue
					}
					select {
					case client.Send <- data:
					default:
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Register(client *Client) {
	h.register <- client
}

func (h *Hub) Unregister(client *Client) {
	h.unregister <- client
}

func (h *Hub) Subscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, exists := h.channels[channel]; !exists {
		h.channels[channel] = make(map[string]*Client)
	}
	h.channels[channel][client.ID] = client
	client.Channels[channel] = true
}

func (h *Hub) Unsubscribe(client *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, exists := h.channels[channel]; exists {
		delete(clients, client.ID)
		if len(clients) == 0 {
			delete(h.channels, channel)
		}
	}
	delete(client.Channels, channel)
}

func (h *Hub) Publish(msg *ChannelMessage) {
	h.broadcast <- msg
}

func (h *Hub) PublishToUser(userID string, event string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	payload, _ := json.Marshal(&ChannelMessage{
		Channel: "user:" + userID,
		Event:   event,
		Data:    data,
	})
	for _, client := range h.clients {
		if client.UserID == userID {
			select {
			case client.Send <- payload:
			default:
			}
		}
	}
}

func (h *Hub) GetOnlineUsers(channel string) []PresenceInfo {
	h.mu.RLock()
	defer h.mu.RUnlock()
	var users []PresenceInfo
	if clients, exists := h.channels[channel]; exists {
		seen := make(map[string]bool)
		for _, client := range clients {
			if !seen[client.UserID] {
				seen[client.UserID] = true
				if p, ok := h.presence[client.UserID]; ok {
					users = append(users, *p)
				}
			}
		}
	}
	return users
}

func (h *Hub) broadcastPresence(userID, status string) {
	h.broadcast <- &ChannelMessage{
		Channel: "presence",
		Event:   "presence_changed",
		Data: map[string]interface{}{
			"user_id": userID,
			"status":  status,
			"time":    time.Now().Unix(),
		},
	}
}

func NewClient(hub *Hub, conn *websocket.Conn, userID string) *Client {
	return &Client{
		ID:       uuid.New().String(),
		UserID:   userID,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Channels: make(map[string]bool),
		Hub:      hub,
	}
}
