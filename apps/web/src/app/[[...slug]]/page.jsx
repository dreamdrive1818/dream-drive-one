"use client";

import dynamic from "next/dynamic";

const ClientApp = dynamic(() => import("../ClientApp"), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      Loading Dream Drive…
    </div>
  ),
});

/**
 * Catch-all so Next.js serves every path and react-router handles routing.
 * Ported from dream-drive-static/client-main.
 */
export default function CatchAllPage() {
  return <ClientApp />;
}
