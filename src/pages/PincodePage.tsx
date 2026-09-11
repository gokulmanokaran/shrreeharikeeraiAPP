import { AnimatePresence, motion } from "framer-motion";
import { MapPin, CheckCircle, AlertCircle, ArrowRight, Truck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDelivery } from "../store/DeliveryContext";
import { validatePincode } from "../utils/validation";
import { Button } from "../components/ui/Button";
import logoImg from "../assets/logo.png";

type Status = "idle" | "loading" | "success" | "error";

export default function PincodePage() {
  const { checkPincode } = useDelivery();
  const navigate = useNavigate();

  const [pincode, setPincode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [charge, setCharge] = useState<number | null>(null);
  const [minOrder, setMinOrder] = useState<number | null>(null);

  const handleCheck = async () => {
    const validationError = validatePincode(pincode);
    if (validationError) {
      setErrorMsg(validationError);
      setStatus("error");
      return;
    }

    setStatus("loading");
    // Simulate brief validation delay for UX
    await new Promise((r) => setTimeout(r, 500));

    const result = checkPincode(pincode);
    if (result.success) {
      setCharge(result.charge);
      setMinOrder(result.minimumOrder);
      setStatus("success");
      // Auto-navigate after success display
      setTimeout(() => navigate("/", { replace: true }), 2200);
    } else {
      setStatus("error");
      setErrorMsg(
        "We're not delivering to your area yet. Please try another pincode."
      );
    }
  };

  const handleReset = () => {
    setPincode("");
    setStatus("idle");
    setErrorMsg("");
    setCharge(null);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#F5FCF8] via-white to-[#EAF8F0] flex flex-col">
      {/* Decorative animated shapes */}
      <motion.div
        animate={{ scale: [1, 1.08, 1], rotate: [0, 5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="fixed top-[-80px] right-[-60px] w-64 h-64 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,166,81,0.15) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />
      <motion.div
        animate={{ scale: [1, 1.06, 1], rotate: [0, -6, 0] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        className="fixed bottom-[-100px] left-[-80px] w-80 h-80 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(11,175,91,0.12) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="w-full max-w-sm"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 24,
                delay: 0.1,
              }}
              className="bg-white/95 p-3 rounded-[20px] shadow-lg border border-[#00A651]/20 mb-4 max-w-[240px]"
              style={{ boxShadow: "0 8px 30px rgba(0,166,81,0.18)" }}
            >
              <img
                src={logoImg}
                alt="Shree Hari Keerai"
                className="w-full h-auto object-contain max-h-16"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <h1 className="text-xl font-black text-[#111111] tracking-tight mb-0.5">
                Freshness delivered
              </h1>
              <p className="text-[#00A651] font-bold text-sm">
                to your doorstep
              </p>
            </motion.div>
          </div>

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-[24px] p-6 shadow-xl border border-[#EAEAEA]"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}
          >
            <AnimatePresence mode="wait">
              {status === "success" ? (
                /* ── Success state ───────────────────────────── */
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 28 }}
                  className="flex flex-col items-center text-center gap-4 py-3"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 22,
                      delay: 0.1,
                    }}
                    className="w-14 h-14 rounded-full bg-[#EAF8F0] flex items-center justify-center"
                  >
                    <CheckCircle size={30} className="text-[#00A651]" />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-black text-[#111111] mb-1">
                      Great! We deliver to your area. 🎉
                    </h2>
                    <div className="flex flex-col gap-1.5 mt-2">
                      <div className="flex items-center gap-2">
                        <Truck size={13} className="text-[#00A651]" />
                        <p className="text-sm text-[#666666]">
                          Delivery charge:{" "}
                          <span className="font-bold text-[#00A651]">₹{charge}</span>
                        </p>
                      </div>
                      {minOrder !== null && (
                        <p className="text-xs text-[#666666]">
                          Min. order for your area:{" "}
                          <span className="font-bold text-[#111111]">₹{minOrder}</span>
                        </p>
                      )}
                      <p className="text-xs text-[#00A651] font-medium mt-1">
                        Today Order – Tomorrow Evening Delivery Guaranteed 🚚
                      </p>
                    </div>
                    <p className="text-xs text-[#999999] mt-2">
                      Taking you to the store...
                    </p>
                  </div>
                </motion.div>
              ) : status === "error" &&
                errorMsg.includes("not delivering") ? (
                /* ── Unavailable state ──────────────────────── */
                <motion.div
                  key="unavailable"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center text-center gap-4 py-3"
                >
                  <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle size={30} className="text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-[#111111] mb-2">
                      We're not delivering here yet
                    </h2>
                    <p className="text-sm text-[#666666] leading-relaxed">
                      Delivery to your area will be available in the future.
                      Please check again later.
                    </p>
                  </div>
                  <Button variant="outline" size="md" onClick={handleReset}>
                    Try Another Pincode
                  </Button>
                </motion.div>
              ) : (
                /* ── Input state ────────────────────────────── */
                <motion.div
                  key="input"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-[#EAF8F0] flex items-center justify-center flex-shrink-0">
                      <MapPin size={16} className="text-[#00A651]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[#111111]">
                        Check Delivery
                      </p>
                      <p className="text-xs text-[#999999]">
                        Enter your 6-digit pincode
                      </p>
                    </div>
                  </div>

                  <div>
                    <input
                      id="pincode-input"
                      type="tel"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        setPincode(e.target.value.replace(/\D/g, ""));
                        if (status === "error") {
                          setStatus("idle");
                          setErrorMsg("");
                        }
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                      placeholder="Enter your 6-digit pincode"
                      aria-label="Pincode"
                      aria-describedby={
                        status === "error" ? "pincode-error" : undefined
                      }
                      className={`w-full h-14 px-4 border-2 rounded-[14px] text-lg font-bold tracking-widest focus:outline-none transition-colors ${
                        status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-[#EAEAEA] focus:border-[#00A651]"
                      }`}
                    />
                    {status === "error" && !errorMsg.includes("not delivering") && (
                      <motion.p
                        id="pincode-error"
                        role="alert"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-red-500 text-sm mt-2 font-medium"
                      >
                        {errorMsg}
                      </motion.p>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="xl"
                    fullWidth
                    loading={status === "loading"}
                    onClick={handleCheck}
                    icon={<ArrowRight size={18} />}
                    iconPosition="right"
                  >
                    Check Delivery
                  </Button>

                  <p className="text-xs text-center text-[#AAAAAA]">
                    We deliver to select areas in Coimbatore
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>

      {/* Branding */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-center text-xs text-[#CCCCCC] pb-6 font-medium"
      >
        Shree Hari — Keerai · Fresh · Natural · Premium
      </motion.p>
    </div>
  );
}
