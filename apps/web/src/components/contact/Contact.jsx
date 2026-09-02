import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faLocationDot,
  faUser,
  faPen,
  faPaperPlane,
  faArrowRight,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { toast } from "react-toastify";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import { useLocalContext } from "../../context/LocalContext";
import api from "../../api/http";
import "./Contact.css";

const Contact = () => {
  const { webinfo } = useLocalContext();
  const [formData, setFormData] = useState({
    first: "",
    last: "",
    email: "",
    phone: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const phoneDisplay = webinfo?.phone || "+91 70611 12181";
  const phoneHref = webinfo?.phonecall
    ? `tel:${webinfo.phonecall}`
    : "tel:+917061112181";
  const waHref = `https://wa.me/${webinfo?.phonecall || "917061112181"}`;

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/cms/contacts", formData);
      toast.success("Message submitted successfully!");
      setFormData({
        first: "",
        last: "",
        email: "",
        phone: "",
        message: "",
      });
    } catch (err) {
      console.error("Contact Submit Error:", err.message);
      toast.error("Failed to submit message. Try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="contact-wrapper">
      <div className="contact-bg-blob" aria-hidden="true" />
      <div className="contact-dots" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>

      <div className="contact-plane" aria-hidden="true">
        <FontAwesomeIcon icon={faPaperPlane} />
        <svg className="contact-plane-trail" viewBox="0 0 120 80" fill="none">
          <path
            d="M8 72C28 58 42 48 58 36C74 24 92 14 112 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div className="contact-grid">
        <AnimateOnScroll className="contact-info-box delay-2">
          <span className="contact-badge">Get in touch</span>
          <h2>
            Contact Us
            <span className="contact-title-rule" aria-hidden="true" />
          </h2>
          <p className="contact-intro">
            Feel free to use the form or drop us an email. Old-fashioned phone
            calls work too.
          </p>

          <ul className="contact-info-list">
            <li>
              <span className="contact-info-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faPhone} />
              </span>
              <div>
                <strong>Phone</strong>
                <a href={phoneHref}>{phoneDisplay}</a>
              </div>
            </li>
            <li>
              <span className="contact-info-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faEnvelope} />
              </span>
              <div>
                <strong>Email</strong>
                <a href="mailto:Dreamdrive1818@gmail.com">
                  Dreamdrive1818@gmail.com
                </a>
              </div>
            </li>
            <li>
              <span className="contact-info-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faLocationDot} />
              </span>
              <div>
                <strong>Address</strong>
                <span>Ranchi, Jharkhand, Pin - 834001</span>
              </div>
            </li>
          </ul>

          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-wa-card"
          >
            <span className="contact-wa-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faWhatsapp} />
            </span>
            <span className="contact-wa-copy">
              Prefer quick chat?
              <em>Chat with us on WhatsApp</em>
            </span>
            <span className="contact-wa-arrow" aria-hidden="true">
              <FontAwesomeIcon icon={faArrowRight} />
            </span>
          </a>
        </AnimateOnScroll>

        <AnimateOnScroll className="contact-form-panel delay-3">
          <form className="contact-form-box" onSubmit={handleSubmit} noValidate>
            <div className="name-fields">
              <label className="contact-field">
                <FontAwesomeIcon icon={faUser} aria-hidden="true" />
                <input
                  type="text"
                  name="first"
                  placeholder="First Name"
                  value={formData.first}
                  onChange={handleChange}
                  required
                  autoComplete="given-name"
                />
              </label>
              <label className="contact-field">
                <FontAwesomeIcon icon={faUser} aria-hidden="true" />
                <input
                  type="text"
                  name="last"
                  placeholder="Last Name"
                  value={formData.last}
                  onChange={handleChange}
                  required
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className="contact-field">
              <FontAwesomeIcon icon={faEnvelope} aria-hidden="true" />
              <input
                type="email"
                name="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </label>

            <label className="contact-field">
              <FontAwesomeIcon icon={faPhone} aria-hidden="true" />
              <input
                type="tel"
                name="phone"
                placeholder="Phone (optional)"
                value={formData.phone}
                onChange={handleChange}
                autoComplete="tel"
              />
            </label>

            <label className="contact-field contact-field--area">
              <FontAwesomeIcon icon={faPen} aria-hidden="true" />
              <textarea
                name="message"
                placeholder="Type your message..."
                rows="5"
                value={formData.message}
                onChange={handleChange}
                required
              />
            </label>

            <button
              type="submit"
              className="submit-btn"
              disabled={submitting}
            >
              <FontAwesomeIcon icon={faPaperPlane} aria-hidden="true" />
              {submitting ? "Sending…" : "Submit Message"}
            </button>
          </form>
        </AnimateOnScroll>
      </div>

      <div className="map-container">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d925.1829202262528!2d85.34634826958784!3d23.367233098683375!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f4e180305de8db%3A0x8cc1b7f92cd87634!2sDream%20Drive%20Self%20Drive%20Car%20Rental%20Ranchi!5e1!3m2!1sen!2sin!4v1751471918474!5m2!1sen!2sin"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="DreamDrive Office Location"
        />
      </div>
    </section>
  );
};

export default Contact;
