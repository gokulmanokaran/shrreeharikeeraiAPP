import { ArrowLeft, BookOpen, Truck, CreditCard, AlertTriangle, Phone, Mail, MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BUSINESS_PHONE } from "../data/deliveryZones";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-[#111111] pb-20">
      {/* Top Header */}
      <div className="bg-white border-b border-[#EAEAEA] sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-[#F5F5F5] hover:bg-[#EEEEEE] flex items-center justify-center text-[#111111] transition-colors cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-[#111111] leading-tight">Terms & Conditions</h1>
            <p className="text-[11px] text-[#666666]">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Intro Card */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-[#00A651]">
            <BookOpen size={22} className="shrink-0" />
            <h2 className="text-sm font-black uppercase tracking-wider">Terms of Service</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            Welcome to <strong>Shree Hari Keerai</strong>. By placing an order or using our website,
            you agree to be bound by these Terms & Conditions. Please read them carefully before purchasing.
          </p>
        </div>

        {/* 1. Ordering & Fresh Harvest Process */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">1. Ordering & Fresh Harvest Process</h2>
          <ul className="text-xs text-[#555555] space-y-2 list-disc pl-5 leading-relaxed">
            <li><strong>Delivery Schedule:</strong> Today Order – Tomorrow Evening Delivery Guaranteed. Orders placed today are freshly harvested and delivered the next evening.</li>
            <li><strong>Perishable Nature:</strong> Our leafy greens and keerai varieties are 100% natural, farm-fresh harvests. Sizes and seasonal variations may naturally occur.</li>
            <li><strong>Order Confirmation:</strong> An order is only confirmed once digital payment is successfully verified through Razorpay.</li>
          </ul>
        </div>

        {/* 2. Product Pricing & Availability */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">2. Product Pricing & Availability</h2>
          <p className="text-xs text-[#555555] leading-relaxed">
            All prices are listed in Indian Rupees (₹) inclusive of applicable taxes. In rare instances where a specific variety is unavailable due to unfavorable farm harvest conditions, our team will proactively contact you to provide an alternative or initiate an immediate full refund.
          </p>
        </div>

        {/* 3. Delivery Zones & Serviceable Areas */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <Truck size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">3. Serviceable Delivery Locations</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            We deliver exclusively within designated service pincodes in <strong>Coimbatore, Tamil Nadu</strong>.
            Delivery charges (₹30 / ₹50 / ₹80) and minimum order limits (₹199 / ₹249 / ₹299) depend on your delivery zone.
            Addresses located outside our active delivery zones cannot be served and will be prevented at checkout.
          </p>
        </div>

        {/* 4. Payment Terms */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <CreditCard size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">4. Payment Terms</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            All transactions are processed securely via <strong>Razorpay</strong> (supporting UPI, Google Pay, PhonePe, Paytm, Debit/Credit Cards, and Netbanking).
            Payments must be completed at the time of placing the order. We do not accept Cash on Delivery (COD) to prevent food waste of perishable harvests.
          </p>
        </div>

        {/* 5. Customer Responsibilities */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">5. Customer Responsibilities</h2>
          <ul className="text-xs text-[#555555] space-y-2 list-disc pl-5 leading-relaxed">
            <li>Ensure the delivery pin placed on the Google Map is accurate.</li>
            <li>Provide an active, reachable mobile number (and optional alternative number) for delivery driver coordination.</li>
            <li>Be available or arrange someone to collect the fresh products during evening delivery hours.</li>
          </ul>
        </div>

        {/* 6. Order Cancellation & Replacements */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">6. Cancellation & Replacements</h2>
          <p className="text-xs text-[#555555] leading-relaxed">
            Order replacements are governed by our <Link to="/refund-policy" className="text-[#00A651] font-semibold underline">Cancellation & Replacement Policy</Link>.
            If you receive a damaged or incorrect product, please contact us. We will collect the damaged/incorrect product and provide a replacement with a new product.
          </p>
        </div>

        {/* 7. Contact Support */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">7. Contact & Support Information</h2>
          <div className="bg-[#F9F9F9] rounded-xl p-3.5 space-y-2 text-xs">
            <p className="font-bold text-[#111111]">🌿 Shree Hari Keerai</p>
            <p className="flex items-center gap-2 text-[#555555]">
              <MapPin size={14} className="text-[#00A651]" /> Coimbatore, Tamil Nadu, India
            </p>
            <p className="flex items-center gap-2 text-[#555555]">
              <Phone size={14} className="text-[#00A651]" />
              <a href={`tel:${BUSINESS_PHONE}`} className="text-[#00A651] font-semibold">{BUSINESS_PHONE}</a>
            </p>
            <p className="flex items-center gap-2 text-[#555555]">
              <Mail size={14} className="text-[#00A651]" />
              <a href="mailto:shreeharikeerai1@gmail.com" className="text-[#00A651] font-semibold">shreeharikeerai1@gmail.com</a>
            </p>
            <div className="pt-2 border-t border-[#EAEAEA] flex flex-col gap-1 text-[#666666]">
              <p><strong>FSSAI:</strong> 22423557000359</p>
              <p><strong>GSTIN:</strong> 33BBHPP5925L1ZA</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs text-[#666666]">
          <Link to="/privacy-policy" className="hover:text-[#00A651] underline">Privacy Policy</Link>
          <span>•</span>
          <Link to="/refund-policy" className="hover:text-[#00A651] underline">Refund & Cancellation Policy</Link>
        </div>
      </main>
    </div>
  );
}
