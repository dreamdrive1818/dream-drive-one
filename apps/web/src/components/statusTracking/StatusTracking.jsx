import React, { useState } from "react";
import "./StatusTracking.css";
import api from "../../api/http";
import {
  FaCheckCircle,
  FaCarAlt,
  FaUserAlt,
  FaMoneyBillWave,
  FaArrowRight,
  FaWhatsapp,
  FaClock,
  FaCity,
  FaRoute
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const StatusTracking = () => {
  const [trackingId, setTrackingId] = useState("");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOrder(null);
    setNotFound(false);

    try {
      const { data } = await api.get(`/api/booking/track/${encodeURIComponent(trackingId)}`);
      setOrder(data);
    } catch (err) {
      console.error("Tracking error:", err.message);
      setNotFound(true);
    }

    setLoading(false);
  };

  return (
    <div className="tracking-wrapper">
      <div className="tracking-banner">
        <h1>Track Your Ride</h1>
        <p>Enter your Ride ID below to check your order status instantly.</p>
      </div>

      <div className="tracking-container">
        <form onSubmit={handleSearch} className="tracking-form">
          <input
            type="text"
            placeholder="Enter Ride ID (e.g., RIDE123456)"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Checking..." : "Track"}
          </button>
        </form>

        {notFound && (
          <p className="no-order">No order found with this Ride ID.</p>
        )}
      </div>

      {order && (
        <div className="success-wrapper">
          <div className="success-card">
            <div className="success-header">
              <FaCheckCircle className="success-icon" />
              <h2>Booking Confirmed!</h2>
              <p>Your ride has been successfully scheduled.</p>
              <div className="order-id-box">
                <p><strong>Ride ID:</strong> {order.id}</p>
                <p><strong>Status:</strong> {order.status}</p>
              </div>
            </div>

            <div className="success-grid">
              {/* Car Details */}
              <div className="success-section">
                <h4><FaCarAlt /> Car Details</h4>
                <ul>
                  <li><strong>Name:</strong> {order.car?.name}</li>
                  <li><strong>Type:</strong> {order.car?.details?.type}</li>
                  <li><strong>Seats:</strong> {order.car?.details?.seats}</li>
                  <li><strong>Luggage:</strong> {order.car?.details?.luggage} bags</li>
                  <li><strong>Fuel:</strong> {order.car?.details?.fuel}</li>
                  <li><strong>Transmission:</strong> {order.car?.details?.mt === "YES" ? "Manual" : "Automatic"}</li>
                </ul>
              </div>

              {/* User Details */}
              <div className="success-section">
                <h4><FaUserAlt /> User Info</h4>
                <ul>
                  <li><strong>Name:</strong> {order.user?.fullName}</li>
                  <li><strong>Email:</strong> {order.user?.email}</li>
                  <li><strong>Phone:</strong> {order.user?.phone}</li>
                  <li><strong>Rental Type:</strong> {order.rentalType || "-"}</li>
                  <li><strong>Booking Date:</strong> {order.bookingDate || "-"}</li>
                  <li><strong>Booking Time:</strong> {order.bookingTime || "-"}</li>
                  {order.rentalType === "self-drive" && (
                    <li><strong>Pickup Location:</strong> {order.pickupLocation || "-"}</li>
                  )}
                  {order.rentalType === "with-driver" && (
                    <>
                      <li><strong>Booking Category:</strong> {order.bookingCategory || "-"}</li>
                      {order.bookingCategory === "local" && (
                        <li><FaCity /> <strong>Starting City:</strong> {order.startingCity || "-"}</li>
                      )}
                      {order.bookingCategory === "intercity" && (
                        <>
                          <li><FaCity /> <strong>Starting City:</strong> {order.startingCity || "-"}</li>
                          <li><FaRoute /> <strong>Ending City:</strong> {order.endingCity || "-"}</li>
                          <li><FaClock /> <strong>Trip Type:</strong> {order.tripType || "-"}</li>
                        </>
                      )}
                    </>
                  )}
                </ul>
              </div>

              {/* Payment */}
              <div className="success-section">
                <h4><FaMoneyBillWave /> Payment</h4>
                <ul>
                  <li><strong>Advance Paid:</strong> ₹{order.advancePaid}</li>
                  <li><strong>Payment Status:</strong> {order.paymentStatus}</li>
                  <li><strong>Created At:</strong> {new Date(order.createdAt).toLocaleString()}</li>
                </ul>
              </div>
            </div>

            {/* Car Images */}
            {order.car?.images?.length > 0 && (
              <div className="car-images-gallery">
                <h4>Car Images</h4>
                <div className="car-images-row">
                  {order.car.images.map((img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`Car ${index + 1}`}
                      className="car-thumbnail"
                    />
                  ))}
                </div>
              </div>
            )}

            <p className="success-followup">
              We have emailed your booking details. For any questions, please reach out to our WhatsApp support.
            </p>

            <div className="action-buttons">
              <button className="go-home" onClick={() => navigate("/")}>
                Go to Home <FaArrowRight />
              </button>
              <a
                className="wa-popup-btn"
                href={`https://wa.me/91XXXXXXXXXX?text=Hi, I want help with Ride ID ${order.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp /> WhatsApp Support
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusTracking;
