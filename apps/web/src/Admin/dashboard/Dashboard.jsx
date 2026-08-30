import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faRoute,
  faCarSide,
  faArrowRight,
  faInbox,
} from "@fortawesome/free-solid-svg-icons";
import "./Dashboard.css";
import api from "../../api/http";

const Dashboard = () => {
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cars, setCars] = useState([]);
  const [latestOrders, setLatestOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [usersRes, ordersRes, carsRes, latestRes] = await Promise.all([
          api.get("/api/identity/users"),
          api.get("/api/booking/orders"),
          api.get("/api/catalog/cars"),
          api.get("/api/booking/orders/latest"),
        ]);

        setUsers(usersRes.data);
        setOrders(ordersRes.data);
        setCars(carsRes.data);
        setLatestOrders(latestRes.data);
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const statusClass = (status = "") => {
    const value = String(status).toLowerCase();
    if (value.includes("complete") || value.includes("confirm") || value.includes("paid")) {
      return "admin-badge admin-badge-success";
    }
    if (value.includes("cancel") || value.includes("reject") || value.includes("fail")) {
      return "admin-badge admin-badge-danger";
    }
    if (value.includes("pending") || value.includes("process")) {
      return "admin-badge admin-badge-warn";
    }
    return "admin-badge admin-badge-info";
  };

  const stats = [
    {
      label: "Total Users",
      value: users.length,
      icon: faUsers,
      tone: "blue",
      action: () => navigate("/admin/manage-users"),
    },
    {
      label: "Total Rides",
      value: orders.length,
      icon: faRoute,
      tone: "green",
      action: () => navigate("/admin/manage-rides"),
    },
    {
      label: "Fleet Cars",
      value: cars.length,
      icon: faCarSide,
      tone: "slate",
      action: () => navigate("/admin/manage-cars"),
    },
  ];

  return (
    <div className="dashboard-container">
      <div className="admin-page-head">
        <div>
          <h2 className="dashboard-title">Operations overview</h2>
          <p className="admin-page-sub">
            Monitor bookings, customers, and fleet activity at a glance.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            className={`stat-box tone-${stat.tone}`}
            onClick={stat.action}
          >
            <div className="stat-box-top">
              <span className="stat-icon">
                <FontAwesomeIcon icon={stat.icon} />
              </span>
              <FontAwesomeIcon icon={faArrowRight} className="stat-arrow" />
            </div>
            <p className="stat-value">{loading ? "—" : stat.value}</p>
            <h4 className="stat-label">{stat.label}</h4>
          </button>
        ))}
      </div>

      <div className="latest-orders admin-card">
        <div className="latest-orders-header">
          <div>
            <h3>Latest rides</h3>
            <p>Most recent booking activity</p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={() => navigate("/admin/manage-rides")}
          >
            See all rides
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>

        {loading ? (
          <div className="dashboard-empty">
            <p>Loading recent rides…</p>
          </div>
        ) : latestOrders.length === 0 ? (
          <div className="dashboard-empty">
            <FontAwesomeIcon icon={faInbox} />
            <p>No rides found yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrap dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Ride ID</th>
                  <th>User</th>
                  <th>Car</th>
                  <th>Advance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {latestOrders.map((order, index) => (
                  <tr key={order.id || index}>
                    <td className="mono-cell">{order.id || "—"}</td>
                    <td>{order.user?.fullName || "—"}</td>
                    <td>{order.car?.name || "—"}</td>
                    <td>₹{order.advancePaid ?? "—"}</td>
                    <td>
                      <span className={statusClass(order.status)}>
                        {order.status || "Unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
