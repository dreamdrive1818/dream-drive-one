import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightToBracket, faBars, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../../ms/AuthContext";
import { trackWhatsApp } from "../../utils/trackLead";

const NAV_LINKS = [
  { label: "Cars", route: "/cars" },
  { label: "Tours", route: "/packages" },
  { label: "Subscriptions", route: "/subscriptions" },
  { label: "Track order", route: "/track" },
  { label: "How it works", route: "/howitworks" },
  { label: "Blogs", route: "/blogs" },
  { label: "FAQs", route: "/faq" },
];

function userDisplayName(user) {
  const full = String(user?.fullName || user?.profile?.fullName || "").trim();
  if (full) return full;
  const email = String(user?.email || "").trim();
  if (email.includes("@")) return email.split("@")[0];
  return "Account";
}

function userInitials(name) {
  const parts = String(name)
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return String(parts[0] || "U").slice(0, 2).toUpperCase();
}

function userFirstName(name) {
  return String(name).trim().split(/\s+/)[0] || name;
}

function UserAvatar({ name, photoUrl }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(photoUrl) && !imgFailed;
  return (
    <span className="dd-header-avatar" aria-hidden="true">
      {showPhoto ? (
        <img src={photoUrl} alt="" onError={() => setImgFailed(true)} />
      ) : (
        userInitials(name)
      )}
    </span>
  );
}

const Header = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const authReady = Boolean(auth?.ready);
  const signedIn = Boolean(auth?.user);
  const displayName = signedIn ? userDisplayName(auth.user) : "";
  const firstName = signedIn ? userFirstName(displayName) : "";
  const photoUrl = auth?.user?.photoUrl || auth?.user?.avatarUrl || auth?.user?.picture || "";
  const authLabel = !authReady ? "…" : signedIn ? firstName : "Sign in";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { webinfo } = useLocalContext();
  const phoneNumber = webinfo.phonecall;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 980) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleRoute = (route) => {
    navigate(route);
    setIsMobileMenuOpen(false);
  };

  const goAuth = () => {
    if (!authReady) return;
    handleRoute(signedIn ? "/account" : "/login");
  };

  return (
    <header className={`dd-header ${isScrolled ? "dd-header--scrolled" : ""}`}>
      <div className="dd-header-inner">
        <button
          type="button"
          className="dd-header-logo"
          onClick={() => navigate("/")}
          aria-label="Dream Drive home"
        >
          <img src={`${webinfo.logo}`} alt="Dream Drive" />
        </button>

        <nav className="dd-header-nav" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <button
              key={link.route}
              type="button"
              className="dd-header-link"
              onClick={() => handleRoute(link.route)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="dd-header-actions">
          <button
            type="button"
            className="dd-header-text"
            onClick={() => handleRoute("/contact")}
          >
            Contact
          </button>
          <button
            type="button"
            className={signedIn ? "dd-header-text dd-header-account" : "dd-header-signin"}
            onClick={goAuth}
            disabled={!authReady}
            aria-busy={!authReady}
            title={signedIn ? displayName : "Sign in"}
          >
            {signedIn ? (
              <UserAvatar name={displayName} photoUrl={photoUrl} />
            ) : (
              <FontAwesomeIcon icon={faArrowRightToBracket} className="dd-header-signin-icon" />
            )}
            <span className="dd-header-account-name">{authLabel}</span>
          </button>
          <a
            href={`https://wa.me/${phoneNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            className="dd-header-wa"
            onClick={() => trackWhatsApp()}
          >
            <FontAwesomeIcon icon={faWhatsapp} />
            <span>WhatsApp</span>
          </a>
        </div>

        <button
          type="button"
          className="dd-header-menu"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <FontAwesomeIcon icon={faBars} />
        </button>
      </div>

      {isMobileMenuOpen ? createPortal(
        <div className="dd-header-drawer" role="dialog" aria-modal="true">
          <div className="dd-header-drawer-top">
            <img src={`${webinfo.logo}`} alt="" className="dd-header-drawer-logo" />
            <button
              type="button"
              className="dd-header-close"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <nav className="dd-header-drawer-nav" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <button
                key={link.route}
                type="button"
                onClick={() => handleRoute(link.route)}
              >
                {link.label}
              </button>
            ))}
            <button type="button" onClick={() => handleRoute("/about")}>
              About
            </button>
            <button type="button" onClick={() => handleRoute("/contact")}>
              Contact
            </button>
            <button
              type="button"
              className={signedIn ? "dd-header-drawer-account" : "dd-header-drawer-signin"}
              onClick={goAuth}
              disabled={!authReady}
            >
              {signedIn ? (
                <UserAvatar name={displayName} photoUrl={photoUrl} />
              ) : (
                <FontAwesomeIcon icon={faArrowRightToBracket} />
              )}
              <span>
                {signedIn ? (
                  <>
                    <strong>{displayName}</strong>
                    <em>{auth.user?.email || "Account"}</em>
                  </>
                ) : (
                  authLabel
                )}
              </span>
            </button>
          </nav>
          <a
            href={`https://wa.me/${phoneNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="dd-header-wa dd-header-wa--drawer"
            onClick={() => {
              trackWhatsApp();
              setIsMobileMenuOpen(false);
            }}
          >
            <FontAwesomeIcon icon={faWhatsapp} />
            Chat on WhatsApp
          </a>
        </div>,
        document.body
      ) : null}
    </header>
  );
};

export default Header;
