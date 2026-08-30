import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAdminContext } from "../../context/AdminContext";
import "./SaleModal.css";

const SESSION_KEY = "dreamdrive_sale_modal_dismissed";

const hasDiscount = (car) => {
  const sale = Number(car?.salePrice);
  const price = Number(car?.price);
  return Number.isFinite(sale) && Number.isFinite(price) && sale > price;
};

const discountPct = (car) => {
  const sale = Number(car.salePrice);
  const price = Number(car.price);
  return Math.round(((sale - price) / sale) * 100);
};

const SaleModal = () => {
  const [open, setOpen] = useState(false);
  const [dealCars, setDealCars] = useState([]);
  const { fetchCars } = useAdminContext();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = location.pathname.includes("admin");

  useEffect(() => {
    if (isAdmin) return;
    if (sessionStorage.getItem(SESSION_KEY) === "1") return;

    let cancelled = false;
    let openTimer;

    const load = async () => {
      try {
        const cars = await fetchCars();
        if (cancelled) return;
        const discounted = cars
          .filter(hasDiscount)
          .sort((a, b) => discountPct(b) - discountPct(a))
          .slice(0, 3);
        setDealCars(discounted);
      } catch {
        // still show modal with fallback copy
      } finally {
        if (!cancelled) {
          openTimer = setTimeout(() => setOpen(true), 900);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
      clearTimeout(openTimer);
    };
  }, [fetchCars, isAdmin]);

  const topOffer = useMemo(() => {
    if (!dealCars.length) return 15;
    return Math.max(...dealCars.map(discountPct));
  }, [dealCars]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setOpen(false);
  };

  const handleCta = () => {
    dismiss();
    navigate("/cars");
  };

  if (isAdmin || !open) return null;

  return (
    <div className="sale-modal-overlay" onClick={dismiss} role="presentation">
      <div
        className="sale-modal sale-modal--monsoon"
        role="dialog"
        aria-modal="true"
        aria-label="Monsoon sale offer"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sale-modal__glow" aria-hidden="true" />
        <div className="monsoon-rain sale-modal__rain" aria-hidden="true">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        <button
          type="button"
          className="sale-modal__close"
          onClick={dismiss}
          aria-label="Close sale offer"
        >
          ✕
        </button>

        <div className="sale-modal__badge">Monsoon Special</div>

        <p className="sale-modal__eyebrow">Dream Drive · Ranchi</p>
        <h2 className="sale-modal__title">
          Monsoon
          <span>Sale</span>
        </h2>
        <p className="sale-modal__lead">
          Rain-ready self-drive deals — save up to{" "}
          <strong>{topOffer}% OFF</strong> on selected cars.
        </p>

        {dealCars.length > 0 ? (
          <ul className="sale-modal__deals">
            {dealCars.map((car) => (
              <li key={car.id} className="sale-modal__deal">
                <div className="sale-modal__deal-info">
                  <span className="sale-modal__deal-name">{car.name}</span>
                  <span className="sale-modal__deal-prices">
                    <s>₹{car.salePrice}</s>
                    <strong>₹{car.price}</strong>
                  </span>
                </div>
                <span className="sale-modal__deal-tag">{discountPct(car)}% OFF</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="sale-modal__highlight">
            Flat monsoon discounts on popular self-drive cars this week.
          </div>
        )}

        <div className="sale-modal__actions">
          <button type="button" className="sale-modal__cta" onClick={handleCta}>
            View Monsoon Deals
          </button>
          <button type="button" className="sale-modal__later" onClick={dismiss}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaleModal;
