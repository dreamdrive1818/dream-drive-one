// src/context/LocalContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import api from "../api/http";

const LocalContext = createContext();

export const LocalProvider = ({ children }) => {
  const [currentTFN, setCurrentTFN] = useState({ intlFormat: "", localFormat: "" });

  const [webinfo, setwebinfo] = useState({
    name: "Dream Drive",
    phone: " ",
    phonecall: "",
    logo:
      "https://res.cloudinary.com/df10iqj1i/image/upload/v1761418510/IMG_1646-removebg-preview_trkgki.png",
    address: "105 Jagriti Bhawan, near Adarsh Nagar, Bariatu, Ranchi - 834009 Jharkhand",
    email: "info@hcvatron.com",
    seo: {
      siteUrl: "https://dream-drive.co.in/",
      tagline: "Ranchi’s Trusted Self-Drive Car Rentals",
      description:
        "Book SUVs like Nexon & Compass with flexible packages, 24×7 support, and doorstep delivery in Ranchi.",
      logo:
        "https://res.cloudinary.com/df10iqj1i/image/upload/v1761418510/IMG_1646-removebg-preview_trkgki.png",
      ogImage: "",
      twitterHandle: "@dreamdrive",
      socialLinks: [],
      titleTemplate: "%s | Dream Drive",
      defaultTitle: "Dream Drive — Ranchi’s Trusted Self-Drive Car Rentals",
      robots: "index,follow",
    },
  });

  // 🔕 when true, global <SeoDefaults/> renders nothing
  const [suppressSeo, setSuppressSeo] = useState(false);

  const handleNavigation = () => (window.location.href = "/cars");

  useEffect(() => {
    const fetchTFN = async () => {
      try {
        const { data } = await api.get("/api/identity/site-numbers/dream-drive.co");

        if (data?.numberIntl || data?.numberLocal) {
          setCurrentTFN({
            intlFormat: data.numberIntl || "",
            localFormat: data.numberLocal || "",
          });
        } else {
          setCurrentTFN({ intlFormat: "919942027772", localFormat: "+91-994-202-7772" });
        }
      } catch (error) {
        console.error("Error fetching TFN: ", error);
      }
    };
    fetchTFN();
  }, []);

  useEffect(() => {
    setwebinfo((prev) => ({
      ...prev,
      phone: currentTFN.localFormat,
      phonecall: currentTFN.intlFormat,
    }));
  }, [currentTFN]);

  const setSeo = (partial) =>
    setwebinfo((prev) => ({ ...prev, seo: { ...prev.seo, ...(partial || {}) } }));

  const pageSeo = (overrides = {}) => ({ ...webinfo.seo, ...overrides });

  const value = useMemo(
    () => ({
      webinfo,
      setwebinfo,
      handleNavigation,
      setSeo,
      pageSeo,
      suppressSeo,
      setSuppressSeo,
    }),
    [webinfo, suppressSeo]
  );

  return <LocalContext.Provider value={value}>{children}</LocalContext.Provider>;
};

export const useLocalContext = () => useContext(LocalContext);
