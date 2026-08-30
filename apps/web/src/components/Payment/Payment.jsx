import React, { useEffect, useState } from "react";
import "./Payment.css";
import { toast } from "react-toastify";
import { useOrderContext } from "../../context/OrderContext";
import { useNavigate } from "react-router-dom";

const Payment = () => {
  const { order, submitOrderToFirestore, user } = useOrderContext();
  const navigate = useNavigate();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!order || !order.car) {
      toast.warning("No order found. Please select a car first.");
      navigate("/cars");
    }
  }, [order, navigate]);

  if (!order || !order.car) {
    return null;
  }

  const car = order.car;
  const images = car.images || [car.image];

  const handlePayment = async () => {
    setProcessing(true);
    await submitOrderToFirestore(navigate);
    setProcessing(false);
  };

  return (
    <section className="payment-section">
      <div className="payment-banner">
        <div className="payment-header">
          <h1 className="payment-heading">Booking Summary</h1>
          <p className="payment-description">
            <strong>No advance payment for now.</strong>
          </p>
        </div>

        <div className="car-details-flex">
          {/* Left side */}
          <div className="car-details-left">
            <img
              src={images[carouselIndex]}
              alt="Selected car"
              className="main-car-image"
            />
            <div className="thumbnail-strip">
              {images.map((img, i) => (
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

          {/* Right side */}
          <div className="car-details-right">
            <h2 className="car-details-title">{car.name}</h2>

            <div className="car-specs">
              {[
                ["Type", car.details.type],
                ["Seats", car.details.seats],
                ["Luggage", `${car.details.luggage} Bags`],
                ["Fuel", car.details.fuel],
                ["Transmission", car.details.mt === "YES" ? "Manual" : "Automatic"],
              ].map(([label, value], idx) => (
                <div key={idx} className="spec-item">
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

            <div className="booking-details">
              <h3>Booking Details</h3>
              <div className="price-grid">
                <div className="price-box">
                  <div className="price-label">Rental Type</div>
                  <div className="price-value">
                    {user?.rentalType === "self-drive" ? "Self-Drive" : "With Driver"}
                  </div>
                </div>

                {user?.rentalType === "with-driver" && (
                  <>
                    <div className="price-box">
                      <div className="price-label">Category</div>
                      <div className="price-value">
                        {user?.bookingCategory
                          ? user.bookingCategory.charAt(0).toUpperCase() +
                            user.bookingCategory.slice(1)
                          : "-"}
                      </div>
                    </div>

                    {user?.bookingCategory === "intercity" && (
                      <>
                        <div className="price-box">
                          <div className="price-label">Trip Type</div>
                          <div className="price-value">
                            {user?.tripType
                              ? user.tripType.replace("-", " ").replace(/^\w/, c => c.toUpperCase())
                              : "-"}
                          </div>
                        </div>
                        <div className="price-box">
                          <div className="price-label">Starting City</div>
                          <div className="price-value">{user?.startingCity || "-"}</div>
                        </div>
                        <div className="price-box">
                          <div className="price-label">Ending City</div>
                          <div className="price-value">{user?.endingCity || "-"}</div>
                        </div>
                      </>
                    )}

                    {user?.bookingCategory === "local" && (
                      <div className="price-box">
                        <div className="price-label">Starting City</div>
                        <div className="price-value">{user?.startingCity || "-"}</div>
                      </div>
                    )}
                  </>
                )}

                {user?.rentalType === "self-drive" && (
                  <div className="price-box">
                    <div className="price-label">Pickup Location</div>
                    <div className="price-value">{user?.pickupLocation || "-"}</div>
                  </div>
                )}

                <div className="price-box">
                  <div className="price-label">Booking Date</div>
                  <div className="price-value">{user?.bookingDate}</div>
                </div>
                <div className="price-box">
                  <div className="price-label">Booking Time</div>
                  <div className="price-value">{user?.bookingTime}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          className="confirm-booking-btn"
          onClick={handlePayment}
          disabled={processing}
        >
          {processing ? "Processing..." : "Confirm Booking"}
        </button>

        <p className="payment-disclaimer">
          We will send you a confirmation and consent form on WhatsApp and email.
        </p>
      </div>
    </section>
  );
};

export default Payment;
