"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useLocalContext } from "../context/LocalContext";
import Home from "../components/home/Home";
import Header from "../components/header/Header";
import Footer from "../components/footer/Footer";
import HowItWorks from "../components/HowItWorks/HowItWorks";
import Contact from "../components/contact/Contact";
import DreamCarBanner from "../components/DreamCarBanner/DreamCarBanner";
import CmsPage from "../components/CmsPage/CmsPage";
import About from "../components/About/About";
import Order from "../components/Order/Order";
import AdminLayout from "./AdminLayout";
import Payment from "../components/Payment/Payment";
import Success from "../components/Payment/Success/Success";
import AllBlogs from "../components/blogs/AllBlogs";
import Blogspage from "../components/blogs/Blogspage";
import StatusTracking from "../components/statusTracking/StatusTracking";
import Testimonial from "../components/Testimonial/Testimonial";
import FormEntryChecker from "../components/FormEntryChecker/FormEntryChecker";
import Numberattach from "../components/Numberattach/Numberattach";
import ContactPopup from "../components/ContactPopup/ContactPopup";
import WhatsAppPopup from "../components/WhatsAppPopup/WhatsAppPopup";
import SeoDefaults from "../utils/SeoDefaults";
import SaleModal from "../components/SaleModal/SaleModal";
import MonsoonPromoBar from "../components/MonsoonPromoBar/MonsoonPromoBar";
import Login from "../ms/pages/Login";
import Search from "../ms/pages/Search";
import CarsRedirect from "../ms/pages/CarsRedirect";
import CarDetail from "../ms/pages/CarDetail";
import Packages from "../ms/pages/Packages";
import Checkout from "../ms/pages/Checkout";
import SuccessMs from "../ms/pages/Success";
import AccountLayout from "../ms/pages/account/AccountLayout";
import AccountHome from "../ms/pages/account/AccountHome";
import AccountBookings from "../ms/pages/account/AccountBookings";
import AccountBookingDetail from "../ms/pages/account/AccountBookingDetail";
import AccountKyc from "../ms/pages/account/AccountKyc";
import AccountAgreements from "../ms/pages/account/AccountAgreements";
import AccountInvoices from "../ms/pages/account/AccountInvoices";
import AccountWallet from "../ms/pages/account/AccountWallet";
import AccountTickets from "../ms/pages/account/AccountTickets";
import Track from "../ms/pages/Track";

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppRoute = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const isFirstRender = useRef(true);
  const isAdminPage = location.pathname.includes("admin");
  const { campaignActive } = useLocalContext();

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle("monsoon-sale", !isAdminPage && campaignActive);
    return () => document.body.classList.remove("monsoon-sale");
  }, [isAdminPage, campaignActive]);

  return (
    <>
      <ScrollToTop />

      {!isAdminPage && <Numberattach />}
      {!isAdminPage && <WhatsAppPopup />}
      {!isAdminPage && <ContactPopup />}
      {!isAdminPage && <MonsoonPromoBar />}
      {!isAdminPage && <SaleModal />}

      {!isAdminPage && <Header />}
      {!isAdminPage && (
        <main className="route-container">
          {loading ? (
            <div className="route-spinner" />
          ) : (
            <div className="fade-in-bottom">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/cars" element={<CarsRedirect />} />
                <Route path="/fleet" element={<Search />} />
                <Route path="/packages/:slug" element={<Packages />} />
                <Route path="/packages" element={<Packages />} />
                <Route path="/cars/:slug" element={<CarDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/account" element={<AccountLayout />}>
                  <Route index element={<AccountHome />} />
                  <Route path="bookings" element={<AccountBookings />} />
                  <Route path="bookings/:id" element={<AccountBookingDetail />} />
                  <Route path="kyc" element={<AccountKyc />} />
                  <Route path="agreements" element={<AccountAgreements />} />
                  <Route path="invoices" element={<AccountInvoices />} />
                  <Route path="wallet" element={<AccountWallet />} />
                  <Route path="tickets" element={<AccountTickets />} />
                </Route>
                <Route path="/checkout/success" element={<SuccessMs />} />
                <Route path="/checkout/:quoteId" element={<Checkout />} />
                <Route path="/track/:bookingId" element={<Track />} />
                <Route path="/blogs" element={<AllBlogs />} />
                <Route path="/testimonials" element={<Testimonial />} />
                <Route path="/blogs/:slug" element={<Blogspage />} />
                <Route path="/order" element={<Order />} />
                <Route path="/order-tracking" element={<StatusTracking />} />
                <Route path="/consent-form" element={<FormEntryChecker />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/about" element={<About />} />
                <Route path="/success" element={<Success />} />
                <Route path="/howitworks" element={<HowItWorks />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/faq" element={<CmsPage slug="faq" />} />
                <Route path="/legal/:slug" element={<CmsPage />} />
                <Route path="/privacy" element={<CmsPage slug="privacy" />} />
                <Route path="/termsandconditions" element={<CmsPage slug="terms" />} />
              </Routes>
            </div>
          )}
        </main>
      )}
      {isAdminPage && <AdminLayout />}
      {!isAdminPage && <DreamCarBanner />}
      {!isAdminPage && <Footer />}
    </>
  );
};

const Container = () => {
  return (
    <Router>
      <SeoDefaults />
      <AppRoute />
    </Router>
  );
};

export default Container;
