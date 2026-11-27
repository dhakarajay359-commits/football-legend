export class MultiplayerClient {
  private ws: WebSocket | null = null;
  public roomCode: string | null = null;
  public slot: string | null = null;
  public reconnectToken: string | null = null;
  public connected = false;

  private onMessageCb: ((msg: any) => void) | null = null;

  public connect(username: string, profileId: string, onMessage: (msg: any) => void) {
    this.onMessageCb = onMessage;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.send({ type: 'hello', username, profileId });
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'room_joined') {
          this.roomCode = msg.roomCode;
          this.slot = msg.slot;
          this.reconnectToken = msg.reconnectToken;
          localStorage.setItem('apex_reconnect', JSON.stringify({
            roomCode: msg.roomCode,
            token: msg.reconnectToken,
            slot: msg.slot
          }));
        }
        this.onMessageCb?.(msg);
      } catch {
        // ignore malformed
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.onMessageCb?.({ type: 'disconnected' });
    };
  }

  public send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public disconnect() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}
