import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import "./Testimonial.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar as solidStar,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as regularStar } from "@fortawesome/free-regular-svg-icons";
import { useTestimonialContext } from "../../context/TestimonialContext";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload";

const toDate = (value) =>
  new Date(value?.seconds ? value.seconds * 1000 : value || 0);

const Testimonial = () => {
  const location = useLocation();
  const isPage = location.pathname === "/testimonials";
  const { testimonials, submitTestimonial } = useTestimonialContext();

  const sortedTestimonials = useMemo(
    () =>
      [...testimonials].sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt)),
    [testimonials]
  );

  const list = isPage ? sortedTestimonials : sortedTestimonials.slice(0, 3);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    rating: 0,
    imageFile: null,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "imageFile") {
      setFormData((prev) => ({ ...prev, imageFile: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRating = (value) => {
    setFormData((prev) => ({ ...prev, rating: value }));
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

        setUploadProgress(40);
        imageUrl = await uploadToCloudinary(formData.imageFile, {
          folder: "dreamdrive/testimonials",
          public: true,
        });
        setUploadProgress(80);
      }

      await submitTestimonial({
        name: formData.name,
        message: formData.message,
        rating: formData.rating,
        image: imageUrl,
      });

      setFormData({ name: "", message: "", rating: 0, imageFile: null });
      setShowModal(false);
      setUploading(false);
      setUploadProgress(0);
    } catch (err) {
      console.error(err);
      alert("Failed to submit testimonial.");
      setUploading(false);
    }
  };

  return (
    <section
      className={`testimonial-section ${isPage ? "full-height" : ""}`}
      aria-label="Testimonials"
    >
      <div className="testimonial-shell">
        <h2 className="testimonial-title">Testimonials</h2>

        {list.length > 0 ? (
          <ul className="testimonial-list">
            {list.map((item) => (
              <li key={item.id} className="testimonial-item">
                <div className="testimonial-stars" aria-label={`${item.rating} of 5`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <FontAwesomeIcon
                      key={i}
                      icon={i < item.rating ? solidStar : regularStar}
                      className="star"
                    />
                  ))}
                </div>
                <p className="testimonial-message">“{item.message}”</p>
                <p className="testimonial-name">{item.name}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="testimonial-empty">No testimonials yet.</p>
        )}

        {isPage ? (
          <button
            type="button"
            className="testimonial-cta"
            onClick={() => setShowModal(true)}
          >
            Leave a testimonial
          </button>
        ) : null}
      </div>

      {isPage && showModal ? (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowModal(false)}
              aria-label="Close"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3>Leave a testimonial</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                placeholder="Your name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <textarea
                name="message"
                placeholder="Your message"
                rows="4"
                value={formData.message}
                onChange={handleChange}
                required
              />
              <input
                type="file"
                name="imageFile"
                accept="image/*"
                onChange={handleChange}
              />
              <div className="rating-input">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="rating-star-btn"
                    onClick={() => handleRating(i + 1)}
                    aria-label={`${i + 1} stars`}
                  >
                    <FontAwesomeIcon
                      icon={i < formData.rating ? solidStar : regularStar}
                      className="star"
                    />
                  </button>
                ))}
              </div>
              {uploading ? (
                <div className="progress-bar">
                  <div
                    className="progress-bar-inner"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}
              <button type="submit" disabled={uploading}>
                {uploading ? `Uploading ${uploadProgress}%…` : "Submit"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default Testimonial;
