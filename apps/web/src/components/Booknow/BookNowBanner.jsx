import React from "react";
import "./BookNowBanner.css";
import { useLocalContext } from "../../context/LocalContext";
import AnimateOnScroll from "../../assets/Animation/AnimateOnScroll";

const BookNowBanner = () => {

  const {handleNavigation} = useLocalContext();

  return (
    <section className="book-parallax-banner">
      <AnimateOnScroll className="book-parallax-content delay-2">
        <h2>Start Your Journey Today</h2>
        <p>Drive into the horizon with luxury and reliability at your fingertips.</p>
        <button onClick={handleNavigation} className="book-parallax-button">Book Now</button>
      </AnimateOnScroll>
    </section>
  );
};

export default BookNowBanner;
