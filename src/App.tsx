import { useEffect, lazy, Suspense, type ReactNode } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "./store/AuthContext";

import HomePage from "./pages/HomePage";

// Lazy-loaded routes for performance & fast mobile initial load
const ProductsPage = lazy(() => import("./pages/ProductsPage"));
const ProductDetailsPage = lazy(() => import("./pages/ProductDetailsPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const OrderSuccessPage = lazy(() => import("./pages/OrderSuccessPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const RefundPolicyPage = lazy(() => import("./pages/RefundPolicyPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const EditProfilePage = lazy(() => import("./pages/EditProfilePage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const AccountSettingsPage = lazy(() => import("./pages/AccountSettingsPage"));

import { TopSnackbar } from "./components/ui/TopSnackbar";
import { FloatingCartButton } from "./components/features/FloatingCartButton";
import { WeekendDeliveryBanner } from "./components/features/WeekendDeliveryBanner";
import { retryPendingOrderNotifications } from "./services/orderService";

function PageFallback() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <div className="w-10 h-10 rounded-full border-3 border-[#EAF8F0] border-t-[#00A651] animate-spin mb-2" />
      <span className="text-[11px] font-bold text-[#087A43] tracking-widest uppercase">Shree Hari</span>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Flush any queued pending order notifications in background
  useEffect(() => {
    retryPendingOrderNotifications();
  }, []);

  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <PageFallback />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, initializing } = useAuth();
  if (initializing) return <PageFallback />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PincodeGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}


export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-dvh bg-white text-[#111111] antialiased selection:bg-[#EAF8F0] selection:text-[#00A651]">
      <ScrollToTop />
      
      {/* Global Top Modern Snackbar for cart updates */}
      <TopSnackbar />

      {/* Global Floating Cart Button at bottom-right */}
      <FloatingCartButton />

      {/* Informational Weekend Delivery Schedule Banner */}
      <WeekendDeliveryBanner />

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className="w-full min-h-dvh"
        >
          <Suspense fallback={<PageFallback />}>
            <Routes location={location}>
              {/* Redirect legacy /pincode to Home */}
              <Route path="/pincode" element={<Navigate to="/" replace />} />

              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/signup"
                element={
                  <GuestOnly>
                    <SignupPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <GuestOnly>
                    <ForgotPasswordPage />
                  </GuestOnly>
                }
              />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Guest-browsable Store Routes */}
              <Route
                path="/"
                element={
                  <PincodeGuard>
                    <HomePage />
                  </PincodeGuard>
                }
              />
              <Route
                path="/products"
                element={
                  <PincodeGuard>
                    <ProductsPage />
                  </PincodeGuard>
                }
              />
              <Route
                path="/products/:id"
                element={
                  <PincodeGuard>
                    <ProductDetailsPage />
                  </PincodeGuard>
                }
              />
              <Route
                path="/cart"
                element={
                  <PincodeGuard>
                    <CartPage />
                  </PincodeGuard>
                }
              />
              <Route
                path="/search"
                element={
                  <PincodeGuard>
                    <SearchPage />
                  </PincodeGuard>
                }
              />

              {/* Login-Required Store & Account Routes */}
              <Route
                path="/checkout"
                element={
                  <RequireAuth>
                    <PincodeGuard>
                      <CheckoutPage />
                    </PincodeGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/payment"
                element={
                  <RequireAuth>
                    <PincodeGuard>
                      <PaymentPage />
                    </PincodeGuard>
                  </RequireAuth>
                }
              />
              <Route
                path="/order-success"
                element={
                  <RequireAuth>
                    <PincodeGuard>
                      <OrderSuccessPage />
                    </PincodeGuard>
                  </RequireAuth>
                }
              />

              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/profile/edit"
                element={
                  <RequireAuth>
                    <EditProfilePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/orders"
                element={
                  <RequireAuth>
                    <OrdersPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/account"
                element={
                  <RequireAuth>
                    <AccountSettingsPage />
                  </RequireAuth>
                }
              />

              {/* Legal & Compliance Policy Routes */}
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/terms-and-conditions" element={<TermsPage />} />
              <Route path="/refund-policy" element={<RefundPolicyPage />} />
              <Route path="/cancellation-refund-policy" element={<RefundPolicyPage />} />

              {/* Fallback to Home (auth guard will send guests to Login) */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
