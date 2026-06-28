package webrtc

import (
	"encoding/json"
	"sync"
)

// Room represents a WebRTC room for voice/video collaboration
type Room struct {
	ID      string
	Members map[string]*Peer
	mu      sync.RWMutex
}

// Peer represents a participant in a WebRTC room
type Peer struct {
	UserID   string
	ClientID string
	Send     chan []byte
}

// SignalMessage represents a WebRTC signaling message
type SignalMessage struct {
	Type      string          `json:"type"` // "offer", "answer", "ice-candidate", "join", "leave"
	RoomID    string          `json:"room_id"`
	FromUser  string          `json:"from_user"`
	ToUser    string          `json:"to_user,omitempty"`
	Payload   json.RawMessage `json:"payload,omitempty"`
}

// SignalingServer manages WebRTC rooms and signaling
type SignalingServer struct {
	rooms map[string]*Room
	mu    sync.RWMutex
}

// NewSignalingServer creates a new signaling server
func NewSignalingServer() *SignalingServer {
	return &SignalingServer{
		rooms: make(map[string]*Room),
	}
}

// JoinRoom adds a peer to a room
func (s *SignalingServer) JoinRoom(roomID, userID, clientID string, send chan []byte) []string {
	s.mu.Lock()
	defer s.mu.Unlock()

	room, exists := s.rooms[roomID]
	if !exists {
		room = &Room{
			ID:      roomID,
			Members: make(map[string]*Peer),
		}
		s.rooms[roomID] = room
	}

	room.mu.Lock()
	defer room.mu.Unlock()

	// Get existing members before adding new one
	existingMembers := make([]string, 0, len(room.Members))
	for uid := range room.Members {
		existingMembers = append(existingMembers, uid)
	}

	room.Members[userID] = &Peer{
		UserID:   userID,
		ClientID: clientID,
		Send:     send,
	}

	// Notify existing members
	joinMsg, _ := json.Marshal(SignalMessage{
		Type:     "peer_joined",
		RoomID:   roomID,
		FromUser: userID,
	})
	for _, peer := range room.Members {
		if peer.UserID != userID {
			select {
			case peer.Send <- joinMsg:
			default:
			}
		}
	}

	return existingMembers
}

// LeaveRoom removes a peer from a room
func (s *SignalingServer) LeaveRoom(roomID, userID string) {
	s.mu.RLock()
	room, exists := s.rooms[roomID]
	s.mu.RUnlock()

	if !exists {
		return
	}

	room.mu.Lock()
	delete(room.Members, userID)
	remaining := len(room.Members)
	room.mu.Unlock()

	// Notify remaining members
	leaveMsg, _ := json.Marshal(SignalMessage{
		Type:     "peer_left",
		RoomID:   roomID,
		FromUser: userID,
	})

	room.mu.RLock()
	for _, peer := range room.Members {
		select {
		case peer.Send <- leaveMsg:
		default:
		}
	}
	room.mu.RUnlock()

	// Clean up empty rooms
	if remaining == 0 {
		s.mu.Lock()
		delete(s.rooms, roomID)
		s.mu.Unlock()
	}
}

// RelaySignal forwards a signaling message to the target peer
func (s *SignalingServer) RelaySignal(msg SignalMessage) {
	s.mu.RLock()
	room, exists := s.rooms[msg.RoomID]
	s.mu.RUnlock()

	if !exists {
		return
	}

	data, _ := json.Marshal(msg)

	room.mu.RLock()
	defer room.mu.RUnlock()

	if msg.ToUser != "" {
		// Send to specific peer
		if peer, ok := room.Members[msg.ToUser]; ok {
			select {
			case peer.Send <- data:
			default:
			}
		}
	} else {
		// Broadcast to all except sender
		for _, peer := range room.Members {
			if peer.UserID != msg.FromUser {
				select {
				case peer.Send <- data:
				default:
				}
			}
		}
	}
}

// GetRoomMembers returns the list of users in a room
func (s *SignalingServer) GetRoomMembers(roomID string) []string {
	s.mu.RLock()
	room, exists := s.rooms[roomID]
	s.mu.RUnlock()

	if !exists {
		return nil
	}

	room.mu.RLock()
	defer room.mu.RUnlock()

	members := make([]string, 0, len(room.Members))
	for uid := range room.Members {
		members = append(members, uid)
	}
	return members
}
