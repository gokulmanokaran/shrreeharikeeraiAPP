import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./store/AuthContext";
import { DeliveryProvider } from "./store/DeliveryContext";
import { CartProvider } from "./store/CartContext";
import { ProductProvider } from "./store/ProductContext";
import "./index.css";

// Register Service Worker for PWA and Android App caching
if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.info("[PWA] ServiceWorker registered with scope:", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] ServiceWorker registration failed:", err);
      });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DeliveryProvider>
          <ProductProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </ProductProvider>
        </DeliveryProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

