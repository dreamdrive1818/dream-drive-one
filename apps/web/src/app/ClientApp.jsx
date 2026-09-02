"use client";

import React, { useEffect } from "react";
import Modal from "react-modal";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "react-quill/dist/quill.snow.css";
import App from "../App";

/** Next.js client shell that mounts the existing CRA SPA (react-router). */
export default function ClientApp() {
  useEffect(() => {
    Modal.setAppElement(document.body);
  }, []);

  return (
    <>
      <App />
      <ToastContainer />
    </>
  );
}
