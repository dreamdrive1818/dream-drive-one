const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010";

export function subscribeBookingStatus(bookingId, onEvent) {
  if (typeof window === "undefined" || !bookingId) return () => {};
  let socket;
  let stopped = false;

  function attach(io) {
    if (stopped || !io) return;
    socket = io(`${SOCKET_URL}/booking`, { transports: ["websocket", "polling"] });
    socket.on("connect", () => socket.emit("booking:subscribe", { bookingId }));
    socket.on("booking:status", (payload) => onEvent(payload));
  }

  if (window.io) attach(window.io);
  else {
    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
    script.async = true;
    script.onload = () => attach(window.io);
    document.head.appendChild(script);
  }

  return () => {
    stopped = true;
    if (socket) socket.close();
  };
}
