import { useState } from "react";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { PromoCarousel } from "../components/features/PromoCarousel";
import { CategoryScroller } from "../components/features/CategoryScroller";
import { WhyChooseUs } from "../components/features/WhyChooseUs";
import { WhatsAppCTA } from "../components/features/WhatsAppCTA";
import { SearchOverlay } from "../components/features/SearchOverlay";

export default function HomePage() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      {/* 1. Header with search, call, and Delivery Location pill (INTACT) */}
      <Header onSearchOpen={() => setSearchOpen(true)} />
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      <main className="pb-24 max-w-6xl mx-auto px-3 sm:px-4">
        {/* 2. Promotional / Pre-Order Banner Carousel (1st Banner & 2nd Weekend Notice INTACT) */}
        <PromoCarousel />

        {/* 3. Shop by Category (Original UI Icons + Category Names) */}
        <div className="mt-4 sm:mt-5">
          <CategoryScroller mode="home" />
        </div>

        {/* 4. Why Choose Us */}
        <div className="mt-8">
          <WhyChooseUs />
        </div>

        {/* 5. Contact / WhatsApp */}
        <div className="mt-4">
          <WhatsAppCTA />
        </div>

        {/* 6. Footer */}
        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
