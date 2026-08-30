import React, { useState } from "react";
import "./Contact.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMapMarkerAlt, faPhoneAlt, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { toast } from "react-toastify";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";
import { useLocalContext } from "../../context/LocalContext";
import api from "../../api/http";

const Contact = () => {
  const { webinfo } = useLocalContext();
  const [formData, setFormData] = useState({
    first: "",
    last: "",
    email: "",
    phone: "",
    message: ""
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await api.post("/api/cms/contacts", formData);

      toast.success("Message submitted successfully!");
      setFormData({
        first: "",
        last: "",
        email: "",
        phone: "",
        message: ""
      });
    } catch (err) {
      console.error("Contact Submit Error:", err.message);
      toast.error("Failed to submit message. Try again later.");
    }
  };

  return (
    <section className="contact-wrapper">
      <div className="contact-grid">
        {/* Left Column: Contact Info */}
        <AnimateOnScroll>
          <div className="contact-info-box">
            <h2>Contact Us</h2>
            <p>
              Feel free to use the form or drop us an email. Old-fashioned phone calls work too.
            </p>

            <ul className="contact-info-list">
              <li>
                <FontAwesomeIcon icon={faPhoneAlt} /> <span>{webinfo.phone}</span>
              </li>
              <li>
                <FontAwesomeIcon icon={faEnvelope} />{" "}
                <span>Dreamdrive1818@gmail.com</span>
              </li>
              <li>
                <FontAwesomeIcon icon={faMapMarkerAlt} />{" "}
                <span>Ranchi, Jharkhand, Pin - 834001</span>
              </li>
            </ul>

            <a
              href={`https://wa.me/${webinfo.phonecall}`}
              target="_blank"
              rel="noopener noreferrer"
              className="whatsapp-enquiry-btn"
            >
              <FontAwesomeIcon icon={faWhatsapp} /> Chat on WhatsApp
            </a>

           
          </div>
        </AnimateOnScroll>

        {/* Right Column: Contact Form */}
        <form className="contact-form-box fade-in-bottom" onSubmit={handleSubmit}>
          <div className="name-fields">
            <input
              type="text"
              name="first"
              placeholder="First"
              value={formData.first}
              onChange={handleChange}
              required
            />
            <input
              type="text"
              name="last"
              placeholder="Last"
              value={formData.last}
              onChange={handleChange}
              required
            />
          </div>
          <input
            type="email"
            name="email"
            placeholder="example@email.com"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone (optional)"
            value={formData.phone}
            onChange={handleChange}
          />
          <textarea
            name="message"
            placeholder="Type your message..."
            rows="5"
            value={formData.message}
            onChange={handleChange}
            required
          />
          <button type="submit" className="submit-btn">
            Submit
          </button>
        </form>
      </div>
       {/* Map embed */}
           <div className="map-container">
  <iframe
    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d925.1829202262528!2d85.34634826958784!3d23.367233098683375!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39f4e180305de8db%3A0x8cc1b7f92cd87634!2sDream%20Drive%20Self%20Drive%20Car%20Rental%20Ranchi!5e1!3m2!1sen!2sin!4v1751471918474!5m2!1sen!2sin"
    allowFullScreen
    loading="lazy"
    referrerPolicy="no-referrer-when-downgrade"
    title="DreamDrive Office Location"
  ></iframe>
  
</div>
    </section>
  );
};

export default Contact;
