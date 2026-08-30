import React, { useMemo } from "react";
import "./TopNav.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminContext } from "../../context/AdminContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRightFromBracket, faUserShield } from "@fortawesome/free-solid-svg-icons";

const PAGE_TITLES = {
  "/admin/dashboard": { title: "Dashboard", subtitle: "Operations overview" },
  "/admin/manage-cars": { title: "Fleet", subtitle: "Manage cars and pricing" },
  "/admin/manage-rides": { title: "Rides", subtitle: "Bookings and trip status" },
  "/admin/manage-users": { title: "Users", subtitle: "Customer accounts" },
  "/admin/manage-contacts": { title: "Messages", subtitle: "Contact inquiries" },
  "/admin/manage-form-entries": { title: "Form Entries", subtitle: "Submitted applications" },
  "/admin/manage-testimonials": { title: "Testimonials", subtitle: "Customer reviews" },
  "/admin/blog": { title: "Blogs", subtitle: "Content management" },
};

const TopNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, AdminLogout } = useAdminContext();

  const pageMeta = useMemo(() => {
    if (location.pathname.startsWith("/admin/blog")) {
      return PAGE_TITLES["/admin/blog"];
    }
    return (
      PAGE_TITLES[location.pathname] || {
        title: "Admin",
        subtitle: "Dream Drive control panel",
      }
    );
  }, [location.pathname]);

  const handleLogout = () => {
    AdminLogout();
    navigate("/admin/login");
  };

  const displayName =
    typeof admin === "string" && admin.includes("@")
      ? admin.split("@")[0]
      : admin || "Admin";

  const initials = String(displayName).slice(0, 2).toUpperCase();

  return (
    <header className="admin-topnav">
      <div className="admin-topnav-left">
        <div className="admin-topnav-crumb">Admin / {pageMeta.title}</div>
        <h1 className="admin-topnav-title">{pageMeta.title}</h1>
        <p className="admin-topnav-sub">{pageMeta.subtitle}</p>
      </div>

      <div className="admin-topnav-right">
        <div className="admin-topnav-user">
          <div className="admin-topnav-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="admin-topnav-user-meta">
            <span className="admin-topnav-user-name">{displayName}</span>
            <span className="admin-topnav-user-role">
              <FontAwesomeIcon icon={faUserShield} /> Administrator
            </span>
          </div>
        </div>
        <button type="button" className="admin-logout-btn" onClick={handleLogout}>
          <FontAwesomeIcon icon={faRightFromBracket} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default TopNav;
