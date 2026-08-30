"use client";

import React from "react";
import Container from "./container/Container";
import "./assets/style.css";
import "./assets/monsoon-sale.css";

import { LocalProvider } from "./context/LocalContext";
import { AdminProvider } from "./context/AdminContext";
import { OrderProvider } from "./context/OrderContext";
import { BlogProvider } from "./context/BlogContext";
import { TestimonialProvider } from "./context/TestimonialContext";
import { AuthProvider } from "./ms/AuthContext";

import { HelmetProvider } from "react-helmet-async";

function App() {
  return (
    <HelmetProvider>
      <AdminProvider>
        <BlogProvider>
          <LocalProvider>
            <OrderProvider>
              <TestimonialProvider>
                <AuthProvider>
                  <Container />
                </AuthProvider>
              </TestimonialProvider>
            </OrderProvider>
          </LocalProvider>
        </BlogProvider>
      </AdminProvider>
    </HelmetProvider>
  );
}

export default App;
