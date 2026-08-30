import React from "react";
import "./WhatsAppPopup.css";

const WhatsAppPopup = () => {
  const phoneNumber = "919999999999"; // Replace with your number

  return (
    <div className="whatsapp-popup">
      <a
        href={`https://wa.me/${phoneNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-button"
        aria-label="Chat on WhatsApp"
      >
        <img
          src="https://res.cloudinary.com/dcrfks1tq/image/upload/v1750415914/1022px-WhatsApp.svg_c4u0ss.png"
          alt="WhatsApp"
        />
      </a>
    </div>
  );
};

export default WhatsAppPopup;
