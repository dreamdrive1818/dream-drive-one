import React, { useState } from "react";
import "./Order.css";
import OrderModal from "./OrderModal/OrderModal";
import { useOrderContext } from "../../context/OrderContext";

const Order = () => {
  const { selectedCar } = useOrderContext();
  const car = selectedCar;
  const [showModal, setShowModal] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  if (!car) return <div className="order-error">No car selected.</div>;

  const handlePrev = () => {
    setCarouselIndex((prev) =>
      prev === 0 ? (car.images?.length || 1) - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCarouselIndex((prev) => (prev + 1) % (car.images?.length || 1));
  };

  return (
    <>
      <section className="order-section">
        <div className="order-header">
          <h1>Review Your Booking</h1>
          <p>Carefully review your selection before proceeding.</p>
        </div>

        <div className="order-body">
          <div className="order-image-panel">
            <div className="carousel-wrapper">
              <button className="nav-btn left" onClick={handlePrev}>
                &#10094;
              </button>
              <img
                src={car.images?.[carouselIndex] || car.image}
                alt="Selected Car"
                className="carousel-main"
              />
              <button className="nav-btn right" onClick={handleNext}>
                &#10095;
              </button>
            </div>
            <div className="thumbnail-strip">
              {car.images?.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt="thumb"
                  onClick={() => setCarouselIndex(i)}
                  className={`thumb ${i === carouselIndex ? "active" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="order-info-panel">
            <h2 className="car-title">{car.name}</h2>

            <div className="car-specs">
              {[
                ["Type", car.details.type],
                ["Seats", car.details.seats],
                ["Luggage", `${car.details.luggage} Bags`],
                ["Fuel", car.details.fuel],
                ["Transmission", car.details.mt === "YES" ? "Manual" : "Automatic"],
                // ["Free KM", car.details.kilometer],
                // ["Extra KM", `₹${car.details.extraKm}`],
                // ["Extra Hour", `₹${car.details.extraHr}`],
              ].map(([label, value], index) => (
                <div key={index} className="spec-item">
                  <span className="label">{label}</span>
                  <span className="value">{value}</span>
                </div>
              ))}
            </div>

            <div className="price-details">
              <h3>Rental Charges</h3>
              <div className="price-grid">
                <div className="price-box">
                  <div className="price-label">12 Hr (Weekday)</div>
                  <div className="price-value">₹{car.twelveHrWeekday}</div>
                </div>
                <div className="price-box">
                  <div className="price-label">24 Hr (Weekday)</div>
                  <div className="price-value">₹{car.twentyFourHrWeekday}</div>
                </div>
                <div className="price-box">
                  <div className="price-label">24 Hr (Weekend)</div>
                  <div className="price-value">₹{car.twentyFourHrWeekend}</div>
                </div>
                <div className="price-box">
                  <div className="price-label">Security Deposit</div>
                  <div className="price-value">₹{car.securityDeposit}</div>
                </div>
                <div className="price-box">
                  <div className="price-label">Extra Hour</div>
                  <div className="price-value">₹{car.details.extraHr}</div>
                </div>
              </div>
            </div>

            <button className="confirm-btn" onClick={() => setShowModal(true)}>
              Confirm & Proceed
            </button>
          </div>
        </div>
      </section>

      {showModal && <OrderModal closeModal={() => setShowModal(false)} />}
    </>
  );
};

export default Order;
