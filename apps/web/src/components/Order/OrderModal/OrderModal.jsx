import React, { useState, useEffect } from "react";
import "./OrderModal.css";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useOrderContext } from "../../../context/OrderContext";
import { useAdminContext } from "../../../context/AdminContext";
import api from "../../../api/http";

const OrderModal = ({ closeModal }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [step, setStep] = useState("form");

  const { setUser, createPendingOrder, handleOrder, selectedCar } = useOrderContext();

  const [rentalType, setRentalType] = useState("self-drive");
  const [bookingCategory, setBookingCategory] = useState("local");
  const [tripType, setTripType] = useState("round-trip");
  const [pickupLocation, setPickupLocation] = useState("");
  const [startingCity, setStartingCity] = useState("");
  const [endingCity, setEndingCity] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [selectedCarId, setSelectedCarId] = useState(selectedCar?.id || "");
  const [availableCars, setCars] = useState([]);

  const navigate = useNavigate();
  const { fetchCars } = useAdminContext();

  useEffect(() => {
    const loadCars = async () => {
      const carData = await fetchCars();
      const sorted = [...carData].sort((a, b) => {
        const hasDiscount = (car) => {
          const sale = Number(car?.salePrice);
          const price = Number(car?.price);
          return Number.isFinite(sale) && Number.isFinite(price) && sale > price;
        };
        const aDisc = hasDiscount(a);
        const bDisc = hasDiscount(b);
        if (aDisc !== bDisc) return aDisc ? -1 : 1;
        return (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999);
      });
      setCars(sorted);
    };
    loadCars();
  }, [fetchCars]);

  const handlePhoneChange = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length <= 10) setPhone(val);
  };

  const handleSendOtp = async () => {
    if (!fullName || !email || !phone)
      return toast.error("All fields are required.");
    if (!/^\S+@\S+\.\S+$/.test(email))
      return toast.error("Invalid email format.");
    if (!/^\d{10}$/.test(phone))
      return toast.error("Enter a valid 10-digit phone number.");
    if (!agreed)
      return toast.warn("Please agree to the Terms & Conditions.");

    setIsChecking(true);

    try {
      const userDoc = await api.get(`/api/identity/users/${encodeURIComponent(email)}`);
      if (userDoc?.data?.id) {
        toast.info("User already exists, skipping OTP verification.");
        const userData = {
          uid: email,
          fullName,
          email,
          phone: "+91" + phone,
        };
        setUser(userData);
        setStep("booking");
        return;
      }
    } catch {
      console.log("User not found, proceeding with OTP");
    }

    try {
      const res = await api.post("/api/notify/send-otp", { email });
      if (res.status === 200) {
        toast.success("OTP sent to your email.");
        setOtpSent(true);
      } else {
        toast.error(res.data?.message || "Failed to send OTP.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error sending OTP. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp) return toast.error("Please enter the OTP.");
    try {
      const res = await api.post("/api/notify/verify-otp", { email, otp });
      if (res.data.verified) {
        toast.success("OTP verified. Continue with booking.");
        setStep("booking");
      } else {
        toast.error(res.data.message || "Invalid OTP.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Verification failed. Try again.");
    }
  };

  const handleCarChange = (e) => {
    const carId = e.target.value;
    setSelectedCarId(carId);
    const foundCar = availableCars.find((car) => car.id === carId);
    if (foundCar) handleOrder(foundCar);
  };

  const handleConfirmBooking = () => {
    if (!bookingDate || !bookingTime)
      return toast.error("Please select booking date and time.");
    if (!selectedCarId)
      return toast.error("Please select a car to proceed.");
    if (rentalType === "self-drive" && !pickupLocation)
      return toast.error("Please enter pickup location.");
    if (rentalType === "with-driver") {
      if (bookingCategory === "local" && !startingCity)
        return toast.error("Enter starting city for local trip.");
      if (bookingCategory === "intercity" && (!startingCity || !endingCity))
        return toast.error("Enter starting and ending city.");
    }

    const userData = {
      uid: email,
      fullName,
      email,
      phone: "+91" + phone,
      rentalType,
      bookingCategory: rentalType === "with-driver" ? bookingCategory : null,
      tripType: rentalType === "with-driver" && bookingCategory === "intercity" ? tripType : null,
      pickupLocation: rentalType === "self-drive" ? pickupLocation : null,
      startingCity: rentalType === "with-driver" ? startingCity : null,
      endingCity: rentalType === "with-driver" && bookingCategory === "intercity" ? endingCity : null,
      bookingDate,
      bookingTime,
      createdAt: new Date(),
    };

    setUser(userData);
    createPendingOrder(userData);
    closeModal();
    navigate("/payment");
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="order-modal-overlay">
      <div className="order-modal">
        <button className="modal-close" onClick={closeModal}>×</button>

        {step === "form" ? (
          <>
            <h3>Secure Your Booking</h3>
            <p>Verify your email to proceed.</p>
            <label>Full Name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
            <label>Email Address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
            <label>Phone Number</label>
            <div className="phone-input-wrapper">
              <span className="phone-prefix">+91</span>
              <input value={phone} onChange={handlePhoneChange} maxLength={10} placeholder="10-digit number" />
            </div>
            <div className="terms-check">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <label>I agree to the <a href="/termsandconditions" target="_blank">Terms & Conditions</a></label>
            </div>
            {!otpSent ? (
              <button onClick={handleSendOtp} disabled={isChecking}>
                {isChecking ? "Checking..." : "Send OTP"}
              </button>
            ) : (
              <>
                <label>Enter OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter OTP" />
                <button onClick={handleVerifyOtp}>Verify OTP</button>
              </>
            )}
          </>
        ) : (
          <>
            <h3>Confirm Your Booking</h3>
            <p>Please complete your booking details.</p>

            {/* rental type now appears here, after otp */}
            <div className="rental-type-selector">
              <label>
                <input
                  type="radio"
                  value="self-drive"
                  checked={rentalType === "self-drive"}
                  onChange={() => setRentalType("self-drive")}
                />
                Self-Drive
              </label>
              <label>
                <input
                  type="radio"
                  value="with-driver"
                  checked={rentalType === "with-driver"}
                  onChange={() => setRentalType("with-driver")}
                />
                With Driver
              </label>
            </div>

            {rentalType === "with-driver" && (
              <>
                <div className="booking-category">
                  <button
                    className={bookingCategory === "local" ? "active" : ""}
                    onClick={() => setBookingCategory("local")}
                  >Local</button>
                  <button
                    className={bookingCategory === "intercity" ? "active" : ""}
                    onClick={() => setBookingCategory("intercity")}
                  >Intercity</button>
                </div>
                {bookingCategory === "local" && (
                  <>
                    <label>Starting City</label>
                    <input value={startingCity} onChange={(e) => setStartingCity(e.target.value)} />
                  </>
                )}
                {bookingCategory === "intercity" && (
                  <>
                    <div className="trip-type">
                      <label><input type="radio" checked={tripType === "round-trip"} onChange={() => setTripType("round-trip")} /> Round Trip</label>
                      <label><input type="radio" checked={tripType === "one-way"} onChange={() => setTripType("one-way")} /> One Way</label>
                    </div>
                    <label>Starting City</label>
                    <input value={startingCity} onChange={(e) => setStartingCity(e.target.value)} />
                    <label>Ending City</label>
                    <input value={endingCity} onChange={(e) => setEndingCity(e.target.value)} />
                  </>
                )}
              </>
            )}

            {rentalType === "self-drive" && (
              <>
                <label>Pickup Location</label>
                <input value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} />
              </>
            )}

            <label>Booking Date</label>
            <input type="date" value={bookingDate} min={today} onChange={(e) => setBookingDate(e.target.value)} />

            <label>Booking Time</label>
            <select value={bookingTime} onChange={(e) => setBookingTime(e.target.value)}>
              <option value="">Select Time</option>
              {["12:00 AM","01:00 AM","02:00 AM","03:00 AM","04:00 AM","05:00 AM","06:00 AM","07:00 AM",
              "08:00 AM","09:00 AM","10:00 AM","11:00 AM","12:00 PM","01:00 PM","02:00 PM","03:00 PM",
              "04:00 PM","05:00 PM","06:00 PM","07:00 PM","08:00 PM","09:00 PM","10:00 PM","11:00 PM"].map((time) => (
                <option key={time} value={time}>{time}</option>
              ))}
            </select>

           <select value={selectedCarId} onChange={handleCarChange}>
  <option value="">Select Car</option>
  {availableCars
    .filter((car) => car.available === "Available") // only show available cars
    .map((car) => (
      <option key={car.id} value={car.id}>
        {car.name}
      </option>
    ))}
</select>


            <button onClick={handleConfirmBooking}>Confirm Booking</button>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderModal;
