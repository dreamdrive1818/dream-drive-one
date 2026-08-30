import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGaugeHigh,
  faCarSide,
  faUsers,
  faRoute,
  faStar,
  faFolderOpen,
  faEnvelope,
  faNewspaper,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import "./Nav.css";

const Nav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const sections = [
    {
      label: "Overview",
      items: [{ name: "Dashboard", path: "/admin/dashboard", icon: faGaugeHigh }],
    },
    {
      label: "Operations",
      items: [
        { name: "Cars", path: "/admin/manage-cars", icon: faCarSide },
        { name: "Rides", path: "/admin/manage-rides", icon: faRoute },
        { name: "Users", path: "/admin/manage-users", icon: faUsers },
        { name: "Form Entries", path: "/admin/manage-form-entries", icon: faFolderOpen },
      ],
    },
    {
      label: "Engagement",
      items: [
        { name: "Messages", path: "/admin/manage-contacts", icon: faEnvelope },
        { name: "Testimonials", path: "/admin/manage-testimonials", icon: faStar },
        { name: "Blogs", path: "/admin/blog", icon: faNewspaper },
      ],
    },
  ];

  const isActive = (path) => {
    if (path === "/admin/blog") {
      return location.pathname.startsWith("/admin/blog");
    }
    return location.pathname === path;
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <img
          src="https://res.cloudinary.com/dcf3mojai/image/upload/v1745574199/dream_drive-removebg-preview_x7duqr.png"
          alt="Dream Drive"
          className="admin-sidebar-logo"
        />
        <div className="admin-sidebar-brand-text">
          <span className="admin-sidebar-brand-name">Dream Drive</span>
          <span className="admin-sidebar-brand-sub">Control Panel</span>
        </div>
      </div>

      <nav className="admin-sidebar-nav" aria-label="Admin">
        {sections.map((section) => (
          <div key={section.label} className="admin-nav-section">
            <p className="admin-nav-section-label">{section.label}</p>
            <ul className="admin-nav-list">
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <li key={item.path} className={`admin-nav-item ${active ? "active" : ""}`}>
                    <button
                      type="button"
                      onClick={() => navigate(item.path)}
                      className="admin-nav-link"
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="admin-nav-icon-wrap">
                        <FontAwesomeIcon icon={item.icon} className="admin-nav-icon" />
                      </span>
                      <span className="admin-nav-label">{item.name}</span>
                      {active && (
                        <FontAwesomeIcon icon={faChevronRight} className="admin-nav-chevron" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="admin-sidebar-footer">
        <p>Secure admin access</p>
        <span>Dream Drive © {new Date().getFullYear()}</span>
      </div>
    </aside>
  );
};

export default Nav;
