import { ArrowLeft, Shield, Lock, Eye, FileText, Phone, Mail, MapPin } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BUSINESS_PHONE } from "../data/deliveryZones";

export default function PrivacyPolicyPage() {
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
            <h1 className="text-base font-extrabold text-[#111111] leading-tight">Privacy Policy</h1>
            <p className="text-[11px] text-[#666666]">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Intro Card */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-[#00A651]">
            <Shield size={22} className="shrink-0" />
            <h2 className="text-sm font-black uppercase tracking-wider">Your Privacy Matters to Us</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            At <strong>Shree Hari Keerai</strong>, we are committed to safeguarding your personal information.
            This Privacy Policy details what information we collect, how it is used for fresh harvest delivery,
            and how your data is protected when you use our storefront.
          </p>
        </div>

        {/* 1. Information We Collect */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <Eye size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">1. Information We Collect</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            When you place an order or select a delivery location on Shree Hari Keerai, we collect only the details required to fulfill your order:
          </p>
          <ul className="text-xs text-[#555555] space-y-2 list-disc pl-5 leading-relaxed">
            <li><strong>Customer Contact Details:</strong> Full Name, Primary Mobile Number, Alternative Mobile Number (optional), and Email Address (optional).</li>
            <li><strong>Delivery Location Data:</strong> Pinned GPS coordinates (Latitude & Longitude) from Google Maps, Door/Flat No., Street, Area, City, District, State, and Pincode for route navigation and fresh delivery.</li>
            <li><strong>Order & Transaction Records:</strong> Selected items, quantities, subtotal, delivery charges, discounts, total payable, and Razorpay Transaction Payment ID.</li>
          </ul>
          <div className="bg-[#EAF8F0] p-3 rounded-xl border border-[#B9E8CE] text-xs text-[#087A43] font-medium">
            🔒 <strong>Payment Security:</strong> We do NOT collect or store your Credit/Debit Card numbers, CVV, Netbanking passwords, or UPI PINs. All financial payments are processed directly through Razorpay's RBI-compliant, PCI-DSS Level 1 certified gateway.
          </div>
        </div>

        {/* 2. How We Use Your Information */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <FileText size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">2. How We Use Your Information</h2>
          </div>
          <ul className="text-xs text-[#555555] space-y-2 list-disc pl-5 leading-relaxed">
            <li><strong>Order Processing & Fulfillment:</strong> Harvesting fresh greens according to your order and routing delivery drivers directly to your pinned location.</li>
            <li><strong>Communication:</strong> Sending order receipts, delivery confirmations, and important updates via SMS, WhatsApp, or Email.</li>
            <li><strong>Customer Support:</strong> Resolving questions regarding delivery timing, address changes, or product queries.</li>
          </ul>
        </div>

        {/* 3. Third-Party Services & Data Sharing */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <Lock size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">3. Third-Party Services Used</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            We partner only with industry-leading, trusted service providers for operational functions:
          </p>
          <ul className="text-xs text-[#555555] space-y-2 list-disc pl-5 leading-relaxed">
            <li><strong>Razorpay:</strong> To process secure online payments (UPI, Cards, Netbanking).</li>
            <li><strong>Google Maps Platform:</strong> For interactive delivery location pinning and accurate geocoding.</li>
            <li><strong>Google Workspace / Apps Script:</strong> For secure order record management and automated email receipts.</li>
          </ul>
          <p className="text-xs text-[#555555]">
            We <strong>never sell, rent, or trade</strong> your personal information to advertisers or marketing third parties.
          </p>
        </div>

        {/* 4. Data Retention & User Rights */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">4. Data Retention & Your Rights</h2>
          <p className="text-xs text-[#555555] leading-relaxed">
            Your order records are retained only as long as necessary for tax, accounting, and customer support purposes.
            You have the right to review, update, or request the deletion of your customer records by contacting us at any time.
          </p>
        </div>

        {/* 5. Contact Information */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">5. Contact Us</h2>
          <p className="text-xs text-[#555555] leading-relaxed">
            If you have questions about this Privacy Policy or wish to request data updates, please contact our support team:
          </p>
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
          <Link to="/terms-and-conditions" className="hover:text-[#00A651] underline">Terms & Conditions</Link>
          <span>•</span>
          <Link to="/refund-policy" className="hover:text-[#00A651] underline">Refund & Cancellation Policy</Link>
        </div>
      </main>
    </div>
  );
}
