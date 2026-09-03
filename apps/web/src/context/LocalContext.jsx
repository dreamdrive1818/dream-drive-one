// src/context/LocalContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import api from "../api/http";

const LocalContext = createContext();

const EMPTY_BANNERS = { hero: [], strip: [], promo: [], side: [] };

export const LocalProvider = ({ children }) => {
  const [currentTFN, setCurrentTFN] = useState({ intlFormat: "", localFormat: "" });
  const [cms, setCms] = useState({
    page: null,
    banners: EMPTY_BANNERS,
    blogs: [],
    testimonials: [],
    fleet: [],
  });

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

  const [suppressSeo, setSuppressSeo] = useState(false);

  const handleNavigation = () => (window.location.href = "/fleet");

  function applyConfig(data = {}) {
    setCurrentTFN({
      intlFormat: data.whatsapp || "919942027772",
      localFormat: data.phone || "+91-994-202-7772",
    });
    setwebinfo((prev) => ({
      ...prev,
      name: data.siteName || prev.name,
      email: data.email || prev.email,
      address: data.address || prev.address,
    }));
  }

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/v1/public/home");
        setCms({
          page: data.page || null,
          banners: {
            hero: data.banners?.hero || [],
            strip: data.banners?.strip || [],
            promo: data.banners?.promo || [],
            side: data.banners?.side || [],
          },
          blogs: data.blogs || [],
          testimonials: data.testimonials || [],
          fleet: data.fleet || [],
        });
        applyConfig(data.config || {});
        if (data.page?.seoTitle || data.page?.seoDescription) {
          setwebinfo((prev) => ({
            ...prev,
            seo: {
              ...prev.seo,
              defaultTitle: data.page.seoTitle || prev.seo.defaultTitle,
              description: data.page.seoDescription || prev.seo.description,
              ogImage: data.page.seoOgImage || prev.seo.ogImage,
            },
          }));
        }
      } catch {
        try {
          const { data } = await api.get("/v1/public/config");
          applyConfig(data);
        } catch {
          applyConfig({});
        }
      }
    };
    load();
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

  const heroBanner = cms.banners.hero[0] || null;
  const stripBanner = cms.banners.strip[0] || null;
  const promoBanner = cms.banners.promo[0] || null;
  const campaignActive = Boolean(stripBanner || promoBanner || heroBanner);

  const value = useMemo(
    () => ({
      webinfo,
      setwebinfo,
      handleNavigation,
      setSeo,
      pageSeo,
      suppressSeo,
      setSuppressSeo,
      cms,
      heroBanner,
      stripBanner,
      promoBanner,
      campaignActive,
    }),
    [webinfo, suppressSeo, cms, heroBanner, stripBanner, promoBanner, campaignActive]
  );

  return <LocalContext.Provider value={value}>{children}</LocalContext.Provider>;
};

export const useLocalContext = () => useContext(LocalContext);
