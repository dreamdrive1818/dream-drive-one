import React, { useState, useEffect } from "react";
import "./ContactPopup.css";
import { useLocalContext } from "../../context/LocalContext";
import { toast } from "react-toastify";
import { faComments } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import api from "../../api/http";
import { trackWhatsApp } from "../../utils/trackLead";

const ContactPopup = () => {
  const [visible, setVisible] = useState(false);
  const [toggleButtonVisible, setToggleButtonVisible] = useState(false);
  const { webinfo } = useLocalContext();
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  useEffect(() => {
    setTimeout(() => setVisible(true), 1000);
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/v1/public/contact", {
        name: formData.name,
        email: formData.email,
        message: formData.message,
        source: "contact_popup",
      });
      toast.success("Message submitted successfully!");
      setFormData({ name: "", email: "", message: "" });
      setVisible(false);
      setToggleButtonVisible(true);
    } catch (err) {
      toast.error("Failed to submit message. Please try again later.");
    }
  };

  return (
    <>
      <div className={`contact-popup ${visible ? "show" : ""}`}>
        <button className="close-btn" onClick={() => { setVisible(false); setToggleButtonVisible(true); }}>×</button>
        <h4>Get in Touch</h4>
        <p>Reach us on WhatsApp or drop a message:</p>
        <a
          className="whatsapp-button"
          href={`https://wa.me/${webinfo.phonecall}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsApp(webinfo.phonecall)}
        >
          Chat on WhatsApp
        </a>
        <form className="popup-form" onSubmit={handleSubmit}>
          <input type="text" name="name" placeholder="Your name" value={formData.name} onChange={handleChange} required />
          <input type="email" name="email" placeholder="Your email" value={formData.email} onChange={handleChange} required />
          <textarea name="message" placeholder="Your message" rows="3" value={formData.message} onChange={handleChange} required />
          <button type="submit">Send</button>
        </form>
      </div>
      {toggleButtonVisible && (
        <button className="reopen-btn" onClick={() => { setVisible(true); setToggleButtonVisible(false); }} aria-label="Open contact popup">
          <FontAwesomeIcon icon={faComments} size="3x" />
        </button>
      )}
    </>
  );
};

export default ContactPopup;
