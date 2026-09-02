"use client";

import { Navigate, useLocation } from "react-router-dom";

/** /cars → /fleet with the same query string (car detail stays on /cars/:slug). */
export default function CarsRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/fleet${search}`} replace />;
}
