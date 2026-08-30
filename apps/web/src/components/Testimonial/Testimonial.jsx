import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import "./Testimonial.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar as solidStar,
  faQuoteLeft,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as regularStar } from "@fortawesome/free-regular-svg-icons";
import { useTestimonialContext } from "../../context/TestimonialContext";

const Testimonial = () => {
  const location = useLocation();
  const { testimonials, submitTestimonial } = useTestimonialContext();
const sortedTestimonials = [...testimonials].sort((a, b) => {
  const dateA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
  const dateB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
  return dateA - dateB;
});


  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    rating: 0,
    imageFile: null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "imageFile") {
      setFormData((prev) => ({
        ...prev,
        imageFile: files[0],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleRating = (value) => {
    setFormData((prev) => ({
      ...prev,
      rating: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.rating === 0) {
      alert("Please select a rating before submitting");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    let imageUrl = "";

    try {
      if (formData.imageFile) {
        if (formData.imageFile.size > 2 * 1024 * 1024) {
          alert("Image too large, please keep it under 2 MB");
          setUploading(false);
          return;
        }

        const data = new FormData();
        data.append("file", formData.imageFile);
        data.append("upload_preset", uploadPreset);

        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
        );

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            setUploadProgress(Math.round(percent));
          }
        });

        xhr.onload = async () => {
          const res = JSON.parse(xhr.responseText);
          imageUrl = res.secure_url;

          await submitTestimonial({
            name: formData.name,
            message: formData.message,
            rating: formData.rating,
            image: imageUrl,
          });

          setFormData({
            name: "",
            message: "",
            rating: 0,
            imageFile: null,
          });
          setShowModal(false);
          setUploading(false);
          setUploadProgress(0);
        };

        xhr.onerror = () => {
          alert("Upload failed");
          setUploading(false);
        };

        xhr.send(data);
      } else {
        await submitTestimonial({
          name: formData.name,
          message: formData.message,
          rating: formData.rating,
          image: "",
        });
        setFormData({
          name: "",
          message: "",
          rating: 0,
          imageFile: null,
        });
        setShowModal(false);
        setUploading(false);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit testimonial.");
      setUploading(false);
    }
  };

  return (
    <section
      className={`testimonial-section ${
        location.pathname === "/testimonials" ? "full-height" : ""
      }`}
    >
      <div className="testimonial-container">
        <h2>What Our Customers Say</h2>
        <motion.div
          className="testimonial-grid"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: {
                staggerChildren: 0.2,
              },
            },
          }}
        >
          {sortedTestimonials.length > 0 ? (
            sortedTestimonials.map((item) => (
              <motion.div
                key={item.id}
                className="testimonial-card"
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <div className="testimonial-quote">
                  <FontAwesomeIcon icon={faQuoteLeft} />
                </div>
                <img
                  src={item.image || "/default-avatar.png"}
                  alt={item.name}
                  className="testimonial-avatar"
                />
                <p className="testimonial-text">"{item.message}"</p>
                <div className="testimonial-stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FontAwesomeIcon
                      key={i}
                      icon={i < item.rating ? solidStar : regularStar}
                      className="star"
                    />
                  ))}
                </div>
                <h4 className="testimonial-author">- {item.name}</h4>
              </motion.div>
            ))
          ) : (
            <p className="testimonial-empty">No approved testimonials yet.</p>
          )}
        </motion.div>
      </div>

      {location.pathname === "/testimonials" && (
        <button
          className="fixed-testimonial-btn"
          onClick={() => setShowModal(true)}
        >
          Leave a Testimonial
        </button>
      )}

      {location.pathname === "/testimonials" && showModal && (
        <motion.div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <button className="modal-close" onClick={() => setShowModal(false)}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3>Leave a Testimonial</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <textarea
                name="message"
                placeholder="Your Message"
                rows="4"
                value={formData.message}
                onChange={handleChange}
                required
              ></textarea>
              <input
                type="file"
                name="imageFile"
                accept="image/*"
                onChange={handleChange}
              />
              <div className="rating-input">
                {Array.from({ length: 5 }).map((_, i) => (
                  <FontAwesomeIcon
                    key={i}
                    icon={i < formData.rating ? solidStar : regularStar}
                    className="star"
                    onClick={() => handleRating(i + 1)}
                  />
                ))}
              </div>
              {uploading && (
                <div className="progress-bar">
                  <div
                    className="progress-bar-inner"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
              <button type="submit" disabled={uploading}>
                {uploading ? `Uploading ${uploadProgress}%...` : "Submit"}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
};

export default Testimonial;
