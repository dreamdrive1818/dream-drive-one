import { createContext, useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/http";

const TestimonialContext = createContext();

export const useTestimonialContext = () => useContext(TestimonialContext);

export const TestimonialProvider = ({ children }) => {
  const [testimonials, setTestimonials] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/cms/testimonials");
        setTestimonials(data.filter((item) => item.status === "approved"));
      } catch (err) {
        console.error("Testimonials load error:", err.message);
      }
    };
    load();
  }, []);

  const submitTestimonial = async (testimonialData) => {
    try {
      await api.post("/api/cms/testimonials", testimonialData);
      toast.success("Thank you for your feedback! Your testimonial is pending review.");
    } catch (error) {
      console.error("Submit Testimonial Error:", error.message);
      toast.error("Failed to submit testimonial, please try again later.");
    }
  };

  return (
    <TestimonialContext.Provider value={{ testimonials, submitTestimonial }}>
      {children}
    </TestimonialContext.Provider>
  );
};
