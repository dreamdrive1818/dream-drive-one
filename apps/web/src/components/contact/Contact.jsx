import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faLocationDot,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { toast } from "react-toastify";
import { useLocalContext } from "../../context/LocalContext";
import api from "../../api/http";
import { trackWhatsApp } from "../../utils/trackLead";
import "./Contact.css";

const Contact = () => {
  const { webinfo } = useLocalContext();
  const [formData, setFormData] = useState({
    first: "",
    last: "",
    email: "",
    phone: "",
    city: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const phoneDisplay = webinfo?.phone || "+91 70611 12181";
  const phoneHref = webinfo?.phonecall
    ? `tel:${webinfo.phonecall}`
    : "tel:+917061112181";
  const waHref = `https://wa.me/${webinfo?.phonecall || "917061112181"}`;
  const email = webinfo?.email || "Dreamdrive1818@gmail.com";
  const address = webinfo?.address || "Ranchi, Jharkhand, Pin - 834001";

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email.trim() && !formData.phone.trim()) {
      toast.error("Email or phone is required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/v1/public/contact", {
        first: formData.first,
        last: formData.last,
        name: `${formData.first} ${formData.last}`.trim(),
        email: formData.email,
        phone: formData.phone,
        city: formData.city,
        message: formData.message,
      });
      toast.success("Message submitted successfully!");
      setFormData({
        first: "",
        last: "",
        email: "",
        phone: "",
        city: "",
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
    <section className="dd-contact" aria-label="Contact us">
      <div className="dd-contact-shell">
        <header className="dd-contact-header">
          <p className="dd-contact-kicker">Get in touch</p>
          <h2 className="dd-contact-title">Talk to Dream Drive</h2>
          <p className="dd-contact-lead">
            Questions about cars, dates, or pickup in Ranchi? Reach out — we
            usually reply the same day.
          </p>
        </header>

        <div className="dd-contact-panel">
          <aside className="dd-contact-aside">
            <div className="dd-contact-aside-bg" aria-hidden="true" />
            <div className="dd-contact-aside-body">
              <p className="dd-contact-aside-label">Direct lines</p>

              <a className="dd-contact-row" href={phoneHref}>
                <FontAwesomeIcon icon={faPhone} />
                <span>
                  <strong>Call</strong>
                  <em>{phoneDisplay}</em>
                </span>
              </a>

              <a className="dd-contact-row" href={`mailto:${email}`}>
                <FontAwesomeIcon icon={faEnvelope} />
                <span>
                  <strong>Email</strong>
                  <em>{email}</em>
                </span>
              </a>

              <div className="dd-contact-row dd-contact-row--static">
                <FontAwesomeIcon icon={faLocationDot} />
                <span>
                  <strong>Visit</strong>
                  <em>{address}</em>
                </span>
              </div>

              <a
                className="dd-contact-wa"
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsApp()}
              >
                <FontAwesomeIcon icon={faWhatsapp} />
                WhatsApp us
              </a>
            </div>
          </aside>

          <form className="dd-contact-form" onSubmit={handleSubmit} noValidate>
            <div className="dd-contact-form-top">
              <h3>Send a message</h3>
              <p>Share email or phone so we can get back to you.</p>
            </div>

            <div className="dd-contact-fields">
              <label>
                <span>First name</span>
                <input
                  type="text"
                  name="first"
                  value={formData.first}
                  onChange={handleChange}
                  required
                  autoComplete="given-name"
                />
              </label>
              <label>
                <span>Last name</span>
                <input
                  type="text"
                  name="last"
                  value={formData.last}
                  onChange={handleChange}
                  required
                  autoComplete="family-name"
                />
              </label>
              <label className="dd-contact-span">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </label>
              <label>
                <span>Phone</span>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                />
              </label>
              <label>
                <span>City</span>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  autoComplete="address-level2"
                />
              </label>
              <label className="dd-contact-span">
                <span>Message</span>
                <textarea
                  name="message"
                  rows="5"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  placeholder="Tell us what you need…"
                />
              </label>
            </div>

            <button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Submit message"}
              <FontAwesomeIcon icon={faPaperPlane} />
            </button>
          </form>
        </div>

        <div className="dd-contact-map">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d925.1829202262528!2d85.34634826958784!3d23.367233098683375!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f4e180305de8db%3A0x8cc1b7f92cd87634!2sDream%20Drive%20Self%20Drive%20Car%20Rental%20Ranchi!5e1!3m2!1sen!2sin!4v1751471918474!5m2!1sen!2sin"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Dream Drive office location"
          />
        </div>
      </div>
    </section>
  );
};

export default Contact;
