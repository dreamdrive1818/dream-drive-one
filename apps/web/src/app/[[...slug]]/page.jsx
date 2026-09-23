"use client";

import dynamic from "next/dynamic";
import { AppBootSkeleton } from "../../components/Skeleton/Skeleton";

const ClientApp = dynamic(() => import("../ClientApp"), {
  ssr: false,
  loading: () => <AppBootSkeleton />,
});

/**
 * Catch-all so Next.js serves every path and react-router handles routing.
 * Ported from dream-drive-static/client-main.
 */
export default function CatchAllPage() {
  return <ClientApp />;
}
