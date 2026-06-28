/**
 * WebSocket client for real-time features.
 * Handles notifications, presence, collaboration updates.
 */

type MessageHandler = (data: any) => void;

class AstraWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  connect(userId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    const port = "8081"; // WS gateway port
    const url = `${protocol}//${host}:${port}/ws?user_id=${userId}`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("[WS] Connected");
        this.reconnectAttempts = 0;
        this.emit("connected", {});
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.event || msg.type, msg.data || msg);
          // Also emit on channel-specific handlers
          if (msg.channel) {
            this.emit(`channel:${msg.channel}`, msg);
          }
        } catch {}
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected");
        this.emit("disconnected", {});
        this.scheduleReconnect(userId);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.log("[WS] Connection failed, will retry");
      this.scheduleReconnect(userId);
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  send(type: string, data?: any) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ...data }));
  }

  subscribe(channel: string) {
    this.send("subscribe", { channel });
  }

  unsubscribe(channel: string) {
    this.send("unsubscribe", { channel });
  }

  publish(channel: string, event: string, data: any) {
    this.send("publish", { channel, event, data });
  }

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: MessageHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    this.handlers.get(event)?.forEach(h => h(data));
    this.handlers.get("*")?.forEach(h => h({ event, data }));
  }

  private scheduleReconnect(userId: string) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect(userId);
    }, delay);
  }
}

export const ws = new AstraWebSocket();
