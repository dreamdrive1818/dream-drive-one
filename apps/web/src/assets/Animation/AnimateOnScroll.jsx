import React, { useRef, useEffect, useState } from "react";

const AnimateOnScroll = ({ children, className = "", delay = 0 }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let timeoutId;
    // threshold 0: fire when any pixel is visible.
    // Tall mobile sections never reach 10% visibility in the viewport,
    // so the old threshold left content stuck at opacity 0.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        timeoutId = setTimeout(() => {
          setIsVisible(true);
        }, delay * 1000);
      },
      { threshold: 0, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`${className} ${isVisible ? "fade-in-bottom" : "hidden-init"} animateonscroll`}
    >
      {children}
    </div>
  );
};

export default AnimateOnScroll;
