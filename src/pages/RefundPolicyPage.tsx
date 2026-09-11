import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Phone, Mail, MapPin, PackageCheck, Truck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { BUSINESS_PHONE } from "../data/deliveryZones";

export default function RefundPolicyPage() {
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
            <h1 className="text-base font-extrabold text-[#111111] leading-tight">Cancellation & Replacement Policy</h1>
            <p className="text-[11px] text-[#666666]">Last updated: {new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Core Policy Highlight Card */}
        <div className="bg-[#EAF8F0] rounded-[20px] p-5 border border-[#B9E8CE] shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-[#00A651]">
            <PackageCheck size={24} className="shrink-0" />
            <h2 className="text-sm font-black uppercase tracking-wider">Our Replacement Guarantee</h2>
          </div>
          <p className="text-sm text-[#087A43] font-semibold leading-relaxed">
            “If you receive a damaged or incorrect product, please contact us. We will collect the damaged/incorrect product and provide a replacement with a new product.”
          </p>
        </div>

        {/* 1. Policy Overview */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <RefreshCw size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">1. Replacement Policy Terms</h2>
          </div>
          <p className="text-xs text-[#555555] leading-relaxed">
            At <strong>Shree Hari Keerai</strong>, we take pride in delivering natural, farm-fresh greens and premium wholesome products. If there is ever an issue with your order, we guarantee a prompt replacement:
          </p>
          <ul className="text-xs text-[#555555] space-y-2.5 list-none pl-0 leading-relaxed">
            <li className="flex items-start gap-2 bg-[#F9FAF9] p-3 rounded-xl border border-[#EEEEEE]">
              <CheckCircle size={15} className="text-[#00A651] shrink-0 mt-0.5" />
              <span><strong>Damaged Products:</strong> If any item arrives damaged, decayed, or unfit for consumption, report it to us immediately for a replacement.</span>
            </li>
            <li className="flex items-start gap-2 bg-[#F9FAF9] p-3 rounded-xl border border-[#EEEEEE]">
              <CheckCircle size={15} className="text-[#00A651] shrink-0 mt-0.5" />
              <span><strong>Incorrect Products:</strong> If you receive an item different from what you ordered or an incorrect variant, report it to our team.</span>
            </li>
            <li className="flex items-start gap-2 bg-[#F9FAF9] p-3 rounded-xl border border-[#EEEEEE]">
              <Truck size={15} className="text-[#00A651] shrink-0 mt-0.5" />
              <span><strong>Product Collection:</strong> Our delivery team will collect the damaged or incorrect product directly from your address.</span>
            </li>
            <li className="flex items-start gap-2 bg-[#F9FAF9] p-3 rounded-xl border border-[#EEEEEE]">
              <PackageCheck size={15} className="text-[#00A651] shrink-0 mt-0.5" />
              <span><strong>New Replacement Provided:</strong> We will promptly deliver a brand-new replacement product directly to your doorstep.</span>
            </li>
          </ul>
        </div>

        {/* 2. How to Request a Replacement */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-[#111111]">
            <AlertCircle size={18} className="text-[#00A651]" />
            <h2 className="text-sm font-bold">2. How to Report & Request a Replacement</h2>
          </div>
          <ol className="text-xs text-[#555555] space-y-2 list-decimal pl-5 leading-relaxed">
            <li>Contact our customer support team via <strong>WhatsApp or Call at {BUSINESS_PHONE}</strong>.</li>
            <li>Share your <strong>Order ID</strong> and a quick photo/details of the damaged or incorrect item.</li>
            <li>Our team will arrange for the collection of the damaged/incorrect product and dispatch a fresh replacement product.</li>
          </ol>
        </div>

        {/* 3. Contact Information */}
        <div className="bg-white rounded-[20px] p-5 border border-[#EAEAEA] shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-[#111111]">3. Contact Us for Support & Replacements</h2>
          <div className="bg-[#F9F9F9] rounded-xl p-3.5 space-y-2 text-xs">
            <p className="font-bold text-[#111111]">🌿 Shree Hari Keerai Customer Support</p>
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
          <Link to="/terms-and-conditions" className="hover:text-[#00A651] underline">Terms & Conditions</Link>
        </div>
      </main>
    </div>
  );
}
