import React from "react";
import "./SantaFab.css";

export default function SantaFab({
  onClick,
  title = "Open offer",
}) {
  return (
    <button
      type="button"
      className="santa-fab"
      onClick={onClick}
      aria-label={title}
      title={title}
    >
      <img
        src="https://res.cloudinary.com/df10iqj1i/image/upload/v1766477563/christmas-santa-claus-png_tyumk6.png"
        alt=""
        className="santa-fab__img"
        draggable="false"
      />
    </button>
  );
}
