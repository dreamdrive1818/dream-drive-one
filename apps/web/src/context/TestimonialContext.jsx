import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/http";

const TestimonialContext = createContext();

export const useTestimonialContext = () => useContext(TestimonialContext);

export const TestimonialProvider = ({ children }) => {
  const [testimonials, setTestimonials] = useState([]);

  const load = async () => {
    try {
      const { data } = await api.get("/v1/public/testimonials");
      setTestimonials(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Testimonials load error:", err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitTestimonial = async (testimonialData) => {
    try {
      await api.post("/v1/public/testimonials", testimonialData);
      toast.success("Thank you for your feedback! Your testimonial is pending review.");
    } catch (error) {
      console.error("Submit Testimonial Error:", error.message);
      toast.error("Failed to submit testimonial, please try again later.");
      throw error;
    }
  };

  return (
    <TestimonialContext.Provider value={{ testimonials, submitTestimonial, reload: load }}>
      {children}
    </TestimonialContext.Provider>
  );
};
