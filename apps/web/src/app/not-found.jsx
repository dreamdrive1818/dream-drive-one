export const metadata = {
  title: "404 – Page Not Found | Dream Drive",
  robots: { index: false, follow: false },
};

/**
 * Custom 404 page for Next.js App Router.
 *
 * This server component gives Next.js a clean, static 404 to prerender
 * during `next build`, so it never tries to prerender the [[...slug]]
 * catch-all for the /404 path (which would drag in browser-only modules
 * like react-quill and trigger React error #31 in React 19).
 *
 * NOTE: Do NOT add <html>/<body> here — the root layout.jsx already
 * provides them. Nesting <html> inside <body> triggers React error #31
 * during static prerendering in Next.js 15 + React 19.
 */
export default function NotFound() {
  return (
    <div
      style={{
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        background: "#f9f9f9",
        color: "#111",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: "4rem", margin: "0 0 0.25rem" }}>404</h1>
        <p style={{ fontSize: "1.1rem", color: "#555" }}>
          Page not found. Let&apos;s get you back on the road.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: "1.25rem",
            padding: "0.6rem 1.4rem",
            background: "#6c3ce1",
            color: "#fff",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
