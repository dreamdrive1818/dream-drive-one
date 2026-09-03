import React from "react";
import "./Footer.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import { useLocalContext } from "../../context/LocalContext";
import { useNavigate } from "react-router-dom";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";

library.add(fab, faArrowUp);

const Footer = () => {
  const { webinfo, promoBanner } = useLocalContext();
  const navigate = useNavigate();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-left">
          <h2>Don’t Miss a Thing</h2>
          <p>{promoBanner?.body || "Get trip offers and updates first."}</p>
          <div className="newsletter">
            <input
              type="email"
              placeholder="Enter email address for newsletter ..."
            />
            <button>
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="footer-right">
          <div className="footer-column">
            <h4>Quick Link</h4>
            <p onClick={() => navigate("/about")}>Who we are</p>
            <p onClick={() => navigate("/cars")}>Pick a car</p>
              <p onClick={() => navigate("/testimonials")}>Testimonials</p>
            <p onClick={() => navigate("/contact")}>Contact Us</p>
          </div>
          <div className="footer-column">
            <h4>Legal</h4>
            <p onClick={() => navigate("/howitworks")}>How it works</p>
            <p onClick={() => navigate("/termsandconditions")}>Terms And Conditions</p>
            <p onClick={() => navigate("/legal/privacy")}>Privacy Policy</p>
            <p onClick={() => navigate("/faq")}>FAQs</p>
          </div>
          <div className="footer-column">
            <h4>Social Media</h4>
            <div className="social-icons">
              <a href="https://facebook.com" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={['fab', 'facebook-f']} />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={['fab', 'instagram']} />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer">
                <FontAwesomeIcon icon={['fab', 'twitter']} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>Copyright © 2025 {webinfo.name}. All rights reserved.</p>
        <div className="scroll-up" onClick={scrollToTop}>
          <FontAwesomeIcon icon={faArrowUp} />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
