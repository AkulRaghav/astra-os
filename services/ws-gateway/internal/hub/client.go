package hub

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 8192
)

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, rawMsg, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WS read error: %v", err)
			}
			break
		}

		var msg WSMessage
		if err := json.Unmarshal(rawMsg, &msg); err != nil {
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleMessage(msg WSMessage) {
	switch msg.Type {
	case "subscribe":
		c.Hub.Subscribe(c, msg.Channel)
		c.sendAck("subscribed", msg.Channel)

	case "unsubscribe":
		c.Hub.Unsubscribe(c, msg.Channel)
		c.sendAck("unsubscribed", msg.Channel)

	case "publish":
		c.Hub.Publish(&ChannelMessage{
			Channel: msg.Channel,
			Event:   msg.Event,
			Data:    msg.Data,
			Sender:  c.ID,
		})

	case "presence":
		// Cursor/presence update for collaboration
		c.Hub.Publish(&ChannelMessage{
			Channel: msg.Channel,
			Event:   "cursor_move",
			Data:    msg.Data,
			Sender:  c.ID,
		})

	case "crdt_update":
		// Collaborative editing operation
		c.Hub.Publish(&ChannelMessage{
			Channel: msg.Channel,
			Event:   "crdt_update",
			Data:    msg.Data,
			Sender:  c.ID,
		})

	case "ping":
		c.sendJSON(map[string]string{"type": "pong"})

	case "get_presence":
		users := c.Hub.GetOnlineUsers(msg.Channel)
		c.sendJSON(map[string]interface{}{
			"type":    "presence_list",
			"channel": msg.Channel,
			"users":   users,
		})
	}
}

func (c *Client) sendAck(event, channel string) {
	c.sendJSON(map[string]string{
		"type":    "ack",
		"event":   event,
		"channel": channel,
	})
}

func (c *Client) sendJSON(v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	select {
	case c.Send <- data:
	default:
	}
}
