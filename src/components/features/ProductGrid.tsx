import { Product } from "../../data/products";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  title?: string;
  emptyMessage?: string;
}

export function ProductGrid({ products, title, emptyMessage }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-5 text-center">
        <span className="text-4xl mb-3">🌿</span>
        <p className="text-base font-bold text-[#111111] mb-1">
          {emptyMessage || "No products found"}
        </p>
        <p className="text-sm text-[#999999]">Try a different search or category.</p>
      </div>
    );
  }

  return (
    <section>
      {title && (
        <div className="px-1 mb-2.5">
          <h2 className="text-base sm:text-lg font-black text-[#111111]">{title}</h2>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {products.map((product, i) => (
          <ProductCard key={product.id} product={product} index={i} />
        ))}
      </div>
    </section>
  );
}
