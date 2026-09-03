import React from "react";
import "./WhatsAppPopup.css";
import { useLocalContext } from "../../context/LocalContext";
import { trackWhatsApp } from "../../utils/trackLead";

const WhatsAppPopup = () => {
  const { webinfo } = useLocalContext();
  const phoneNumber = webinfo.phonecall || "919942027772";

  return (
    <div className="whatsapp-popup">
      <a
        href={`https://wa.me/${phoneNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-button"
        aria-label="Chat on WhatsApp"
        onClick={() => trackWhatsApp(phoneNumber)}
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
