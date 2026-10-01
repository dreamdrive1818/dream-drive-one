"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../lib/api";
import CarsPage from "../cars/page";
import VehiclesPage from "../vehicles/page";

const CARS_ROLES = new Set(["SALES", "FLEET_OPS", "CITY_MANAGER", "SUPER_ADMIN"]);
const VEHICLE_ROLES = new Set(["FLEET_OPS", "BRANCH_MANAGER", "CITY_MANAGER", "SUPER_ADMIN"]);

function can(roles, allowed) {
  if ((roles || []).includes("SUPER_ADMIN")) return true;
  return (roles || []).some((role) => allowed.has(role));
}

function FleetInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [roles, setRoles] = useState(null);
  const canCars = roles == null || can(roles, CARS_ROLES);
  const canVehicles = roles == null || can(roles, VEHICLE_ROLES);
  const requested = params.get("view");
  const view =
    requested === "vehicles" && canVehicles
      ? "vehicles"
      : requested === "cars" && canCars
        ? "cars"
        : canCars
          ? "cars"
          : "vehicles";

  useEffect(() => {
    api("/v1/me")
      .then((user) => setRoles(user.roles || []))
      .catch(() => setRoles([]));
  }, []);

  function setView(next) {
    router.replace(`/fleet?view=${next}`);
  }

  return (
    <div>
      <h2>Fleet</h2>
      <p className="muted">
        Switch by use case: car models for catalog and pricing, vehicles for number plates and documents.
      </p>
      <div className="tabs fleet-switch">
        {canCars && (
          <button type="button" className={view === "cars" ? "active" : ""} onClick={() => setView("cars")}>
            Car models
            <small>What customers book</small>
          </button>
        )}
        {canVehicles && (
          <button type="button" className={view === "vehicles" ? "active" : ""} onClick={() => setView("vehicles")}>
            Vehicles
            <small>Plates, status, papers</small>
          </button>
        )}
      </div>
      {view === "cars" ? <CarsPage hideTitle /> : <VehiclesPage hideTitle />}
    </div>
  );
}

export default function FleetPage() {
  return (
    <Suspense fallback={<p className="muted">Loading fleet…</p>}>
      <FleetInner />
    </Suspense>
  );
}
