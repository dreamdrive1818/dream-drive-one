import React, { useState, useEffect } from "react";
import "./ContactPopup.css";
import { useLocalContext } from "../../context/LocalContext";
import { toast } from "react-toastify";
import { faComments, faXmark } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../../api/http";
import { trackWhatsApp } from "../../utils/trackLead";

const ContactPopup = () => {
  const [visible, setVisible] = useState(false);
  const [toggleButtonVisible, setToggleButtonVisible] = useState(false);
  const { webinfo } = useLocalContext();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    setTimeout(() => setVisible(true), 1000);
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const closePopup = () => {
    setVisible(false);
    setToggleButtonVisible(true);
  };

  const openPopup = () => {
    setVisible(true);
    setToggleButtonVisible(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const posted = new FormData(e.currentTarget);
    const name = String(posted.get("name") || formData.name || "").trim();
    const email = String(posted.get("email") || formData.email || "").trim();
    const phone = String(posted.get("phone") || formData.phone || "").trim();
    const message = String(posted.get("message") || formData.message || "").trim();
    setFormData({ name, email, phone, message });
    if (!email && !phone) {
      toast.error("Add an email or a phone number so we can reply.");
      return;
    }
    try {
      await api.post("/v1/public/contact", {
        name,
        email,
        phone,
        message,
        source: "contact_popup",
      });
      toast.success("Message submitted successfully!");
      setFormData({ name: "", email: "", phone: "", message: "" });
      closePopup();
    } catch (err) {
      const apiMessage =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to submit message. Please try again later.";
      toast.error(Array.isArray(apiMessage) ? apiMessage.join(" ") : String(apiMessage));
    }
  };

  return (
    <>
      <div
        className={`contact-popup ${visible ? "show" : ""}`}
        role="dialog"
        aria-labelledby="contact-popup-title"
        aria-hidden={!visible}
      >
        <button
          type="button"
          className="contact-popup-close"
          onClick={closePopup}
          aria-label="Close contact form"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>

        <header className="contact-popup-header">
          <h4 id="contact-popup-title">Get in touch</h4>
          <p className="contact-popup-lead">WhatsApp or leave a quick message.</p>
        </header>

        <a
          className="contact-popup-whatsapp"
          href={`https://wa.me/${webinfo.phonecall}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsApp()}
        >
          <FontAwesomeIcon icon={faWhatsapp} />
          Chat on WhatsApp
        </a>

        <div className="contact-popup-divider" aria-hidden="true">
          <span>or</span>
        </div>

        <form className="contact-popup-form" onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Your name"
            value={formData.name}
            onChange={handleChange}
            required
            autoComplete="name"
          />
          <input
            type="email"
            name="email"
            placeholder="Your email"
            value={formData.email}
            onChange={handleChange}
            autoComplete="email"
          />
          <input
            type="tel"
            name="phone"
            placeholder="Your phone"
            value={formData.phone}
            onChange={handleChange}
            autoComplete="tel"
          />
          <textarea
            name="message"
            placeholder="Your message"
            rows="2"
            value={formData.message}
            onChange={handleChange}
            required
          />
          <button type="submit">Send</button>
        </form>
      </div>

      {toggleButtonVisible && (
        <button
          type="button"
          className="contact-popup-reopen"
          onClick={openPopup}
          aria-label="Open contact form"
        >
          <FontAwesomeIcon icon={faComments} />
        </button>
      )}
    </>
  );
};

export default ContactPopup;
