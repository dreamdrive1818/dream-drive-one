"use client";

export default function GlobalError({ reset }) {
  return (
    <html lang="en">
      <body style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <h2>Something went wrong</h2>
        <button type="button" onClick={() => reset?.()}>
          Try again
        </button>
      </body>
    </html>
  );
}
