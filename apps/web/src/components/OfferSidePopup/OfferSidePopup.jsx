// OfferSidePopup.jsx
import React, { useEffect, useState } from "react";
import "./OfferSidePopup.css";
import SantaFab from "./SantaFab";

const OfferSidePopup = ({
  percent = 10,
  title = "Flat",
  subtitle = "Limited time festive deal",
  ctaText = "Book Now",
  onCta,
  theme = "christmas",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setIsOpen(true);
      setIsMinimized(false);
    }, 450);
    return () => clearTimeout(t);
  }, []);

  const closeToSnow = () => {
    setIsOpen(false);
    setIsMinimized(true);
  };

  const openPopup = () => {
    setIsMinimized(false);
    setIsOpen(true);
  };

  const handleCta = () => {
    if (typeof onCta === "function") return onCta();
  };

  return (
    <>
      <aside
        className={[
          "offer-pop",
          `offer-pop--${theme}`,
          isOpen ? "offer-pop--open" : "offer-pop--closed",
        ].join(" ")}
        role="dialog"
        aria-modal="false"
        aria-label="Offer popup"
      >
        {/* Festive decor (CSS only) */}
        <div className="offer-pop__snow" aria-hidden="true" />
        <div className="offer-pop__tree" aria-hidden="true">
          <span className="offer-pop__treeStar" />
          <span className="offer-pop__treeBody" />
          <span className="offer-pop__treeTrunk" />
        </div>

        <img
  className="offer-pop__santaImg"
  src="https://res.cloudinary.com/df10iqj1i/image/upload/v1766477563/christmas-santa-claus-png_tyumk6.png"
  alt=""
  draggable="false"
/>


        <button
          className="offer-pop__close"
          type="button"
          onClick={closeToSnow}
          aria-label="Close offer"
        >
          ✕
        </button>

        <div className="offer-pop__badge">
          <span className="offer-pop__badgeIcon" aria-hidden="true">
            🎁
          </span>
          <span className="offer-pop__badgeText">Christmas Deal</span>
        </div>

        <h3 className="offer-pop__title">
          {title} <span className="offer-pop__percent">{percent}% OFF</span>
        </h3>

        <p className="offer-pop__subtitle">{subtitle}</p>

        <div className="offer-pop__divider" />

        <ul className="offer-pop__points">
          <li>Instant booking support</li>
          <li>Rent or Self Drive</li>
          <li>Limited slots today</li>
        </ul>

        <div className="offer-pop__actions">
          <button className="offer-pop__cta" type="button" onClick={handleCta}>
            {ctaText}
          </button>
          <button className="offer-pop__ghost" type="button" onClick={closeToSnow}>
            Later
          </button>
        </div>
      </aside>
      {isMinimized && <SantaFab onClick={openPopup} />}


      {/* {isMinimized && (
        <button
          className={["snow-fab", `snow-fab--${theme}`].join(" ")}
          type="button"
          onClick={openPopup}
          aria-label="Open offer"
          title="Open offer"
        >
          🎅
        </button>
      )} */}
    </>
  );
};

export default OfferSidePopup;
