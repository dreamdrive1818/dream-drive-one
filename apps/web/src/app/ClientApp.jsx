"use client";

import React, { useEffect } from "react";
import Modal from "react-modal";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import App from "../App";
import { prefetch } from "../ms/api";

/** Next.js client shell that mounts the existing CRA SPA (react-router). */
export default function ClientApp() {
  useEffect(() => {
    Modal.setAppElement(document.body);
    prefetch([
      "/v1/public/cities",
      "/v1/public/home",
      "/v1/public/search",
      "/v1/public/catalog-config",
    ]);
  }, []);

  return (
    <>
      <App />
      <ToastContainer />
    </>
  );
}
