import { useState, useRef, useEffect } from "react";
import { Search as SearchIcon, X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Product } from "../data/products";
import { ProductCard } from "../components/features/ProductCard";
import { useProductCatalog } from "../store/ProductContext";

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { products, searchProducts } = useProductCatalog();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setResults(searchProducts(query));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, searchProducts]);

  return (
    <div className="min-h-dvh bg-white pb-24">
      {/* Sticky Search Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#EAEAEA] px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-[#111111]" />
          </button>

          <div className="flex-1 flex items-center gap-2.5 bg-[#F5F5F5] rounded-[14px] px-3.5 h-11">
            <SearchIcon size={18} className="text-[#999999] flex-shrink-0" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search greens, almonds, dates, seeds..."
              className="flex-1 bg-transparent text-sm font-medium text-[#111111] placeholder-[#999999] focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-[#999999] hover:text-[#111111]"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results or Suggested */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        {!query.trim() ? (
          <div>
            <p className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-3">
              Popular Searches
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                "Dwarf Copper Leaves",
                "Almond",
                "Chia Seeds",
                "Garlic",
                "Black Dates",
                "Small Onion",
                "Pista",
                "Walnut",
              ].map((term) => (
                <button
                  key={term}
                  onClick={() => setQuery(term)}
                  className="text-xs font-semibold bg-[#EAF8F0] text-[#00A651] px-3 py-2 rounded-full hover:bg-[#D4F1E4] transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-3">
              Featured Recommendations
            </p>
            <div className="grid grid-cols-2 gap-3">
              {products.slice(0, 4).map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-4xl mb-3">🔍</span>
            <p className="text-base font-bold text-[#111111]">
              No products found for "{query}"
            </p>
            <p className="text-xs text-[#999999] mt-1 max-w-xs">
              Try searching for keerai, dry fruits, seeds, or peeled vegetables.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-xs font-bold text-[#888888] mb-3">
              {results.length} {results.length === 1 ? "result" : "results"} found
            </p>
            <div className="grid grid-cols-2 gap-3">
              {results.map((product, i) => (
                <ProductCard key={product.id} product={product} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
