import React from "react";
import "./Numberattach.css";
import { FaPhoneAlt } from "react-icons/fa";
import { useLocalContext } from "../../context/LocalContext";
import { trackCall } from "../../utils/trackLead";

const Numberattach = () => {
  const { webinfo } = useLocalContext();

  return (
    <div className="number-float">
      <a href={`tel:${webinfo.phonecall}`} onClick={() => trackCall(webinfo.phonecall)}>
        <FaPhoneAlt className="icon" /> Call Now {webinfo.phone}
      </a>
    </div>
  );
};

export default Numberattach;
