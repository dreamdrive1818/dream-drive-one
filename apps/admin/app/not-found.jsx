export const metadata = {
  title: "404 – Page not found",
};

/**
 * Server 404. Do not mark this as a client component and do not render
 * <html>/<body> here — the root layout already provides those. Nesting them
 * triggers React error #31 during Next.js 15 static prerender.
 */
export default function NotFound() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h2>404 – Page not found</h2>
      <p className="muted">The page you are looking for does not exist.</p>
      <a href="/">Go to Dashboard</a>
    </div>
  );
}
