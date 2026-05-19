import { createContext, useContext, useEffect, useRef } from "react";

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const reconnectingRef = useRef(false);

  const token = localStorage.getItem("access");

  useEffect(() => {
    if (!token) return;
    if (socket.current) return;

    console.log("🚀 Global socket connecting...");

    const connect = () => {
      const ws = new WebSocket(
        `ws://127.0.0.1:8000/ws/chat/?token=${token}`
      );

      ws.onopen = () => {
        console.log("✅ WS connected (global)");
      };

      ws.onclose = () => {
        console.log("❌ WS closed");

        if (reconnectingRef.current) return;

        reconnectingRef.current = true;

        setTimeout(() => {
          reconnectingRef.current = false;
          connect(); // 🔁 reconnect
        }, 2000);
      };

      ws.onerror = () => console.log("❌ WS error");

      socket.current = ws;
    };

    connect();

  }, [token]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};