import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Header.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faShoppingCart,
  faSearch,
  faBars,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalContext } from "../../context/LocalContext";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

const Header = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const cartItemCount = 2; 
  const [isScrolled, setIsScrolled] = useState(false);
  const { handleNavigation, webinfo} = useLocalContext();

  const phoneNumber = webinfo.phonecall;


useEffect(() => {
  const handleScroll = () => {
    setIsScrolled(window.scrollY > 10);
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);


  const handleRoute = (route) => {
    navigate(route);
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <header className={`matoa-header ${isScrolled ? "scrolled" : ""}`}>
  <div className="header-inner">
    {/* Logo */}
    <div className="logo" onClick={() => navigate("/")}>
      {/* <h2>DRIVOXE.</h2> */}
      <img src={`${webinfo.logo}`} alt="" />
    </div>

    {/* Hamburger (Mobile Only) */}
    <div className="hamburger" onClick={() => setIsMobileMenuOpen(true)}>
      <FontAwesomeIcon icon={faBars} />
    </div>

    {/* Center Navigation (Desktop Only) */}
    <nav className="nav-links">
      <p onClick={() => handleRoute("/cars")}>Cars</p>
       <p onClick={() => handleRoute("/order-tracking")}>Track Your Order</p>
        <p onClick={() => handleRoute("/testimonials")}>Testimonials</p>
        <p onClick={() => handleRoute("/howitworks")}>How It Works</p>
      <p onClick={() => handleRoute("/blogs")}>Blogs</p>
    </nav>

    {/* Right Actions */}
    <div className="header-actions">
      <button className="contact-btn" onClick={() => handleRoute("/contact")}>
        Contact
      </button>
      <span>|</span>
     <button className="signup-btn">
  <a
    href={`https://wa.me/${phoneNumber}`}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Chat on WhatsApp"
    className="whatsapp-button"
  >
    <FontAwesomeIcon icon={faWhatsapp} className="whatsapp-icon" />
    <span>Chat on WhatsApp</span>
  </a>
</button>

    </div>
  </div>

  {/* Mobile Menu */}
 {/* Mobile Menu */}
{isMobileMenuOpen && (
  <div className="mobile-nav-modern-overlay">
    <div className="mobile-nav-modern-container">
      <button className="mobile-modern-close" onClick={() => setIsMobileMenuOpen(false)}>
        &times;
      </button>
      <div className="mobile-modern-links">
      <p onClick={() => handleRoute("/howitworks")}>How It Works</p>
      
      <p onClick={() => handleRoute("/cars")}>Cars</p>
       <p onClick={() => handleRoute("/order-tracking")}>Track Your Order</p>
      <p onClick={() => handleRoute("/about")}>About Us</p>
        <p onClick={() => handleRoute("/booking-form")}>Book Now</p>
      </div>
    </div>
  </div>
)}

</header>
  );
};

export default Header;
