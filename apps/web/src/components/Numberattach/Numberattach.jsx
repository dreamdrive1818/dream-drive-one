// src/components/Numberattach.jsx
import React from "react";
import "./Numberattach.css";
import { FaPhoneAlt,FaHeadset } from "react-icons/fa";
import { useLocalContext } from "../../context/LocalContext";

const Numberattach = () => {

    const {webinfo} = useLocalContext();

  return (
    <div className="number-float">
      <a href={`tel:${webinfo.phonecall}`}>
        <FaPhoneAlt className="icon" /> Call Now {webinfo.phone}
      </a>
    </div>
  );
};

export default Numberattach;
