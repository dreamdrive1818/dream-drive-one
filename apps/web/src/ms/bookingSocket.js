const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4010";

function loadSocketIo() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.io) return Promise.resolve(window.io);
  return new Promise((resolve) => {
    const existing = document.querySelector("script[data-dd-socket]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.io || null));
      existing.addEventListener("error", () => resolve(null));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.8.1/socket.io.min.js";
    script.async = true;
    script.dataset.ddSocket = "1";
    script.onload = () => resolve(window.io || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Subscribe to booking status. Prefers socket :4010, falls back to polling `fetcher`.
 * Returns an unsubscribe function.
 */
export function subscribeBookingStatus(bookingId, onEvent, fetcher) {
  let stopped = false;
  let socket;
  let pollTimer;

  function poll() {
    if (!fetcher || stopped) return;
    fetcher().then((data) => {
      if (!stopped && data) onEvent({ type: "poll", booking: data });
    }).catch(() => undefined);
  }

  pollTimer = setInterval(poll, 8000);

  loadSocketIo().then((io) => {
    if (stopped || !io || !bookingId) return;
    socket = io(`${SOCKET_URL}/booking`, { transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      socket.emit("booking:subscribe", { bookingId });
    });
    socket.on("booking:status", (payload) => {
      if (!stopped) onEvent({ type: "socket", payload });
    });
  });

  return () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (socket) socket.close();
  };
}
