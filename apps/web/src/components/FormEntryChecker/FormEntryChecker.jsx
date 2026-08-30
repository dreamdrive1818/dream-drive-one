import React, { useState } from "react";
import "./FormEntryChecker.css";
import { FaEnvelope, FaKey, FaCheckCircle, FaArrowRight } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../api/http";
import "react-toastify/dist/ReactToastify.css";

const ZOHO_FORM_BASE_URL =
  "https://forms.zohopublic.in/dreamdrive1818gm1/form/CONSENTFORMFORCARHIRE/formperma/XcyUB9S6UcHoPngvocFg76vVhZcn4lJco34EPSjBy_o";

const FormEntryChecker = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
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
      setLoading(false);
    }
  };

const handleVerifyOtp = async (e) => {
  e.preventDefault();
  setLoading(true);

  if (!otp) {
    toast.error("Please enter the OTP.");
    setLoading(false);
    return;
  }

  try {
    // Step 1: Verify OTP via server
    const res = await api.post("/api/notify/verify-otp", {
      email,
      otp,
    });

    if (!res.data.verified) {
      toast.error(res.data.message || "Invalid OTP.");
      setLoading(false);
      return;
    }

    toast.success("OTP verified. Redirecting...");

    let redirectUrl = ZOHO_FORM_BASE_URL;
    let data = null;
    try {
      const res = await api.get(`/api/crm/form-entries/${encodeURIComponent(email)}`);
      data = res.data;
    } catch {
      data = null;
    }

    if (data?.id) {

      // Combine all fields from personal_info and address
      const flatData = {
        ...data.personal_info,
        ...data.address,
      };

      const excludeFields = [
        "aadhar_front_image",
        "aadhar_back_image",
        "dl_image",
        "driver_selfie",
      ];

      const params = Object.entries(flatData)
        .filter(
          ([key, val]) =>
            !excludeFields.includes(key) &&
            typeof val === "string" &&
            val.trim() !== ""
        )
        .map(([key, val]) => {
          const mappedKey = key === "fathers_name"
            ? "fathers_number"
            : key === "mothers_name"
            ? "mothers_number"
            : key;

          const cleanedValue =
            mappedKey === "fathers_number" || mappedKey === "mothers_number"
              ? val.replace(/\D/g, "")
              : val;

          return `${encodeURIComponent(mappedKey)}=${encodeURIComponent(cleanedValue)}`;
        })
        .join("&");

      redirectUrl += "?" + params;
    } else {
      redirectUrl += "?email=" + encodeURIComponent(email);
    }

    // Step 3: Redirect to Zoho Form
    window.location.href = redirectUrl;
  } catch (err) {
    console.error("Verification error:", err);
    toast.error("Something went wrong. Try again.");
  } finally {
    setLoading(false);
  }
};



  return (
    <div className="form-checker-wrapper">
      <div className="form-banner">
        <h1>Verify Your Form Entry</h1>
        <p>Enter your registered email and OTP to continue.</p>
      </div>

      <div className="form-checker-container">
        <form
          onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}
          className="form-checker-form"
        >
          <input
            type="email"
            placeholder="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={otpSent}
          />
          {otpSent && (
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          )}
          <button type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : otpSent
              ? "Verify OTP"
              : "Send OTP"}
          </button>
        </form>
      </div>

      {verified && (
        <div className="success-wrapper">
          <div className="success-card">
            <FaCheckCircle className="success-icon" />
            <h2>Verification Successful!</h2>
            <p>You have successfully verified your form entry.</p>
            <button className="go-home" onClick={() => navigate("/")}>
              Go to Home <FaArrowRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormEntryChecker;
