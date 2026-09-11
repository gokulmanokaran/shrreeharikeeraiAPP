import { Phone, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { BUSINESS_PHONE } from "../../data/deliveryZones";
import logoImg from "../../assets/logo.png";

export function Footer() {
  return (
    <footer className="bg-[#111111] text-white pt-10 pb-36">
      <div className="max-w-6xl mx-auto px-5">
        {/* Brand */}
        <div className="mb-8">
          <div className="mb-3 bg-white/95 p-2 rounded-[14px] inline-block shadow-sm">
            <img
              src={logoImg}
              alt="Shree Hari Keerai"
              className="h-8 w-auto object-contain"
            />
          </div>
          <div className="text-xs text-[#00A651] font-bold mb-2 tracking-wide uppercase">
            Fresh • Natural • Premium
          </div>
          <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-2">
            Bringing fresh greens, premium dry fruits, and healthy products
            straight to your doorstep.
          </p>
          <div className="flex flex-col gap-1 text-xs text-gray-300 font-medium">
            <div>
              <span className="text-gray-400 font-normal">FSSAI:</span> 22423557000359
            </div>
            <div>
              <span className="text-gray-400 font-normal">GSTIN:</span> 33BBHPP5925L1ZA
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-3 mb-8">
          <a
            href={`tel:${BUSINESS_PHONE}`}
            className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone size={14} />
            </div>
            {BUSINESS_PHONE}
          </a>
          <a
            href={`https://wa.me/91${BUSINESS_PHONE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <div className="w-8 h-8 bg-[#25D366]/20 rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle size={14} className="text-[#25D366]" />
            </div>
            WhatsApp Us
          </a>
        </div>

        {/* Nav Links */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[
            { label: "Home", to: "/" },
            { label: "Products", to: "/products" },
            { label: "Categories", to: "/products" },
            { label: "Cart", to: "/cart" },
          ].map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="text-sm text-gray-400 hover:text-white transition-colors py-1"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Legal & Compliance Links */}
        <div className="border-t border-white/10 pt-4 pb-6">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Legal & Policies</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
            <Link to="/privacy-policy" className="hover:text-[#00A651] transition-colors">Privacy Policy</Link>
            <Link to="/terms-and-conditions" className="hover:text-[#00A651] transition-colors">Terms & Conditions</Link>
            <Link to="/refund-policy" className="hover:text-[#00A651] transition-colors">Refund & Cancellation</Link>
          </div>
        </div>

        {/* Bottom line */}
        <div className="border-t border-white/10 pt-5 flex flex-col items-center gap-1 text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Shree Hari — Keerai. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 font-medium flex items-center justify-center gap-2 flex-wrap">
            Design and Developed by{" "}
            <img
              src="https://res.cloudinary.com/yrkokpqe/image/upload/f_auto,q_auto/DIC"
              alt="DIC"
              className="h-[28px] w-auto object-contain inline-block"
              loading="lazy"
            />
          </p>
        </div>
      </div>
    </footer>
  );
}
