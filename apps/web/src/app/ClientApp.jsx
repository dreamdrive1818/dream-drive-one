"use client";

import React from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "react-quill/dist/quill.snow.css";
import App from "../App";

/** Next.js client shell that mounts the existing CRA SPA (react-router). */
export default function ClientApp() {
  return (
    <>
      <App />
      <ToastContainer />
    </>
  );
}
