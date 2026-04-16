import { useState, useRef, useCallback, useEffect } from "react";

export function useWebSocket({ token, onLogout }) {
  const [evse, setEvse] = useState({});
  const [powerHistory, setPowerHistory] = useState([]);
  const [wsStatus, setWsStatus] = useState("connecting");

  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (!token) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus("connected");

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "snapshot") {
        setEvse(msg.state ?? {});
        setPowerHistory((msg.power_history ?? []).map((p) => ({ t: p.t, v: p.v })));
      } else if (msg.type === "update") {
        setEvse((prev) => ({ ...prev, [msg.topic]: msg.value }));
        if (msg.topic === "power") {
          setPowerHistory((prev) => [
            ...prev.slice(-119),
            { t: Date.now(), v: parseFloat(msg.value) || 0 },
          ]);
        }
      }
    };

    ws.onclose = (e) => {
      setWsStatus("disconnected");
      if (e.code === 4001) {
        onLogout();
        return;
      }
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }, [token, onLogout]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { evse, powerHistory, wsStatus };
}
