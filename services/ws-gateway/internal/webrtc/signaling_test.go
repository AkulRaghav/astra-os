package webrtc

import (
	"testing"
)

func TestJoinRoom(t *testing.T) {
	server := NewSignalingServer()
	send := make(chan []byte, 10)

	existing := server.JoinRoom("room-1", "user-a", "client-1", send)
	if len(existing) != 0 {
		t.Errorf("expected 0 existing members, got %d", len(existing))
	}

	send2 := make(chan []byte, 10)
	existing = server.JoinRoom("room-1", "user-b", "client-2", send2)
	if len(existing) != 1 {
		t.Errorf("expected 1 existing member, got %d", len(existing))
	}
	if existing[0] != "user-a" {
		t.Errorf("expected user-a, got %s", existing[0])
	}
}

func TestLeaveRoom(t *testing.T) {
	server := NewSignalingServer()
	send := make(chan []byte, 10)

	server.JoinRoom("room-1", "user-a", "client-1", send)
	send2 := make(chan []byte, 10)
	server.JoinRoom("room-1", "user-b", "client-2", send2)

	server.LeaveRoom("room-1", "user-a")

	members := server.GetRoomMembers("room-1")
	if len(members) != 1 {
		t.Errorf("expected 1 member after leave, got %d", len(members))
	}
}

func TestLeaveRoom_Cleanup(t *testing.T) {
	server := NewSignalingServer()
	send := make(chan []byte, 10)
	server.JoinRoom("room-1", "user-a", "client-1", send)
	server.LeaveRoom("room-1", "user-a")

	members := server.GetRoomMembers("room-1")
	if members != nil {
		t.Errorf("expected nil members after room cleanup, got %v", members)
	}
}

func TestGetRoomMembers(t *testing.T) {
	server := NewSignalingServer()

	members := server.GetRoomMembers("nonexistent")
	if members != nil {
		t.Errorf("expected nil for nonexistent room")
	}

	send := make(chan []byte, 10)
	server.JoinRoom("room-1", "user-a", "client-1", send)
	send2 := make(chan []byte, 10)
	server.JoinRoom("room-1", "user-b", "client-2", send2)

	members = server.GetRoomMembers("room-1")
	if len(members) != 2 {
		t.Errorf("expected 2 members, got %d", len(members))
	}
}
