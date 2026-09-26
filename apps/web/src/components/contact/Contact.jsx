import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPhone,
  faEnvelope,
  faLocationDot,
  faPaperPlane,
  faArrowRight,
  faDiamondTurnRight,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { toast } from "react-toastify";
import { useLocalContext } from "../../context/LocalContext";
import api from "../../api/http";
import { trackWhatsApp } from "../../utils/trackLead";
import "./Contact.css";

const MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d925.1829202262528!2d85.34634826958784!3d23.367233098683375!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f4e180305de8db%3A0x8cc1b7f92cd87634!2sDream%20Drive%20Self%20Drive%20Car%20Rental%20Ranchi!5e1!3m2!1sen!2sin!4v1751471918474!5m2!1sen!2sin";
const MAP_DIRECTIONS =
  "https://www.google.com/maps/search/?api=1&query=Dream%20Drive%20Self%20Drive%20Car%20Rental%20Ranchi";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (y, delay = 0) => ({
  hidden: { opacity: 0, y },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
});

const eyebrowIn = fadeUp(8, 0.05);
const titleIn = fadeUp(16, 0.12);
const leadIn = fadeUp(10, 0.2);
const cardIn = fadeUp(24, 0.24);

const methodsIn = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.42 } },
};
const methodIn = fadeUp(12);

const Contact = () => {
  const { webinfo } = useLocalContext();
  const reduceMotion = useReducedMotion();
  const [formData, setFormData] = useState({
    first: "",
    last: "",
    email: "",
    phone: "",
    city: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const phoneDisplay = webinfo?.phone?.trim() || "+91 70611 12181";
  const phoneDigits = String(webinfo?.phonecall || "917061112181").replace(
    /\D/g,
    ""
  );
  const phoneHref = `tel:+${phoneDigits}`;
  const waHref = `https://wa.me/${phoneDigits}`;
  const email = webinfo?.email || "Dreamdrive1818@gmail.com";
  const address = webinfo?.address || "Ranchi, Jharkhand, Pin - 834001";

  const methods = [
    {
      key: "call",
      icon: faPhone,
      label: "Call us",
      value: phoneDisplay,
      href: phoneHref,
    },
    {
      key: "whatsapp",
      icon: faWhatsapp,
      label: "WhatsApp",
      value: "Chat with our team",
      href: waHref,
      external: true,
      onClick: () => trackWhatsApp(),
    },
    {
      key: "email",
      icon: faEnvelope,
      label: "Email",
      value: email,
      href: `mailto:${email}`,
    },
  ];

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

  const reveal = reduceMotion
    ? { initial: "show", animate: "show" }
    : {
        initial: "hidden",
        whileInView: "show",
        viewport: { once: true, amount: 0.15 },
      };

  return (
    <motion.section
      className="dd-contact"
      aria-labelledby="dd-contact-title"
      {...reveal}
    >
      <div className="dd-contact-shell">
        <header className="dd-contact-head">
          <motion.p className="dd-contact-eyebrow" variants={eyebrowIn}>
            Get in touch
          </motion.p>
          <motion.h2
            id="dd-contact-title"
            className="dd-contact-title"
            variants={titleIn}
          >
            Talk to
            <span>Dream Drive</span>
          </motion.h2>
          <motion.p className="dd-contact-lead" variants={leadIn}>
            Questions about cars, dates, or pickup in Ranchi? Call, WhatsApp,
            or send us a message.
          </motion.p>
        </header>

        <motion.div className="dd-contact-card" variants={cardIn}>
          <aside className="dd-contact-info" aria-label="Contact details">
            <h3 className="dd-contact-info-title">Reach us directly</h3>

            <motion.ul className="dd-contact-methods" variants={methodsIn}>
              {methods.map((m) => (
                <motion.li key={m.key} variants={methodIn}>
                  <a
                    className={`dd-contact-method dd-contact-method--${m.key}`}
                    href={m.href}
                    {...(m.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    onClick={m.onClick}
                  >
                    <span className="dd-contact-method-icon" aria-hidden="true">
                      <FontAwesomeIcon icon={m.icon} />
                    </span>
                    <span className="dd-contact-method-text">
                      <span className="dd-contact-method-label">{m.label}</span>
                      <span className="dd-contact-method-value">{m.value}</span>
                    </span>
                    <span className="dd-contact-method-arrow" aria-hidden="true">
                      <FontAwesomeIcon icon={faArrowRight} />
                    </span>
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <div className="dd-contact-visit">
              <span className="dd-contact-visit-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faLocationDot} />
              </span>
              <div className="dd-contact-visit-text">
                <p className="dd-contact-visit-label">Visit us</p>
                <p className="dd-contact-visit-address">{address}</p>
                <a
                  className="dd-contact-visit-link"
                  href={MAP_DIRECTIONS}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FontAwesomeIcon icon={faDiamondTurnRight} />
                  Get directions
                </a>
              </div>
            </div>

            <div className="dd-contact-map">
              <iframe
                src={MAP_EMBED}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Dream Drive office location"
              />
            </div>
          </aside>

          <form className="dd-contact-form" onSubmit={handleSubmit} noValidate>
            <div className="dd-contact-form-top">
              <h3>Send a message</h3>
              <p>Share your email or phone so we can get back to you.</p>
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
              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="email"
                  placeholder="you@example.com"
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
                  placeholder="+91"
                />
              </label>
              <label className="dd-contact-span">
                <span>
                  City <em>(optional)</em>
                </span>
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
                  placeholder="Tell us which car, dates, or pickup you have in mind…"
                />
              </label>
            </div>

            <div className="dd-contact-form-foot">
              <p className="dd-contact-form-note">
                Email or phone is required.
              </p>
              <button
                type="submit"
                className="dd-contact-submit"
                disabled={submitting}
              >
                {submitting ? "Sending…" : "Send message"}
                <FontAwesomeIcon icon={faPaperPlane} />
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default Contact;
