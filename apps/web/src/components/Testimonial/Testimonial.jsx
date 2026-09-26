import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { motion, useInView, useReducedMotion } from "framer-motion";
import "./Testimonial.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faStar as solidStar,
  faTimes,
  faQuoteLeft,
  faArrowRight,
  faPen,
} from "@fortawesome/free-solid-svg-icons";
import { faStar as regularStar } from "@fortawesome/free-regular-svg-icons";
import { useTestimonialContext } from "../../context/TestimonialContext";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload";

const toDate = (value) =>
  new Date(value?.seconds ? value.seconds * 1000 : value || 0);

const HOME_LIMIT = 3;

const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

const EASE = [0.22, 1, 0.36, 1];

const fadeUp = (y, delay) => ({
  hidden: { opacity: 0, y },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE, delay } },
});

const eyebrowIn = fadeUp(8, 0.05);
const titleIn = fadeUp(16, 0.12);
const leadIn = fadeUp(10, 0.2);
const actionIn = fadeUp(10, 0.26);

const listIn = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.24 } },
};

const cardIn = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

const Stars = ({ rating }) => {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  if (!value) return null;
  return (
    <span
      className="testimonial-stars"
      role="img"
      aria-label={`Rated ${value} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <FontAwesomeIcon
          key={i}
          icon={i < value ? solidStar : regularStar}
          className="star"
        />
      ))}
    </span>
  );
};

const TestimonialCard = ({ item, featured }) => {
  const message = item.message || item.body || "";
  const photo = item.image || item.photoUrl;

  return (
    <motion.li
      className={`testimonial-card${featured ? " is-featured" : ""}`}
      variants={cardIn}
    >
      <figure>
        <div className="testimonial-card-top">
          <span className="testimonial-quote-mark" aria-hidden="true">
            <FontAwesomeIcon icon={faQuoteLeft} />
          </span>
          <Stars rating={item.rating} />
        </div>
        <blockquote className="testimonial-quote">
          <p>{message}</p>
        </blockquote>
        <figcaption className="testimonial-author">
          {photo ? (
            <img
              className="testimonial-avatar"
              src={photo}
              alt=""
              loading="lazy"
            />
          ) : (
            <span className="testimonial-avatar" aria-hidden="true">
              {initialsOf(item.name)}
            </span>
          )}
          <span className="testimonial-author-text">
            <span className="testimonial-name">{item.name}</span>
            {item.city ? (
              <span className="testimonial-city">{item.city}</span>
            ) : null}
          </span>
        </figcaption>
      </figure>
    </motion.li>
  );
};

// Uses `animate` rather than `whileInView` so reviews that load after the reveal still animate in.
const RevealSection = ({ className, children }) => {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const shown = reduceMotion || inView;

  return (
    <motion.section
      ref={ref}
      className={className}
      aria-labelledby="testimonial-title"
      initial={reduceMotion ? "show" : "hidden"}
      animate={shown ? "show" : "hidden"}
    >
      {children}
    </motion.section>
  );
};

const Testimonial = () => {
  const location = useLocation();
  const isPage = location.pathname === "/testimonials";
  const { testimonials, submitTestimonial } = useTestimonialContext();

  const sortedTestimonials = useMemo(
    () =>
      [...testimonials].sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt)),
    [testimonials]
  );

  const list = isPage
    ? sortedTestimonials
    : sortedTestimonials.slice(0, HOME_LIMIT);

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

  if (!isPage && list.length === 0) return null;

  const layout = isPage ? "grid" : `board board--${list.length}`;

  return (
    <RevealSection
      className={`testimonial-section${isPage ? " is-page" : ""}`}
    >
      <div className="testimonial-shell">
        <header className="testimonial-head">
          <div className="testimonial-head-copy">
            <motion.p className="testimonial-eyebrow" variants={eyebrowIn}>
              Testimonials
            </motion.p>
            <motion.h2
              id="testimonial-title"
              className="testimonial-title"
              variants={titleIn}
            >
              What our riders
              <span>say about us</span>
            </motion.h2>
            <motion.p className="testimonial-lead" variants={leadIn}>
              Reviews shared by customers after their drive with Dream Drive.
            </motion.p>
          </div>

          <motion.div className="testimonial-head-action" variants={actionIn}>
            {isPage ? (
              <button
                type="button"
                className="testimonial-cta"
                onClick={() => setShowModal(true)}
              >
                <FontAwesomeIcon icon={faPen} />
                Leave a testimonial
              </button>
            ) : (
              <Link className="testimonial-link" to="/testimonials">
                View all reviews
                <FontAwesomeIcon icon={faArrowRight} />
              </Link>
            )}
          </motion.div>
        </header>

        {list.length > 0 ? (
          <motion.ul className={`testimonial-list ${layout}`} variants={listIn}>
            {list.map((item, index) => (
              <TestimonialCard
                key={item.id}
                item={item}
                featured={!isPage && index === 0}
              />
            ))}
          </motion.ul>
        ) : (
          <p className="testimonial-empty">
            No testimonials yet — be the first to share your experience.
          </p>
        )}
      </div>

      {isPage && showModal ? createPortal(
        <div
          className="testimonial-form-modal modal-overlay"
          onClick={() => setShowModal(false)}
        >
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
        </div>,
        document.body
      ) : null}
    </RevealSection>
  );
};

export default Testimonial;
